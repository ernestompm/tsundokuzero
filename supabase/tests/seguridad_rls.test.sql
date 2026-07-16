-- =====================================================================
-- Tests de invariantes de seguridad (pgTAP) · se ejecutan con:
--     supabase test db
--
-- No prueban lógica de negocio: fijan los INVARIANTES que, si se rompen,
-- reabren un agujero. Aserciones sobre el catálogo (sin fixtures de auth),
-- para que sean deterministas y baratas:
--
--   1. RLS ACTIVO en todas las tablas con datos de usuario.
--   2. `anon` NO puede ejecutar las RPC privilegiadas / de escritura
--      (regresión de la vuln. H0: bypass de escritura sin autenticar).
--   3. `anon` SÍ puede ejecutar la única RPC pública (moderation_stats).
--   4. La tabla de secretos (private_settings) es ilegible para anon y
--      authenticated (solo la leen funciones security definer).
--   5. La política del spoiler gate sigue existiendo.
-- =====================================================================

begin;
select plan(31);

-- ---------- 1 · RLS activo ----------
select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass),
  'RLS activo en ' || t
) from unnest(array[
  'profiles', 'discussions', 'discussion_comments', 'posts', 'polls',
  'poll_votes', 'reading_progress', 'book_ratings', 'reports', 'consents',
  'blocks', 'notifications', 'private_settings'
]) as t;

-- ---------- 2 · anon NO ejecuta RPC privilegiadas ----------
select ok(
  not has_function_privilege('anon', 'public.' || f, 'execute'),
  'anon NO puede ejecutar ' || f
) from unnest(array[
  'add_book_chapter(uuid, text)',
  'captain_books_left()',
  'club_kick_member(uuid, uuid)',
  'transfer_captaincy(uuid, uuid)',
  'admin_create_club(text, text, uuid)',
  'admin_stats()',
  'admin_delete_user(uuid)',
  'admin_set_super_admin(uuid, boolean)',
  'admin_list_users()',
  'admin_set_invite_code(text)',
  'admin_get_invite_code()',
  'complete_onboarding(text, text, text, integer)',
  'delete_own_account()',
  'export_my_data()'
]) as f;

-- ---------- 3 · anon SÍ ejecuta la RPC pública ----------
select ok(
  has_function_privilege('anon', 'public.moderation_stats()', 'execute'),
  'anon SÍ puede ejecutar moderation_stats (transparencia pública)'
);

-- ---------- 4 · La tabla de secretos es ilegible ----------
select ok(
  not has_table_privilege('anon', 'public.private_settings', 'select'),
  'anon NO puede leer private_settings'
);
select ok(
  not has_table_privilege('authenticated', 'public.private_settings', 'select'),
  'authenticated NO puede leer private_settings'
);

-- ---------- 5 · El spoiler gate sigue en pie ----------
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'discussions'
      and policyname = 'discussions_select_gate'
  ),
  'La política discussions_select_gate existe'
);

select * from finish();
rollback;
