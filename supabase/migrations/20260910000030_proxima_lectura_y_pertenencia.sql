-- =====================================================================
-- 030 · Próxima lectura, pertenencia al club e insignias
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- De la reseña de un usuario:
--   1. «Falta una próxima lectura, donde se vea el libro ya elegido pero
--      todavía no abierto, para poder ir comprándolo.»
--   2. «Falta potenciar el sentido de pertenencia al club.»
--   3. «Falta un sistema de insignias que reconozca a los lectores.»
--
-- El punto 1 destapa además un fallo de fondo: al cerrar una votación, la
-- ganadora sustituía AL INSTANTE al libro del club, aunque la mitad del
-- club fuera por la página cien del anterior. Lo correcto es que la
-- ganadora quede como PRÓXIMA y que el capitán arranque la lectura cuando
-- toque. Eso es justo lo que pedía la reseña.
-- =====================================================================

-- ---------- 1 · La próxima lectura ----------
alter table public.clubs
  add column if not exists next_book_id uuid references books(id) on delete set null,
  add column if not exists next_starts_at timestamptz;

comment on column public.clubs.next_book_id is
  'Libro ya elegido que todavía no se ha empezado. Sirve para que la gente lo vaya comprando.';

-- Aviso propio: «ya tenemos el próximo libro»
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain', 'next_book'));
alter table public.notification_prefs
  add column if not exists next_book boolean not null default true;

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

  if (new.type = 'reply'     and not prefs.reply)
  or (new.type = 'follow'    and not prefs.follow)
  or (new.type = 'poll'      and not prefs.poll)
  or (new.type = 'unlock'    and not prefs.unlock)
  or (new.type = 'book_done' and not prefs.book_done)
  or (new.type = 'reaction'  and not prefs.reaction)
  or (new.type = 'new_idea'  and not prefs.new_idea)
  or (new.type = 'captain'   and not prefs.captain)
  or (new.type = 'next_book' and not prefs.next_book)
  then
    return null;
  end if;

  return new;
end;
$$;

-- Cerrar la votación deja la ganadora COMO PRÓXIMA, no como actual.
-- Excepción: si el club no está leyendo nada, se arranca ya, porque no
-- hay nada que terminar antes.
create or replace function public.handle_poll_close()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_book uuid;
  v_actual uuid;
begin
  if old.status = 'open' and new.status = 'closed' then
    if new.winner_option_id is null then
      select v.option_id into new.winner_option_id
        from poll_votes v
       where v.poll_id = new.id
       group by v.option_id
       order by count(*) desc, min(v.created_at) asc
       limit 1;
    end if;

    if new.winner_option_id is not null then
      select po.book_id into v_book
        from poll_options po where po.id = new.winner_option_id;

      if v_book is not null then
        select c.current_book_id into v_actual from clubs c where c.id = new.club_id;

        if v_actual is null then
          update clubs set current_book_id = v_book, next_book_id = null,
                           next_starts_at = null
           where id = new.club_id;
        else
          update clubs set next_book_id = v_book where id = new.club_id;
        end if;

        insert into notifications (user_id, type, book_id, club_id)
        select cm.user_id, 'next_book', v_book, new.club_id
          from club_members cm where cm.club_id = new.club_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- El capitán fija a mano la próxima lectura y cuándo se empieza
create or replace function public.set_next_book(
  p_book uuid,
  p_starts_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_antes uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select id into v_club from clubs order by created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán puede fijar la próxima lectura';
  end if;

  if p_book is not null and not exists (select 1 from books b where b.id = p_book) then
    raise exception 'Ese libro no está en el catálogo.';
  end if;

  select next_book_id into v_antes from clubs where id = v_club;

  update clubs
     set next_book_id = p_book,
         next_starts_at = p_starts_at
   where id = v_club;

  -- Solo se avisa si de verdad cambia, para no repetir el aviso al
  -- ajustar la fecha.
  if p_book is not null and p_book is distinct from v_antes then
    insert into notifications (user_id, type, book_id, club_id)
    select cm.user_id, 'next_book', p_book, v_club
      from club_members cm where cm.club_id = v_club;
  end if;
end;
$$;

revoke all on function public.set_next_book(uuid, timestamptz) from anon, public;
grant execute on function public.set_next_book(uuid, timestamptz) to authenticated;

-- Arrancar la próxima lectura: pasa a ser el libro del club
create or replace function public.start_next_reading()
returns uuid
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
    raise exception 'forbidden: solo el capitán puede empezar la lectura';
  end if;

  select next_book_id into v_book from clubs where id = v_club;
  if v_book is null then
    raise exception 'No hay ninguna próxima lectura elegida.';
  end if;

  -- Cerrar y estrenar lo anterior antes de cambiar (el trigger de clubs
  -- se encarga del historial)
  update club_readings
     set premiered_at = coalesce(premiered_at, now())
   where club_id = v_club and closed_at is null;

  update clubs
     set current_book_id = v_book,
         next_book_id = null,
         next_starts_at = null
   where id = v_club;

  return v_book;
end;
$$;

revoke all on function public.start_next_reading() from anon, public;
grant execute on function public.start_next_reading() to authenticated;

-- ---------- 2 · Pertenencia e insignias ----------
-- Todo se DERIVA de lo que ya hay. Sin tabla de premios ni triggers que
-- se puedan desincronizar: si los datos cambian, las insignias cambian.
create or replace view public.club_member_stats as
select
  cm.club_id,
  cm.user_id,
  cm.joined_at,
  cm.role,
  cm.last_captain_at,

  -- Puesto de llegada al club: 1 = fundador
  (select count(*) + 1 from club_members m2
    where m2.club_id = cm.club_id and m2.joined_at < cm.joined_at)::int
    as orden_llegada,

  -- Libros del club que ha terminado
  (select count(*) from club_readings cr
     join reading_progress rp
       on rp.book_id = cr.book_id and rp.user_id = cm.user_id
    where cr.club_id = cm.club_id and rp.status = 'finished')::int
    as libros_terminados,

  -- Veces que ha sido el primero del club en terminar un libro
  (select count(*) from club_readings cr
    where cr.club_id = cm.club_id
      and cm.user_id = (
        select rp.user_id
          from reading_progress rp
          join club_members m3
            on m3.user_id = rp.user_id and m3.club_id = cm.club_id
         where rp.book_id = cr.book_id and rp.status = 'finished'
         order by rp.updated_at asc
         limit 1
      ))::int
    as veces_primero,

  -- Libros que ha propuesto como capitán
  (select count(*) from club_readings cr
    where cr.club_id = cm.club_id and cr.proposed_by = cm.user_id)::int
    as libros_propuestos,

  -- Ideas publicadas
  (select count(*) from discussions d where d.author_id = cm.user_id)::int
    as ideas,

  -- Reseñas escritas
  (select count(*) from book_ratings br
    where br.user_id = cm.user_id
      and br.review is not null and length(btrim(br.review)) > 0)::int
    as resenas

from club_members cm;

alter view public.club_member_stats set (security_invoker = true);
grant select on public.club_member_stats to authenticated;

-- Resumen del club para la tira de pertenencia del Inicio
create or replace view public.club_summary as
select
  c.id as club_id,
  c.name,
  c.created_at,
  (select count(*) from club_members m where m.club_id = c.id)::int as miembros,
  (select count(*) from club_readings cr
    where cr.club_id = c.id and cr.closed_at is not null)::int as libros_leidos
from clubs c;

alter view public.club_summary set (security_invoker = true);
grant select on public.club_summary to authenticated;
