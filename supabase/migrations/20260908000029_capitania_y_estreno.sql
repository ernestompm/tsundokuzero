-- =====================================================================
-- 029 · Capitanía con reglas + «el estreno» de las reseñas
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- 1) CAPITANÍA
--    Hasta ahora la capitanía solo se traspasaba a mano y solo la podía
--    mover el capitán saliente, lo que obliga a negociarlo fuera de la
--    app. Ahora el club elige cómo se reparte:
--      · manual   → lo asigna el administrador o el capitán
--      · aleatorio→ le toca a alguien al azar, sin repetir hasta que
--                   hayan pasado todos
--      · turno    → rota en orden de entrada al club
--    Y cuánto dura el mandato:
--      · por tiempo → N días, meses o años
--      · por libro  → hasta que se cierra la lectura, con un máximo de
--                     días para que un libro eterno no bloquee el relevo
--
--    Sin planificador: el relevo se comprueba de forma perezosa cuando
--    alguien abre el club (`rotate_captain_if_due`). Así no hace falta
--    pg_cron ni ninguna pieza externa.
--
-- 2) EL ESTRENO
--    Las reseñas dejan de abrirse cuando TÚ terminas y pasan a abrirse
--    cuando TERMINA EL CLUB, todas a la vez. Terminar un libro deja de
--    ser algo que te pasa a ti solo y se convierte en una fecha común.
--    Con dos escapes para que nadie se quede encerrado: el capitán puede
--    estrenar a mano, y cerrar la lectura estrena también.
-- =====================================================================

-- =====================================================================
-- PARTE 1 · CAPITANÍA
-- =====================================================================

alter table public.clubs
  add column if not exists captain_mode text not null default 'manual'
    check (captain_mode in ('manual', 'random', 'rotation')),
  add column if not exists captain_term text not null default 'book'
    check (captain_term in ('time', 'book')),
  add column if not exists captain_term_unit text not null default 'month'
    check (captain_term_unit in ('day', 'month', 'year')),
  add column if not exists captain_term_count int not null default 1
    check (captain_term_count between 1 and 60),
  -- Tope de días de una capitanía «por libro»: si el libro se eterniza,
  -- se cierra igualmente y entra el siguiente capitán. null = sin tope.
  add column if not exists captain_max_days int
    check (captain_max_days is null or captain_max_days between 1 and 3650),
  add column if not exists captain_term_ends_at timestamptz;

-- Recuerdo de quién ya ha sido capitán, para que el azar no repita
alter table public.club_members
  add column if not exists last_captain_at timestamptz;

