-- =====================================================================
-- 019 · Datos del titular editables desde el panel de administración
-- EJECUTAR ENTERO en el SQL Editor. Idempotente (re-ejecutable).
--
-- Los textos legales (/legal/*) llevan tokens ([NOMBRE O RAZÓN SOCIAL],
-- [NIF], [DOMICILIO], [EMAIL DE CONTACTO]…) que se sustituyen al
-- renderizar con los valores de esta tabla. El super admin los rellena
-- en Administración → Legal, sin tocar código ni redeploy.
--
-- Lectura ANÓNIMA: las páginas legales son públicas (LSSI art. 10).
-- Escritura: solo super admins.
-- =====================================================================

create table if not exists app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "app_settings_read" on app_settings;
create policy "app_settings_read" on app_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "app_settings_admin_insert" on app_settings;
create policy "app_settings_admin_insert" on app_settings for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "app_settings_admin_update" on app_settings;
create policy "app_settings_admin_update" on app_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "app_settings_admin_delete" on app_settings;
create policy "app_settings_admin_delete" on app_settings for delete to authenticated
  using (public.is_super_admin());

-- OJO: aquí solo van datos PÚBLICOS (identidad del prestador, LSSI
-- art. 10). Jamás guardar secretos en esta tabla: la lee cualquiera.
