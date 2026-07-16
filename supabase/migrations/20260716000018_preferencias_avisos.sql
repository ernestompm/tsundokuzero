-- ============================================================
-- 018 · Centro de avisos: cada usuario elige qué notificaciones
--       recibe. Un ÚNICO punto de filtrado en el servidor: un
--       trigger BEFORE INSERT sobre notifications descarta las
--       que el destinatario tiene apagadas — vale para todos los
--       orígenes actuales (reply/follow/poll/unlock/book_done) y
--       para cualquier tipo futuro.
-- ============================================================

create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reply boolean not null default true,
  follow boolean not null default true,
  poll boolean not null default true,
  unlock boolean not null default true,
  book_done boolean not null default true
);

alter table public.notification_prefs enable row level security;

-- Solo el dueño ve y edita sus preferencias
drop policy if exists "notif_prefs_select_own" on public.notification_prefs;
create policy "notif_prefs_select_own"
  on public.notification_prefs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notif_prefs_insert_own" on public.notification_prefs;
create policy "notif_prefs_insert_own"
  on public.notification_prefs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "notif_prefs_update_own" on public.notification_prefs;
create policy "notif_prefs_update_own"
  on public.notification_prefs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;

-- ------------------------------------------------------------
-- Filtro único: si el destinatario apagó ese tipo, el aviso no
-- se crea. Sin fila de preferencias = todo activado (defaults).
-- ------------------------------------------------------------
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
  then
    return null; -- descartado en silencio
  end if;

  return new;
end;
$$;

revoke all on function public.notification_pref_allows() from public, anon, authenticated;

drop trigger if exists notifications_pref_filter on public.notifications;
create trigger notifications_pref_filter
  before insert on public.notifications
  for each row execute function public.notification_pref_allows();