-- Fin de mandato a partir de la política del club
create or replace function public.captain_term_end(p_club uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare c record;
begin
  select * into c from clubs where id = p_club;
  if c is null then return null; end if;

  if c.captain_term = 'time' then
    return now() + case c.captain_term_unit
      when 'day'   then make_interval(days   => c.captain_term_count)
      when 'month' then make_interval(months => c.captain_term_count)
      when 'year'  then make_interval(years  => c.captain_term_count)
    end;
  end if;

  -- Por libro: el fin lo marca el cierre de la lectura. El tope de días,
  -- si lo hay, es solo la red de seguridad.
  if c.captain_max_days is not null then
    return now() + make_interval(days => c.captain_max_days);
  end if;
  return null;
end;
$$;

-- A quién le toca según el modo. Devuelve null si no hay relevo posible.
create or replace function public.next_captain_id(p_club uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_actual uuid;
  v_next uuid;
  v_total int;
begin
  select captain_mode into v_mode from clubs where id = p_club;
  select user_id into v_actual
    from club_members where club_id = p_club and role = 'captain' limit 1;
  select count(*) into v_total from club_members where club_id = p_club;
  if v_total < 2 then return null; end if;

  if v_mode = 'rotation' then
    -- Orden de entrada al club, dando la vuelta al llegar al final
    select user_id into v_next
      from club_members
     where club_id = p_club
       and (v_actual is null or joined_at > (
             select joined_at from club_members
              where club_id = p_club and user_id = v_actual))
     order by joined_at asc
     limit 1;
    if v_next is null then
      select user_id into v_next
        from club_members where club_id = p_club
        order by joined_at asc limit 1;
    end if;
    return v_next;
  end if;

  if v_mode = 'random' then
    -- Primero quienes nunca han sido capitán; entre iguales, al azar
    select user_id into v_next
      from club_members
     where club_id = p_club
       and (v_actual is null or user_id <> v_actual)
     order by last_captain_at asc nulls first, random()
     limit 1;
    return v_next;
  end if;

  return null;  -- manual: no hay relevo automático
end;
$$;

-- Mínimo privilegio en las auxiliares: al crearse, una función queda
-- ejecutable por PUBLIC, y eso incluye a anon (misma causa raíz que la
-- vulnerabilidad que cerró la migr. 022).
revoke all on function public.captain_term_end(uuid) from anon, public;
revoke all on function public.next_captain_id(uuid) from anon, public;
-- next_captain_id sí la necesita la app: muestra a quién le toca después
grant execute on function public.next_captain_id(uuid) to authenticated;

-- Asignar capitán. La usa tanto el relevo automático como el manual.
create or replace function public.assign_captain(p_club uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from club_members where club_id = p_club and user_id = p_user
  ) then
    raise exception 'Esa persona no es miembro del club.';
  end if;

  -- El saliente queda marcado para que el azar no le vuelva a tocar ya
  update club_members
     set role = 'member', last_captain_at = now()
   where club_id = p_club and role = 'captain';

  update club_members
     set role = 'captain', captain_since = now(), last_captain_at = now()
   where club_id = p_club and user_id = p_user;

  update clubs
     set captain_term_ends_at = public.captain_term_end(p_club)
   where id = p_club;

  insert into notifications (user_id, type, club_id)
  select cm.user_id, 'captain', p_club
    from club_members cm
   where cm.club_id = p_club;
end;
$$;

revoke all on function public.assign_captain(uuid, uuid) from anon, public, authenticated;

-- Asignación a mano: administrador o capitán actual
create or replace function public.set_captain(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_club uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select id into v_club from clubs order by created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán o un administrador';
  end if;
  perform public.assign_captain(v_club, p_user);
end;
$$;

revoke all on function public.set_captain(uuid) from anon, public;
grant execute on function public.set_captain(uuid) to authenticated;

-- Configurar la política. Administrador o capitán actual.
create or replace function public.set_captain_policy(
  p_mode text,
  p_term text,
  p_unit text default 'month',
  p_count int default 1,
  p_max_days int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_club uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select id into v_club from clubs order by created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán o un administrador';
  end if;

  if p_mode not in ('manual', 'random', 'rotation') then
    raise exception 'Modo de capitanía no válido.';
  end if;
  if p_term not in ('time', 'book') then
    raise exception 'Duración de capitanía no válida.';
  end if;
  if p_unit not in ('day', 'month', 'year') then
    raise exception 'Unidad de tiempo no válida.';
  end if;
  if p_count is null or p_count < 1 or p_count > 60 then
    raise exception 'La duración debe estar entre 1 y 60.';
  end if;
  if p_max_days is not null and (p_max_days < 1 or p_max_days > 3650) then
    raise exception 'El máximo de días debe estar entre 1 y 3650.';
  end if;

  update clubs
     set captain_mode = p_mode,
         captain_term = p_term,
         captain_term_unit = p_unit,
         captain_term_count = p_count,
         captain_max_days = p_max_days
   where id = v_club;

  -- El mandato en curso se recalcula desde ya con la política nueva
  update clubs
     set captain_term_ends_at = public.captain_term_end(v_club)
   where id = v_club;
end;
$$;

revoke all on function public.set_captain_policy(text, text, text, int, int)
  from anon, public;
grant execute on function public.set_captain_policy(text, text, text, int, int)
  to authenticated;

-- Relevo perezoso: lo llama cualquier miembro al abrir el club. Si el
-- mandato ha vencido y el modo es automático, cambia de capitán.
create or replace function public.rotate_captain_if_due()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_club uuid;
  v_next uuid;
begin
  select cm.club_id into v_club
    from club_members cm where cm.user_id = auth.uid() limit 1;
  if v_club is null then return null; end if;

  -- Un solo relevo aunque entren diez personas a la vez
  perform pg_advisory_xact_lock(hashtextextended(v_club::text, 0));

  select * into c from clubs where id = v_club;
  if c.captain_mode = 'manual' then return null; end if;
  if c.captain_term_ends_at is null or now() < c.captain_term_ends_at then
    return null;
  end if;

  v_next := public.next_captain_id(v_club);
  if v_next is null then return null; end if;

  -- Capitanía por libro vencida por el tope: se cierra la lectura
  if c.captain_term = 'book' and c.current_book_id is not null then
    update club_readings set closed_at = now()
     where club_id = v_club and closed_at is null;
    update clubs set current_book_id = null where id = v_club;
  end if;

  perform public.assign_captain(v_club, v_next);
  return v_next;
end;
$$;

revoke all on function public.rotate_captain_if_due() from anon, public;
grant execute on function public.rotate_captain_if_due() to authenticated;

-- El aviso de relevo necesita su tipo y su preferencia
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain'));
alter table public.notifications
  add column if not exists club_id uuid references clubs(id) on delete cascade;
alter table public.notification_prefs
  add column if not exists captain boolean not null default true;

-- Mandato inicial para los clubes que ya existen
update clubs c
   set captain_term_ends_at = public.captain_term_end(c.id)
 where c.captain_term_ends_at is null
   and exists (select 1 from club_members m
                where m.club_id = c.id and m.role = 'captain');

-- =====================================================================
-- PARTE 2 · EL ESTRENO
-- =====================================================================

alter table public.club_readings
  add column if not exists premiered_at timestamptz;

comment on column public.club_readings.premiered_at is
  'Momento en que se abrieron las reseñas del club para este libro. null = todavía selladas.';

-- Las lecturas ya cerradas se dan por estrenadas: no tiene sentido
-- sellar reseñas de libros que el club dejó atrás antes de esta función.
update public.club_readings
   set premiered_at = coalesce(closed_at, now())
 where premiered_at is null and closed_at is not null;

-- Cuando termina la última persona del club, se estrena solo
create or replace function public.notify_book_finished_by_all()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cl record;
  total int;
  done int;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    for cl in select id from clubs where current_book_id = new.book_id loop
      select count(*) into total from club_members where club_id = cl.id;
      select count(*) into done
        from club_members m
        join reading_progress rp
          on rp.user_id = m.user_id and rp.book_id = new.book_id
       where m.club_id = cl.id and rp.status = 'finished';

      if total > 0 and done >= total then
        -- El estreno: se abren todas las reseñas a la vez
        update club_readings
           set premiered_at = now()
         where club_id = cl.id and book_id = new.book_id and premiered_at is null;

        insert into notifications (user_id, type, book_id)
        select m.user_id, 'book_done', new.book_id from club_members m
         where m.club_id = cl.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Escape 1: el capitán estrena a mano cuando alguien no va a terminar
create or replace function public.premiere_reviews()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_book uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select id into v_club from clubs order by created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán puede estrenar las reseñas';
  end if;

  select book_id into v_book
    from club_readings
   where club_id = v_club and closed_at is null
   limit 1;
  if v_book is null then
    raise exception 'El club no tiene ninguna lectura abierta.';
  end if;

  update club_readings
     set premiered_at = now()
   where club_id = v_club and book_id = v_book and premiered_at is null;

  insert into notifications (user_id, type, book_id)
  select cm.user_id, 'book_done', v_book
    from club_members cm where cm.club_id = v_club;
end;
$$;

revoke all on function public.premiere_reviews() from anon, public;
grant execute on function public.premiere_reviews() to authenticated;

-- Escape 2: cerrar la lectura estrena también, y releva si toca
create or replace function public.close_club_reading()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_next uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select c.id into v_club from clubs c order by c.created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán puede cerrar la lectura';
  end if;

  update club_readings
     set premiered_at = coalesce(premiered_at, now())
   where club_id = v_club and closed_at is null;

  -- El trigger de clubs cierra la fila abierta al quedarse sin libro
  update clubs set current_book_id = null where id = v_club;

  -- Capitanía «por libro»: cerrar el libro es el fin del mandato
  if exists (
    select 1 from clubs c
     where c.id = v_club and c.captain_term = 'book' and c.captain_mode <> 'manual'
  ) then
    v_next := public.next_captain_id(v_club);
    if v_next is not null then
      perform public.assign_captain(v_club, v_next);
    end if;
  end if;
end;
$$;

revoke all on function public.close_club_reading() from anon, public;
grant execute on function public.close_club_reading() to authenticated;

-- La vista aprende el estreno: si el libro es lectura de un club tuyo y
-- todavía no se ha estrenado, el texto ajeno sigue sellado aunque hayas
-- terminado. Los libros que lees por tu cuenta se abren como siempre.
drop view if exists public.book_reviews;
create view public.book_reviews as
select
  r.book_id,
  r.user_id,
  r.rating,
  r.d_think,
  r.d_flow,
  r.d_feel,
  r.d_recommend,
  r.created_at,
  (r.review is not null and length(trim(r.review)) > 0) as has_review,
  not exists (
    select 1
      from club_readings cr
      join club_members cm
        on cm.club_id = cr.club_id and cm.user_id = auth.uid()
     where cr.book_id = r.book_id and cr.premiered_at is null
  ) as premiered,
  case
    when r.user_id = auth.uid() then r.review
    when exists (
           select 1 from reading_progress rp
            where rp.user_id = auth.uid()
              and rp.book_id = r.book_id
              and rp.status = 'finished'
         )
     and not exists (
           select 1
             from club_readings cr
             join club_members cm
               on cm.club_id = cr.club_id and cm.user_id = auth.uid()
            where cr.book_id = r.book_id and cr.premiered_at is null
         )
    then r.review
  end as review
from book_ratings r;

alter view public.book_reviews set (security_invoker = false);
revoke all on public.book_reviews from anon, authenticated;
grant select on public.book_reviews to authenticated;

-- El filtro único de avisos (migr. 018) aprende el tipo 'captain'
create or replace function public.notification_pref_allows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.notification_prefs%rowtype;
begin
  select * into prefs
  from public.notification_prefs
  where user_id = new.user_id;

  if not found then
    return new; -- sin preferencias guardadas: se avisa de todo
  end if;

  if (new.type = 'reply'     and not prefs.reply)
  or (new.type = 'follow'    and not prefs.follow)
  or (new.type = 'poll'      and not prefs.poll)
  or (new.type = 'unlock'    and not prefs.unlock)
  or (new.type = 'book_done' and not prefs.book_done)
  or (new.type = 'reaction'  and not prefs.reaction)
  or (new.type = 'new_idea'  and not prefs.new_idea)
  or (new.type = 'captain'   and not prefs.captain)
  then
    return null; -- descartado en silencio
  end if;

  return new;
end;
$$;
