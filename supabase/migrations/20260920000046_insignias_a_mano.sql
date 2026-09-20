-- =====================================================================
-- 046 · Insignias que se crean y se dan a mano
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Las insignias de hasta ahora se calculan solas: terminar libros, no
-- fallar días, responder a gente. Eso está bien y no se toca — nadie
-- puede regalarlas ni quitarlas.
--
-- Pero hay cosas que ningún contador va a ver nunca: quien se leyó el
-- libro en dos días y no dijo ni media palabra para no destriparlo, quien
-- trajo al club la lectura del año, quien aguantó el tostón hasta el
-- final por no dejar a nadie tirado. Para eso están estas: las inventa el
-- administrador y las da a mano, con un motivo escrito.
--
-- Se distinguen de las automáticas a propósito. Una insignia que te ha
-- dado alguien vale precisamente porque alguien decidió dártela.
-- =====================================================================

-- ---------- El catálogo ----------
create table if not exists public.insignias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 2 and 40),
  detalle text not null check (length(btrim(detalle)) between 2 and 120),
  /** icono del subset (scripts/icons.txt): la app no puede pintar otros */
  icon text not null default 'star',
  tono text not null default 'oro' check (tono in ('oro', 'salvia', 'tierra')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.insignias enable row level security;

-- Las ve todo el mundo: una insignia que nadie sabe que existe no la
-- quiere nadie. Se crean y se borran solo por RPC de administrador.
drop policy if exists "insignias_select" on public.insignias;
create policy "insignias_select" on public.insignias
  for select to authenticated using (true);

revoke insert, update, delete on public.insignias from anon, authenticated;
grant select on public.insignias to authenticated;

-- ---------- A quién se le ha dado ----------
create table if not exists public.insignias_dadas (
  insignia_id uuid not null references public.insignias(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  /** por qué: lo que hace que la insignia signifique algo */
  motivo text check (motivo is null or length(motivo) <= 200),
  dada_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (insignia_id, user_id)
);

create index if not exists insignias_dadas_user_idx
  on public.insignias_dadas (user_id, created_at desc);

alter table public.insignias_dadas enable row level security;

drop policy if exists "insignias_dadas_select" on public.insignias_dadas;
create policy "insignias_dadas_select" on public.insignias_dadas
  for select to authenticated using (true);

revoke insert, update, delete on public.insignias_dadas from anon, authenticated;
grant select on public.insignias_dadas to authenticated;

-- ---------- Crearlas ----------
create or replace function public.admin_crear_insignia(
  p_nombre text,
  p_detalle text,
  p_icon text default 'star',
  p_tono text default 'oro'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;

  insert into insignias (nombre, detalle, icon, tono, created_by)
  values (btrim(p_nombre), btrim(p_detalle),
          coalesce(nullif(btrim(p_icon), ''), 'star'),
          coalesce(nullif(btrim(p_tono), ''), 'oro'),
          auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_borrar_insignia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from insignias where id = p_id;
end;
$$;

-- ---------- Darlas y quitarlas ----------
create or replace function public.admin_dar_insignia(
  p_insignia uuid,
  p_user uuid,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;

  select nombre into v_nombre from insignias where id = p_insignia;
  if v_nombre is null then
    raise exception 'Esa insignia no existe.';
  end if;

  insert into insignias_dadas (insignia_id, user_id, motivo, dada_por)
  values (p_insignia, p_user, nullif(btrim(coalesce(p_motivo, '')), ''), auth.uid())
  on conflict (insignia_id, user_id) do update
    set motivo = excluded.motivo;

  -- Avisar, que para eso se da. Si el aviso falla, la insignia se queda
  -- dada igual: dársela es lo que ha pedido el administrador.
  begin
    insert into notifications (user_id, actor_id, type, note)
    values (p_user, auth.uid(), 'badge', v_nombre);
  exception when others then null;
  end;
end;
$$;

create or replace function public.admin_quitar_insignia(p_insignia uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from insignias_dadas
   where insignia_id = p_insignia and user_id = p_user;
end;
$$;

revoke all on function public.admin_crear_insignia(text, text, text, text) from anon, public;
revoke all on function public.admin_borrar_insignia(uuid) from anon, public;
revoke all on function public.admin_dar_insignia(uuid, uuid, text) from anon, public;
revoke all on function public.admin_quitar_insignia(uuid, uuid) from anon, public;
grant execute on function public.admin_crear_insignia(text, text, text, text) to authenticated;
grant execute on function public.admin_borrar_insignia(uuid) to authenticated;
grant execute on function public.admin_dar_insignia(uuid, uuid, text) to authenticated;
grant execute on function public.admin_quitar_insignia(uuid, uuid) to authenticated;

-- ---------- El aviso ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention', 'mention_wait',
                  'reply_sworn', 'all_ready', 'badge'));

create or replace function public.notification_pref_allows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.notification_prefs%rowtype;
begin
  select * into prefs from public.notification_prefs where user_id = new.user_id;
  if not found then
    return new;
  end if;

  if (new.type in ('reply', 'reply_sworn') and not prefs.reply)
  or (new.type = 'follow'         and not prefs.follow)
  or (new.type = 'poll'           and not prefs.poll)
  or (new.type = 'unlock'         and not prefs.unlock)
  or (new.type = 'book_done'      and not prefs.book_done)
  or (new.type = 'reaction'       and not prefs.reaction)
  or (new.type = 'new_idea'       and not prefs.new_idea)
  or (new.type = 'captain'        and not prefs.captain)
  or (new.type = 'next_book'      and not prefs.next_book)
  or (new.type = 'recommendation' and not prefs.recommendation)
  or (new.type in ('mention', 'mention_wait') and not prefs.mention)
  then
    return null;
  end if;
  -- 'badge' y 'moderation' no se pueden silenciar: son cosas que alguien
  -- ha decidido decirte a mano.
  return new;
end;
$$;

-- ---------- Lo que ve la app ----------
-- Todas las insignias a mano que existen, con quién las tiene. Se enseñan
-- también las que NO tienes: una vitrina con huecos es lo que hace que
-- quieras uno de esos huecos.
create or replace function public.insignias_a_mano()
returns table (
  id uuid,
  nombre text,
  detalle text,
  icon text,
  tono text,
  cuantos int,
  la_tengo boolean,
  mi_motivo text,
  quien text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.nombre, i.detalle, i.icon, i.tono,
    (select count(*)::int from insignias_dadas d where d.insignia_id = i.id),
    exists (
      select 1 from insignias_dadas d
       where d.insignia_id = i.id and d.user_id = auth.uid()
    ),
    (select d.motivo from insignias_dadas d
      where d.insignia_id = i.id and d.user_id = auth.uid()),
    coalesce((
      select array_agg(p.display_name order by d.created_at)
        from insignias_dadas d
        join profiles p on p.id = d.user_id
       where d.insignia_id = i.id
    ), array[]::text[])
  from insignias i
  order by i.created_at;
$$;

revoke all on function public.insignias_a_mano() from anon, public;
grant execute on function public.insignias_a_mano() to authenticated;

-- Las de una persona concreta, para su perfil público
create or replace function public.insignias_de(p_user uuid)
returns table (
  id uuid,
  nombre text,
  detalle text,
  icon text,
  tono text,
  motivo text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.detalle, i.icon, i.tono, d.motivo, d.created_at
    from insignias_dadas d
    join insignias i on i.id = d.insignia_id
   where d.user_id = p_user
   order by d.created_at desc;
$$;

revoke all on function public.insignias_de(uuid) from anon, public;
grant execute on function public.insignias_de(uuid) to authenticated;
