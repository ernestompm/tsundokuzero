-- =====================================================================
-- Tsundoku Zero · MVP-0 — Permisos (arregla el 403 en discussions)
--
-- El spoiler gate de `discussions` (política SELECT) llama a la función
-- current_chapter_of(). Un usuario AUTENTICADO evalúa esa política y, si
-- su rol no tiene EXECUTE sobre la función, Postgres responde
-- "permission denied for function" → PostgREST devuelve 403. (anon no
-- evalúa la política porque es `to authenticated`, por eso a anon no le
-- fallaba.) Aquí concedemos EXECUTE y reafirmamos los permisos de tabla.
-- =====================================================================

-- Ejecutar funciones del esquema public
grant execute on all functions in schema public to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- Permisos de tabla (por si algún GRANT por defecto no se aplicó)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
