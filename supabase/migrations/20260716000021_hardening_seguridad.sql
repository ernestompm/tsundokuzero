-- =====================================================================
-- 021 · Endurecimiento de seguridad (auditoría técnica 16/07/2026)
-- EJECUTAR ENTERO en el SQL Editor. Idempotente (re-ejecutable).
--
-- No cierra ningún agujero explotable (la capa de datos ya es sólida:
-- RLS estructural, admin vía app_metadata, Storage por carpeta de uid).
-- Aplica PRINCIPIO DE MÍNIMO PRIVILEGIO y defensa en profundidad sobre
-- puntos que las migraciones 005/006 dejaron laxos:
--
--  1. Las funciones de administración/sensibles dejan de ser INVOCABLES
--     por `anon` y por PUBLIC. Los `grant execute on all functions
--     ... to anon` de 005/006 habían rehecho los `revoke` puntuales:
--     anon podía LLAMAR admin_delete_user, admin_set_super_admin, etc.
--     (el guard interno is_super_admin() devolvía 'forbidden', pero ni
--     siquiera deberían tener EXECUTE). Aquí se revoca de forma explícita.
--  2. is_super_admin() gana `set search_path` fijo (endurecimiento).
--  3. El bucket público `avatars` limita tipo MIME (solo imágenes rasterizadas,
--     SVG excluido a propósito por poder portar scripts) y tamaño (5 MB).
-- =====================================================================

-- ---------- 1 · Mínimo privilegio en RPCs sensibles ----------
-- Se revoca de anon Y de PUBLIC (PUBLIC cubre cualquier rol futuro).
-- `authenticated` conserva EXECUTE: el control real es el guard interno
-- is_super_admin() / auth.uid() de cada función.
do $$
declare
  fn text;
  sensibles text[] := array[
    'admin_list_users()',
    'admin_set_super_admin(uuid, boolean)',
    'admin_list_discussions()',
    'admin_update_discussion(uuid, text)',
    'admin_delete_discussion(uuid)',
    'admin_delete_user(uuid)',
    'admin_resolve_report(uuid, text, text)',
    'admin_delete_comment(uuid)',
    'admin_delete_post(uuid)',
    'admin_delete_review(uuid, uuid)',
    'admin_set_invite_code(text)',
    'admin_get_invite_code()',
    'complete_onboarding(text, text, text, int)',
    'delete_own_account()',
    'export_my_data()',
    'block_user(uuid)',
    'unblock_user(uuid)'
  ];
begin
  foreach fn in array sensibles loop
    -- Solo si la función existe (idempotente frente a despliegues parciales)
    if to_regprocedure('public.' || fn) is not null then
      execute format('revoke all on function public.%s from anon, public', fn);
    end if;
  end loop;
end $$;

-- Las que un usuario autenticado sí debe poder invocar (el guard decide)
do $$
declare
  fn text;
  autenticadas text[] := array[
    'complete_onboarding(text, text, text, int)',
    'delete_own_account()',
    'export_my_data()',
    'block_user(uuid)',
    'unblock_user(uuid)',
    'admin_list_users()',
    'admin_set_super_admin(uuid, boolean)',
    'admin_list_discussions()',
    'admin_update_discussion(uuid, text)',
    'admin_delete_discussion(uuid)',
    'admin_delete_user(uuid)',
    'admin_resolve_report(uuid, text, text)',
    'admin_delete_comment(uuid)',
    'admin_delete_post(uuid)',
    'admin_delete_review(uuid, uuid)',
    'admin_set_invite_code(text)',
    'admin_get_invite_code()'
  ];
begin
  foreach fn in array autenticadas loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('grant execute on function public.%s to authenticated', fn);
    end if;
  end loop;
end $$;

-- moderation_stats() SÍ es pública (página /legal/transparencia): se deja a anon.
grant execute on function public.moderation_stats() to anon, authenticated;

-- ---------- 2 · is_super_admin con search_path fijo ----------
create or replace function public.is_super_admin()
returns boolean
language sql stable
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- ---------- 3 · Bucket avatars: solo imágenes, máx. 5 MB ----------
-- Evita subir HTML/SVG u otros ejecutables a un bucket PÚBLICO.
update storage.buckets
   set public = true,
       file_size_limit = 5242880,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'
       ]
 where id = 'avatars';
