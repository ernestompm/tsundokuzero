-- ============================================================
-- 023 · Notificaciones push (Web Push)
--
-- Piezas:
--   1) push_subscriptions: los dispositivos de cada usuario
--      (endpoint + claves de cifrado del navegador). RLS: solo
--      el dueño gestiona los suyos.
--   2) Trigger AFTER INSERT en notifications que llama (vía
--      pg_net, asíncrono) a la Edge Function send-push.
--      · Corre DESPUÉS del filtro de preferencias (migr. 018,
--        BEFORE): lo silenciado jamás llega aquí.
--      · Solo llama si el destinatario tiene algún dispositivo.
--      · Cualquier fallo se traga: el push nunca puede impedir
--        que se cree el aviso.
--
-- La cabecera lleva el anon key (público por diseño: viaja en
-- el bundle del cliente). La Edge Function NO se fía del
-- payload: relee la notificación con service role antes de
-- enviar nada.
--
-- Requiere: desplegar la función send-push y sus secretos
-- (VAPID_PRIVATE_KEY, VAPID_SUBJECT) — ver supabase/functions/.
-- ============================================================

create extension if not exists pg_net;

-- ------------------------------------------------------------
-- 1) Dispositivos suscritos
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own"
  on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ------------------------------------------------------------
-- 2) Aviso nuevo → Edge Function (asíncrono, tolerante a fallos)
-- ------------------------------------------------------------
create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin dispositivos no hay nada que enviar (ahorra invocaciones)
  if exists (
    select 1 from public.push_subscriptions s where s.user_id = new.user_id
  ) then
    begin
      perform net.http_post(
        url := 'https://rigiljswurolsockpkfv.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2lsanN3dXJvbHNvY2twa2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzA4MzYsImV4cCI6MjA5OTQ0NjgzNn0.SzDv5OgmSzdejoOHEYaJjc-xr59LVPD-hCZoGPFMhVk'
        ),
        body := jsonb_build_object('notification_id', new.id)
      );
    exception
      when others then null; -- jamás tumbar la creación del aviso
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_send_push() from public, anon, authenticated;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.notify_send_push();
