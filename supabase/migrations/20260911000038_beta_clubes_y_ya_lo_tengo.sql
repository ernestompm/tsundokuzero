-- =====================================================================
-- 038 · Probadores, clubes con permiso y «ya lo tengo»
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Tres cosas que no tienen nada que ver entre sí salvo que las pidió la
-- misma persona el mismo día:
--
--   1. PROBADORES. Un puñado de gente de confianza puede dejar notas de
--      desarrollo desde dentro de la app, con la pantalla donde estaban.
--      El resto no ve nada: no es un buzón de sugerencias público.
--
--   2. CLUBES CON PERMISO. Se pueden crear clubes nuevos, pero no los
--      crea cualquiera: hay que dar el permiso a dedo y se gasta al
--      usarlo. Cada club nace con su propio código de invitación, que
--      es lo que lo hace utilizable sin tocar nada más.
--
--   3. «YA LO TENGO». Cuando hay próxima lectura, cada uno dice si ya
--      tiene el libro. El club ve cuántos van y el capitán se entera de
--      cuándo se puede empezar de verdad, en vez de preguntarlo por
--      WhatsApp uno por uno.
-- =====================================================================

-- =====================================================================
-- 1 · PROBADORES Y NOTAS DE DESARROLLO
-- =====================================================================

alter table public.profiles
  add column if not exists beta_tester boolean not null default false;

comment on column public.profiles.beta_tester is
  'Puede dejar notas de desarrollo desde dentro de la app.';

create or replace function public.is_beta()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.beta_tester from public.profiles p where p.id = auth.uid()),
    false
  ) or public.is_super_admin();
$$;

grant execute on function public.is_beta() to authenticated;

-- La nota se guarda con la ruta desde la que se escribió: sin eso, la
-- mitad de los avisos son «el botón no va» y no hay forma de saber cuál.
create table if not exists public.dev_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'fallo'
    check (kind in ('fallo', 'idea', 'texto')),
  body text not null check (length(body) between 1 and 2000),
  path text check (path is null or length(path) <= 200),
  status text not null default 'open'
    check (status in ('open', 'doing', 'done', 'wontfix')),
  reply text check (reply is null or length(reply) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists dev_notes_status_idx
  on public.dev_notes (status, created_at desc);

alter table public.dev_notes enable row level security;

drop policy if exists "dev_notes_insert_beta" on public.dev_notes;
create policy "dev_notes_insert_beta" on public.dev_notes
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_beta());

drop policy if exists "dev_notes_select_own" on public.dev_notes;
create policy "dev_notes_select_own" on public.dev_notes
  for select to authenticated
  using (author_id = auth.uid() or public.is_super_admin());

drop policy if exists "dev_notes_update_admin" on public.dev_notes;
create policy "dev_notes_update_admin" on public.dev_notes
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "dev_notes_delete_own" on public.dev_notes;
create policy "dev_notes_delete_own" on public.dev_notes
  for delete to authenticated
  using (author_id = auth.uid() or public.is_super_admin());

grant select, insert, delete on public.dev_notes to authenticated;
grant update on public.dev_notes to authenticated;

-- =====================================================================
-- 2 · CLUBES CON PERMISO
-- =====================================================================

alter table public.profiles
  add column if not exists can_create_club boolean not null default false;

comment on column public.profiles.can_create_club is
  'Permiso de un solo uso para fundar un club. Se gasta al crearlo.';

-- Cada club con su propio código: sin esto, un club nuevo nace sin
-- forma de que entre nadie.
alter table public.clubs
  add column if not exists invite_code text;

create unique index if not exists clubs_invite_code_idx
  on public.clubs (lower(invite_code)) where invite_code is not null;

