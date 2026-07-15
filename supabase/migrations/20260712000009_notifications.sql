-- =====================================================================
-- Tsundoku Zero — Notificaciones + títulos de capítulo públicos
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
--  1. Notificaciones (respuestas, nuevos seguidores, votaciones) con
--     triggers en servidor. El texto de la respuesta NO se incluye:
--     la notificación te lleva al hilo y allí el gate decide.
--  2. Los títulos de capítulos vuelven a ser visibles: son el índice
--     del libro físico (quien tiene el libro ya los ha visto). El
--     candado protege las conversaciones, no el índice.
-- =====================================================================

-- ---------- 1 · Notificaciones ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('reply', 'follow', 'poll')),
  discussion_id uuid references discussions(id) on delete cascade,
  poll_id uuid references polls(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own" on notifications for delete to authenticated
  using (user_id = auth.uid());

-- Respuesta a tu idea → notificación al autor del hilo
create or replace function public.notify_on_reply()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  thread_author uuid;
begin
  select author_id into thread_author from discussions where id = new.discussion_id;
  if thread_author is not null and thread_author <> new.author_id then
    insert into notifications (user_id, actor_id, type, discussion_id)
    values (thread_author, new.author_id, 'reply', new.discussion_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_reply_after_insert on discussion_comments;
create trigger notify_reply_after_insert
  after insert on discussion_comments
  for each row execute function public.notify_on_reply();

-- Nuevo seguidor → notificación (se omite el auto-follow masivo del club,
-- que corre anidado dentro del trigger de club_members)
create or replace function public.notify_on_follow()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    insert into notifications (user_id, actor_id, type)
    values (new.followed_id, new.follower_id, 'follow');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_follow_after_insert on follows;
create trigger notify_follow_after_insert
  after insert on follows
  for each row execute function public.notify_on_follow();

-- Nueva votación → notificación a todos los miembros del club
create or replace function public.notify_on_poll()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, actor_id, type, poll_id)
  select cm.user_id, new.created_by, 'poll', new.id
    from club_members cm
   where cm.club_id = new.club_id
     and cm.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000');
  return new;
end;
$$;

drop trigger if exists notify_poll_after_insert on polls;
create trigger notify_poll_after_insert
  after insert on polls
  for each row execute function public.notify_on_poll();

-- ---------- 2 · Títulos de capítulo = índice público ----------
drop policy if exists "chapters_select_gate" on chapters;
drop policy if exists "chapters_select" on chapters;
create policy "chapters_select" on chapters for select to authenticated
  using (true);
