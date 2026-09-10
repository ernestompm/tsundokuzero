-- =====================================================================
-- 034 · Recomendar un libro a alguien, y afinidad lectora
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- POR QUÉ
-- -------
-- Hasta ahora todo giraba alrededor del libro del mes. No había ni una
-- sola acción de una persona hacia OTRA persona. Recomendar es la
-- primera, y es la que convierte esto en una red social de lectura en vez
-- de en un tablón compartido.
--
-- La afinidad es su pareja: para recomendar bien hace falta saber qué le
-- gusta al otro, y con las cuatro dimensiones de valoración se puede
-- decir algo mucho más rico que un porcentaje.
-- =====================================================================

-- ---------- 1 · Recomendaciones ----------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  -- cuándo el destinatario hizo algo con ella (añadirla o descartarla)
  acted_at timestamptz,
  unique (from_user, to_user, book_id)
);

create index if not exists recommendations_to_idx
  on public.recommendations (to_user, created_at desc);

alter table public.recommendations enable row level security;

-- Solo la ves si te la mandaron o la mandaste tú
drop policy if exists "recommendations_select_mine" on public.recommendations;
create policy "recommendations_select_mine" on public.recommendations
  for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

-- El destinatario puede marcarla como atendida
drop policy if exists "recommendations_update_target" on public.recommendations;
create policy "recommendations_update_target" on public.recommendations
  for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());

-- Quien la mandó puede retirarla
drop policy if exists "recommendations_delete_author" on public.recommendations;
create policy "recommendations_delete_author" on public.recommendations
  for delete to authenticated using (from_user = auth.uid());

-- La escritura entra solo por la RPC, que es donde están las reglas
revoke insert on public.recommendations from anon, authenticated;
grant select, update, delete on public.recommendations to authenticated;

-- Aviso propio
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation'));
alter table public.notification_prefs
  add column if not exists recommendation boolean not null default true;

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

  if (new.type = 'reply'          and not prefs.reply)
  or (new.type = 'follow'         and not prefs.follow)
  or (new.type = 'poll'           and not prefs.poll)
  or (new.type = 'unlock'         and not prefs.unlock)
  or (new.type = 'book_done'      and not prefs.book_done)
  or (new.type = 'reaction'       and not prefs.reaction)
  or (new.type = 'new_idea'       and not prefs.new_idea)
  or (new.type = 'captain'        and not prefs.captain)
  or (new.type = 'next_book'      and not prefs.next_book)
  or (new.type = 'recommendation' and not prefs.recommendation)
  then
    return null;
  end if;

  return new;
end;
$$;