-- Quitar acentos sin depender de la extensión `unaccent`, que no siempre
-- está instalada en Supabase.
create or replace function public.unaccent_es(t text)
returns text
language sql
immutable
as $$
  select translate(coalesce(t, ''),
                   'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                   'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

create or replace function public.codigo_de_club()
returns text
language sql
volatile
as $$
  -- Seis caracteres legibles: sin 0/O ni 1/I, que se dictan mal por teléfono
  select string_agg(
    substr('abcdefghjkmnpqrstuvwxyz23456789',
           1 + floor(random() * 31)::int, 1), ''
  )
  from generate_series(1, 6);
$$;

create or replace function public.create_club(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_puede boolean;
  v_admin boolean := public.is_super_admin();
  v_id uuid;
  v_slug text;
  v_code text;
  v_intentos int := 0;
begin
  if uid is null then raise exception 'forbidden'; end if;

  select p.can_create_club into v_puede from profiles p where p.id = uid;
  if not coalesce(v_puede, false) and not v_admin then
    raise exception 'Todavía no tienes permiso para fundar un club.';
  end if;

  -- Una persona, un club. La app entera está pensada así («no quiero
  -- clubes múltiples»): lo que se abre aquí es la puerta a que existan
  -- OTROS clubes, no a que tú estés en varios.
  if exists (select 1 from club_members m where m.user_id = uid) then
    raise exception 'Ya estás en un club. Sal de él antes de fundar otro.';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 3 or length(p_name) > 60 then
    raise exception 'El nombre del club tiene que tener entre 3 y 60 caracteres.';
  end if;

  -- Slug a partir del nombre, con sufijo si ya existe
  v_slug := regexp_replace(lower(unaccent_es(p_name)), '[^a-z0-9]+', '-', 'g');
  -- El esquema exige ^[a-z0-9-]{3,40}$, y el sufijo todavía suma
  v_slug := btrim(left(btrim(v_slug, '-'), 34), '-');
  if length(v_slug) < 3 then v_slug := 'club'; end if;
  while exists (select 1 from clubs c where c.slug = v_slug) loop
    v_intentos := v_intentos + 1;
    v_slug := v_slug || '-' || v_intentos::text;
  end loop;

  -- Código único
  loop
    v_code := public.codigo_de_club();
    exit when not exists (
      select 1 from clubs c where lower(c.invite_code) = v_code
    );
  end loop;

  insert into clubs (name, slug, description, invite_code)
  values (p_name, v_slug, nullif(btrim(coalesce(p_description, '')), ''), v_code)
  returning id into v_id;

  -- El primer miembro es capitán (lo fija el trigger de club_members)
  insert into club_members (club_id, user_id) values (v_id, uid);

  -- El permiso se gasta: fundar un club es algo que se concede una vez
  if not v_admin then
    update profiles set can_create_club = false where id = uid;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_club(text, text) from anon, public;
grant execute on function public.create_club(text, text) to authenticated;

-- Entrar en un club con su código. Sustituye al INSERT libre que había:
-- hasta ahora cualquiera podía meterse en cualquier club a mano.
create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'forbidden'; end if;

  select c.id into v_id
    from clubs c
   where lower(c.invite_code) = lower(btrim(coalesce(p_code, '')))
     and coalesce(c.invite_code, '') <> '';
  if v_id is null then
    raise exception 'Ese código no es de ningún club.';
  end if;

  if exists (select 1 from club_members m where m.club_id = v_id and m.user_id = uid) then
    return v_id;
  end if;
  if exists (select 1 from club_members m where m.user_id = uid) then
    raise exception 'Ya estás en un club. Sal de él antes de entrar en otro.';
  end if;

  insert into club_members (club_id, user_id) values (v_id, uid);
  return v_id;
end;
$$;

revoke all on function public.join_club(text) from anon, public;
grant execute on function public.join_club(text) to authenticated;

-- Se cierra el INSERT directo: entrar en un club pasa por join_club,
-- que exige el código. El backfill del club fundador ya está hecho.
drop policy if exists "club_members_insert_self" on public.club_members;

-- ---------- Un solo código que dictar ----------
-- Quien se registra tenía que saber el código global de invitación, y
-- ADEMÁS el de su club. Dos códigos para entrar en un sitio es uno de
-- más. Ahora el código del club también sirve para registrarse, y además
-- te mete en él: es el único que hay que pasarle a nadie.
create or replace function public.complete_onboarding(
  invite text,
  new_username text,
  new_display_name text,
  accepted_terms_version int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
  v_code text := lower(btrim(coalesce(invite, '')));
  v_club uuid;
begin
  if uid is null then
    raise exception 'forbidden';
  end if;

  -- Consentimiento obligatorio, también en servidor (RGPD art. 7)
  if accepted_terms_version is null or accepted_terms_version < 1 then
    raise exception 'terms_not_accepted';
  end if;

  -- ¿Es el código de algún club? Entonces vale como invitación Y te mete
  select c.id into v_club
    from clubs c
   where coalesce(c.invite_code, '') <> ''
     and lower(c.invite_code) = v_code;

  if v_club is null then
    select value into stored from private_settings where key = 'invite_code';
    if stored is null or stored = '' then
      -- Cerrado por defecto: sin código configurado no entra nadie nuevo
      raise exception 'invite_not_configured';
    end if;
    if v_code = '' or v_code <> lower(btrim(stored)) then
      raise exception 'invalid_invite';
    end if;
  end if;

  insert into profiles (id, username, display_name)
  values (uid, new_username, new_display_name);

  insert into consents (user_id, doc, doc_version)
  values (uid, 'terms', accepted_terms_version)
  on conflict do nothing;

  if v_club is not null then
    insert into club_members (club_id, user_id)
    values (v_club, uid)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, int) from anon;
grant execute on function public.complete_onboarding(text, text, text, int) to authenticated;

-- ---------- Mi club, no «el primero de la tabla» ----------
-- Con varios clubes, `select * from clubs order by created_at limit 1`
-- deja de significar nada. Esto devuelve el club al que pertenezco.
create or replace function public.my_club()
returns setof public.clubs
language sql
stable
security definer
set search_path = public
as $$
  select c.*
    from clubs c
    join club_members m on m.club_id = c.id and m.user_id = auth.uid()
   order by m.joined_at
   limit 1;
$$;

revoke all on function public.my_club() from anon, public;
grant execute on function public.my_club() to authenticated;

-- El código, solo para quien manda en el club
create or replace function public.club_invite_code()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  select c.id, c.invite_code into v_id, v_code from public.my_club() c;
  if v_id is null then return null; end if;
  if not (public.is_club_captain(v_id) or public.is_super_admin()) then
    raise exception 'Solo el capitán puede ver el código del club.';
  end if;
  return v_code;
end;
$$;

revoke all on function public.club_invite_code() from anon, public;
grant execute on function public.club_invite_code() to authenticated;

-- Los clubes que ya existían necesitan código para poder recibir gente
update public.clubs
   set invite_code = public.codigo_de_club()
 where invite_code is null;

-- ---------- El panel de administración necesita ver los permisos ----------
-- OJO: cambia el tipo de retorno (dos columnas nuevas), así que hay que
-- borrarla antes: PostgreSQL no deja hacerlo con `create or replace`.
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  is_super_admin boolean,
  club_role text,
  created_at timestamptz,
  beta_tester boolean,
  can_create_club boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.username,
    p.display_name,
    u.email::text,
    coalesce((u.raw_app_meta_data ->> 'is_super_admin')::boolean, false),
    (select m.role from club_members m where m.user_id = p.id limit 1),
    p.created_at,
    p.beta_tester,
    p.can_create_club
  from profiles p
  join auth.users u on u.id = p.id
  where public.is_super_admin()
  order by p.created_at;
$$;

revoke all on function public.admin_list_users() from anon, public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_flag(target uuid, flag text, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  if flag = 'beta_tester' then
    update profiles set beta_tester = value where id = target;
  elsif flag = 'can_create_club' then
    update profiles set can_create_club = value where id = target;
  else
    raise exception 'permiso desconocido';
  end if;
end;
$$;

revoke all on function public.admin_set_flag(uuid, text, boolean) from anon, public;
grant execute on function public.admin_set_flag(uuid, text, boolean) to authenticated;

-- =====================================================================
-- 3 · «YA LO TENGO»
-- =====================================================================

create table if not exists public.book_ready (
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

alter table public.book_ready enable row level security;

drop policy if exists "book_ready_select_club" on public.book_ready;
create policy "book_ready_select_club" on public.book_ready
  for select to authenticated using (true);

drop policy if exists "book_ready_write_own" on public.book_ready;
create policy "book_ready_write_own" on public.book_ready
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "book_ready_delete_own" on public.book_ready;
create policy "book_ready_delete_own" on public.book_ready
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.book_ready to authenticated;

-- Quién lo tiene y quién no, con nombre y cara: la gracia está en ver
-- que faltas tú, no en un número.
create or replace function public.club_ready(p_book uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  listo boolean,
  soy_yo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    (r.user_id is not null),
    (m.user_id = auth.uid())
  from public.my_club() c
  join club_members m on m.club_id = c.id
  join profiles p on p.id = m.user_id
  left join book_ready r on r.book_id = p_book and r.user_id = m.user_id
  order by (r.user_id is not null) desc, p.display_name;
$$;

revoke all on function public.club_ready(uuid) from anon, public;
grant execute on function public.club_ready(uuid) to authenticated;

-- Cuando lo tiene todo el mundo, el capitán se entera sin preguntar.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention', 'mention_wait',
                  'reply_sworn', 'all_ready'));

create or replace function public.avisar_todos_listos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_faltan int;
  v_capitan uuid;
begin
  -- Solo cuenta para la PRÓXIMA lectura: es la única en la que tener el
  -- libro significa algo.
  select c.id into v_club from clubs c where c.next_book_id = new.book_id;
  if v_club is null then
    return new;
  end if;

  select count(*) into v_faltan
    from club_members m
   where m.club_id = v_club
     and not exists (
       select 1 from book_ready r
        where r.book_id = new.book_id and r.user_id = m.user_id
     );
  if v_faltan > 0 then
    return new;
  end if;

  select m.user_id into v_capitan
    from club_members m
   where m.club_id = v_club and m.role = 'captain'
   limit 1;
  if v_capitan is null then
    return new;
  end if;

  -- Una vez y no más, aunque alguien lo desmarque y lo vuelva a marcar
  if exists (
    select 1 from notifications n
     where n.user_id = v_capitan
       and n.type = 'all_ready'
       and n.book_id = new.book_id
  ) then
    return new;
  end if;

  insert into notifications (user_id, actor_id, type, book_id)
  values (v_capitan, null, 'all_ready', new.book_id);

  return new;
end;
$$;

drop trigger if exists avisar_todos_listos_after_insert on public.book_ready;
create trigger avisar_todos_listos_after_insert
  after insert on public.book_ready
  for each row execute function public.avisar_todos_listos();

-- Al empezar la lectura, las marcas de «ya lo tengo» ya no pintan nada
create or replace function public.limpiar_listos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_book_id is not null
     and new.current_book_id is distinct from old.current_book_id then
    delete from book_ready where book_id = new.current_book_id;
  end if;
  return new;
end;
$$;

drop trigger if exists limpiar_listos_after_update on public.clubs;
create trigger limpiar_listos_after_update
  after update of current_book_id on public.clubs
  for each row execute function public.limpiar_listos();
