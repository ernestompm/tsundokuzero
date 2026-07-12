-- =====================================================================
-- Tsundoku Zero — Superpoderes de administración + arreglos
-- EJECUTAR ENTERO en el SQL Editor. Es idempotente (re-ejecutable).
--
-- Incluye:
--  1. Promoción inmediata del fundador a super admin (sin esperar trigger).
--  2. Backfill: todos los perfiles existentes entran al club fundador.
--  3. Editar/borrar el contenido PROPIO (políticas UPDATE).
--  4. Seguridad: los TÍTULOS de capítulos no alcanzados ya no viajan por
--     la API (eran spoilers: «Cómo termina»…).
--  5. Herramientas de moderación para super admins vía RPC (ver todo,
--     editar, borrar, expulsar usuarios) SIN romper su propio spoiler
--     gate en el feed normal.
--  6. Gestión de libros/capítulos/club para admins.
--  7. Portada real del libro semilla.
--  8. Permisos (arregla el 403 de discussions para authenticated).
-- =====================================================================

-- ---------- 1 · Fundador → super admin AHORA ----------
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || '{"is_super_admin": true}'::jsonb
 where email = 'ernestompm@gmail.com';

-- ---------- 2 · Todos los perfiles al club fundador ----------
insert into club_members (club_id, user_id)
select '00000000-0000-4000-8000-000000000002', p.id
  from profiles p
on conflict do nothing;

-- ---------- 3 · Editar contenido propio ----------
drop policy if exists "discussions_update_own" on discussions;
create policy "discussions_update_own" on discussions for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "comments_update_own" on discussion_comments;
create policy "comments_update_own" on discussion_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ---------- 4 · Títulos de capítulos no alcanzados: bloqueados ----------
drop policy if exists "chapters_select" on chapters;
drop policy if exists "chapters_select_gate" on chapters;
create policy "chapters_select_gate" on chapters for select to authenticated
  using (
    number <= public.current_chapter_of(auth.uid(), book_id)
    or public.is_super_admin()
  );

-- ---------- 5 · Moderación (RPCs con guarda de super admin) ----------
-- Vía RPC y no vía política SELECT para que el propio admin conserve su
-- spoiler gate en el feed: solo el panel de administración ve TODO.

create or replace function public.admin_list_discussions()
returns table (
  id uuid, body text, kind text, chapter_number int, created_at timestamptz,
  is_club boolean, book_title text, author_name text, author_id uuid,
  comment_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select d.id, d.body, d.kind, d.chapter_number, d.created_at,
           (d.club_id is not null), b.title, p.display_name, p.id,
           (select count(*) from discussion_comments c where c.discussion_id = d.id)
      from discussions d
      join books b on b.id = d.book_id
      join profiles p on p.id = d.author_id
     order by d.created_at desc
     limit 300;
end;
$$;

create or replace function public.admin_update_discussion(target uuid, new_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update discussions set body = new_body where id = target;
end;
$$;

create or replace function public.admin_delete_discussion(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from discussions where id = target;
end;
$$;

-- Expulsar usuario del todo (borra auth.users → cascada a perfil y contenido)
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  if target = auth.uid() then raise exception 'no puedes expulsarte a ti mismo'; end if;
  delete from auth.users where id = target;
end;
$$;

-- ---------- 6 · Gestión de catálogo y club para admins ----------
drop policy if exists "books_admin_insert" on books;
create policy "books_admin_insert" on books for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "books_admin_update" on books;
create policy "books_admin_update" on books for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "books_admin_delete" on books;
create policy "books_admin_delete" on books for delete to authenticated
  using (public.is_super_admin());

drop policy if exists "chapters_admin_insert" on chapters;
create policy "chapters_admin_insert" on chapters for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "chapters_admin_update" on chapters;
create policy "chapters_admin_update" on chapters for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "chapters_admin_delete" on chapters;
create policy "chapters_admin_delete" on chapters for delete to authenticated
  using (public.is_super_admin());

drop policy if exists "clubs_admin_update" on clubs;
create policy "clubs_admin_update" on clubs for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- 7 · Portada real del libro semilla ----------
update books
   set cover_url = 'https://covers.openlibrary.org/b/isbn/9788420454825-L.jpg'
 where id = '00000000-0000-4000-8000-000000000001'
   and (cover_url is null or cover_url = '');

-- ---------- 8 · Permisos (arregla el 403) ----------
grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