-- Recomendar. Solo a gente de tu club: es la relación que existe, y
-- evita convertir esto en un canal para mandar cosas a desconocidos.
create or replace function public.recommend_book(
  p_book uuid,
  p_to uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'forbidden: hace falta sesión';
  end if;
  if p_to = v_uid then
    raise exception 'No puedes recomendarte un libro a ti mismo.';
  end if;
  if length(v_note) > 300 then
    raise exception 'El mensaje es demasiado largo (máximo 300 caracteres).';
  end if;
  if not exists (select 1 from books b where b.id = p_book) then
    raise exception 'Ese libro no está en el catálogo.';
  end if;

  if not exists (
    select 1
      from club_members a
      join club_members b on b.club_id = a.club_id
     where a.user_id = v_uid and b.user_id = p_to
  ) then
    raise exception 'Solo puedes recomendar libros a gente de tu club.';
  end if;

  -- Bloqueos en cualquier dirección: no se cuela nada
  if exists (
    select 1 from blocks
     where (blocker_id = p_to and blocked_id = v_uid)
        or (blocker_id = v_uid and blocked_id = p_to)
  ) then
    raise exception 'No se puede enviar la recomendación.';
  end if;

  insert into recommendations as r (from_user, to_user, book_id, note)
  values (v_uid, p_to, p_book, v_note)
  on conflict (from_user, to_user, book_id) do update
    set note = excluded.note,
        created_at = now(),
        acted_at = null
  returning r.id into v_id;

  insert into notifications (user_id, actor_id, type, book_id)
  values (p_to, v_uid, 'recommendation', p_book);

  return v_id;
end;
$$;

revoke all on function public.recommend_book(uuid, uuid, text) from anon, public;
grant execute on function public.recommend_book(uuid, uuid, text) to authenticated;

-- ---------- 2 · Afinidad lectora ----------
-- Compara tus notas con las de otra persona en los libros que ambos
-- habéis puntuado. Con las cuatro dimensiones se puede decir algo con
-- sentido, no un porcentaje de esos que no significan nada.
create or replace function public.reading_affinity(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_comunes int;
  v_ambos int;
  v_mi_media numeric;
  v_su_media numeric;
begin
  if v_uid is null or p_user is null or p_user = v_uid then
    return '{}'::jsonb;
  end if;

  -- Libros que los dos habéis terminado
  select count(*) into v_comunes
    from reading_progress a
    join reading_progress b on b.book_id = a.book_id
   where a.user_id = v_uid and a.status = 'finished'
     and b.user_id = p_user and b.status = 'finished';

  -- Libros que los dos habéis puntuado (la base de la comparación)
  select count(*),
         round(avg(a.rating)::numeric, 2),
         round(avg(b.rating)::numeric, 2)
    into v_ambos, v_mi_media, v_su_media
    from book_ratings a
    join book_ratings b on b.book_id = a.book_id
   where a.user_id = v_uid and b.user_id = p_user;

  return jsonb_build_object(
    'finished_together', coalesce(v_comunes, 0),
    'both_rated', coalesce(v_ambos, 0),
    'my_avg', v_mi_media,
    'their_avg', v_su_media,

    -- Medias por dimensión, solo sobre los libros que ambos puntuasteis
    'dims', coalesce((
      select jsonb_object_agg(k, v) from (
        select 'think' as k,
               jsonb_build_object(
                 'mine',   round(avg(a.d_think)::numeric, 2),
                 'theirs', round(avg(b.d_think)::numeric, 2))  as v
          from book_ratings a join book_ratings b on b.book_id = a.book_id
         where a.user_id = v_uid and b.user_id = p_user
           and a.d_think is not null and b.d_think is not null
        union all
        select 'flow',
               jsonb_build_object(
                 'mine',   round(avg(a.d_flow)::numeric, 2),
                 'theirs', round(avg(b.d_flow)::numeric, 2))
          from book_ratings a join book_ratings b on b.book_id = a.book_id
         where a.user_id = v_uid and b.user_id = p_user
           and a.d_flow is not null and b.d_flow is not null
        union all
        select 'feel',
               jsonb_build_object(
                 'mine',   round(avg(a.d_feel)::numeric, 2),
                 'theirs', round(avg(b.d_feel)::numeric, 2))
          from book_ratings a join book_ratings b on b.book_id = a.book_id
         where a.user_id = v_uid and b.user_id = p_user
           and a.d_feel is not null and b.d_feel is not null
        union all
        select 'recommend',
               jsonb_build_object(
                 'mine',   round(avg(a.d_recommend)::numeric, 2),
                 'theirs', round(avg(b.d_recommend)::numeric, 2))
          from book_ratings a join book_ratings b on b.book_id = a.book_id
         where a.user_id = v_uid and b.user_id = p_user
           and a.d_recommend is not null and b.d_recommend is not null
      ) t where (v->>'mine') is not null
    ), '{}'::jsonb),

    -- Hasta tres libros que gustaron mucho a los dos: de qué hablar
    'shared_loves', coalesce((
      select jsonb_agg(jsonb_build_object('id', bk.id, 'title', bk.title)
                       order by (a.rating + b.rating) desc)
        from book_ratings a
        join book_ratings b on b.book_id = a.book_id
        join books bk on bk.id = a.book_id
       where a.user_id = v_uid and b.user_id = p_user
         and a.rating >= 4 and b.rating >= 4
       limit 3
    ), '[]'::jsonb),

    -- Y uno en el que no os pusisteis de acuerdo: aún mejor conversación
    'disagreement', (
      select jsonb_build_object(
               'id', bk.id, 'title', bk.title,
               'mine', a.rating, 'theirs', b.rating)
        from book_ratings a
        join book_ratings b on b.book_id = a.book_id
        join books bk on bk.id = a.book_id
       where a.user_id = v_uid and b.user_id = p_user
         and abs(a.rating - b.rating) >= 2
       order by abs(a.rating - b.rating) desc
       limit 1
    )
  );
end;
$$;

revoke all on function public.reading_affinity(uuid) from anon, public;
grant execute on function public.reading_affinity(uuid) to authenticated;
