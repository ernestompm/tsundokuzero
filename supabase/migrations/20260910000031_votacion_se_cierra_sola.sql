-- =====================================================================
-- 031 · La votación se cierra sola, y terminar un libro empalma con el
--       siguiente en un solo gesto
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- PROBLEMA
-- --------
-- La votación solo se cerraba si el capitán se acordaba de entrar y
-- pulsar un botón. Si se despistaba, el club se quedaba esperando con
-- todos los votos ya echados. Y el ciclo completo (votar, empezar,
-- terminar, encadenar con el siguiente) pedía cuatro decisiones distintas
-- del capitán en cuatro momentos distintos.
--
-- SOLUCIÓN
-- --------
--  1. En cuanto vota la última persona, la votación se cierra sola. Es el
--     caso bueno y no hace falta esperar a nadie.
--  2. Si llega la fecha de cierre, se cierra igualmente. Se comprueba de
--     forma perezosa al abrir el club, sin planificador, igual que el
--     relevo de capitanía de la migración 029.
--  3. `finish_and_start_next()`: terminar la lectura y arrancar la
--     siguiente en una sola transacción, para que el capitán no tenga que
--     hacer dos viajes.
-- =====================================================================

-- ---------- 1 · Cerrar una votación (uso interno) ----------
-- El trigger `handle_poll_close` (BEFORE UPDATE) ya calcula la ganadora,
-- la deja como próxima lectura y avisa al club. Aquí solo se dispara.
create or replace function public.close_poll(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update polls set status = 'closed' where id = p_poll and status = 'open';
end;
$$;

revoke all on function public.close_poll(uuid) from anon, public, authenticated;

-- ---------- 2 · Ha votado todo el club: se cierra al momento ----------
create or replace function public.close_poll_when_everyone_voted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_miembros int;
  v_votos int;
begin
  select p.club_id into v_club from polls p
   where p.id = new.poll_id and p.status = 'open';
  if v_club is null then
    return new;  -- la votación ya estaba cerrada
  end if;

  select count(*) into v_miembros from club_members where club_id = v_club;
  select count(*) into v_votos from poll_votes where poll_id = new.poll_id;

  if v_miembros > 0 and v_votos >= v_miembros then
    perform public.close_poll(new.poll_id);
  end if;
  return new;
end;
$$;

drop trigger if exists poll_votes_close_when_full on public.poll_votes;
create trigger poll_votes_close_when_full
  after insert or update on public.poll_votes
  for each row execute function public.close_poll_when_everyone_voted();

-- ---------- 3 · Ha llegado la fecha: cierre perezoso ----------
-- La llama cualquier miembro al abrir el club. Sin planificador.
create or replace function public.close_poll_if_due()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_poll uuid;
begin
  select cm.club_id into v_club
    from club_members cm where cm.user_id = auth.uid() limit 1;
  if v_club is null then return null; end if;

  -- Un solo cierre aunque entren varios a la vez
  perform pg_advisory_xact_lock(hashtextextended('poll:' || v_club::text, 0));

  select p.id into v_poll
    from polls p
   where p.club_id = v_club
     and p.status = 'open'
     and p.closes_at is not null
     and p.closes_at <= now()
   limit 1;

  if v_poll is null then return null; end if;

  perform public.close_poll(v_poll);
  return v_poll;
end;
$$;

revoke all on function public.close_poll_if_due() from anon, public;
grant execute on function public.close_poll_if_due() to authenticated;

-- Cierre de las votaciones que ya estuvieran vencidas antes de esto
do $$
declare r record;
begin
  for r in select id from polls where status = 'open'
            and closes_at is not null and closes_at <= now()
  loop
    perform public.close_poll(r.id);
  end loop;
end $$;

-- ---------- 4 · Terminar y empezar la siguiente, de un tirón ----------
create or replace function public.finish_and_start_next()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_next uuid;
  v_relevo uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain' limit 1;
  if v_club is null and public.is_super_admin() then
    select id into v_club from clubs order by created_at limit 1;
  end if;
  if v_club is null then
    raise exception 'forbidden: solo el capitán puede cerrar la lectura';
  end if;

  select next_book_id into v_next from clubs where id = v_club;

  -- Estrenar las reseñas de lo que se cierra
  update club_readings
     set premiered_at = coalesce(premiered_at, now())
   where club_id = v_club and closed_at is null;

  -- El trigger de clubs cierra la lectura vieja y abre la nueva
  update clubs
     set current_book_id = v_next,
         next_book_id = null,
         next_starts_at = null
   where id = v_club;

  -- Capitanía «por libro»: cerrar el libro es el fin del mandato
  if exists (
    select 1 from clubs c
     where c.id = v_club and c.captain_term = 'book' and c.captain_mode <> 'manual'
  ) then
    v_relevo := public.next_captain_id(v_club);
    if v_relevo is not null then
      perform public.assign_captain(v_club, v_relevo);
    end if;
  end if;

  return v_next;
end;
$$;

revoke all on function public.finish_and_start_next() from anon, public;
grant execute on function public.finish_and_start_next() to authenticated;

-- ---------- 5 · Cuánta gente ha votado ya ----------
-- Para poder decir «4 de 6 han votado» sin que el cliente haga cuentas.
create or replace view public.poll_progress as
select
  p.id as poll_id,
  p.club_id,
  p.title,
  p.status,
  p.closes_at,
  (select count(*) from club_members cm where cm.club_id = p.club_id)::int as miembros,
  (select count(*) from poll_votes v where v.poll_id = p.id)::int as votos
from polls p;

alter view public.poll_progress set (security_invoker = true);
grant select on public.poll_progress to authenticated;
