-- =====================================================================
-- 022 · [SEGURIDAD · ALTA] Cierre de escritura sin autenticar
-- EJECUTAR ENTERO en el SQL Editor CUANTO ANTES. Idempotente.
--
-- HALLAZGO (auditoría 16/07/2026)
-- -------------------------------
-- La función SECURITY DEFINER `add_book_chapter(uuid, text)` (migr. 004 y
-- redefinida en 015) protege con:
--
--     if auth.uid() is not null and not is_super_admin() and not <creador>
--     then raise exception 'forbidden'; end if;
--
-- La intención era dejar pasar al rol de servicio en el SQL Editor (allí
-- `auth.uid()` es null). PERO un llamante ANÓNIMO vía PostgREST también
-- tiene `auth.uid()` null → la condición corta a FALSE → NO se lanza la
-- excepción → el INSERT se ejecuta. Como es SECURITY DEFINER, además
-- salta el RLS de `chapters`. Y `anon` conserva EXECUTE por la concesión
-- masiva a PUBLIC/anon de 005/006.
--
-- IMPACTO: un atacante SIN cuenta puede inyectar capítulos en cualquier
-- libro y alterar `books.total_chapters` (corrupción de catálogo, ruido
-- en el índice público, distorsión del spoiler gate por capítulos falsos).
--
-- CORRECCIÓN
-- ----------
--  1. Guarda reescrita: `auth.uid() is null` pasa a ser DENEGACIÓN
--     explícita. El sembrado desde el SQL Editor se hace con INSERT
--     directo (el rol de servicio ya salta el RLS), no por esta RPC.
--  2. Mínimo privilegio: se revoca EXECUTE de anon y PUBLIC en las RPC
--     privilegiadas / de escritura. `authenticated` las conserva (el
--     guard interno es el control real).
-- =====================================================================

-- ---------- 1 · Guarda corregida de add_book_chapter ----------
create or replace function public.add_book_chapter(book uuid, title text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  next_num int;
begin
  -- Denegación explícita para no autenticados (cierra el bypass por
  -- auth.uid() null de anon vía la API). Solo admin o el creador del libro.
  if auth.uid() is null
     or (
       not public.is_super_admin()
       and not exists (
         select 1 from books b where b.id = book and b.created_by = auth.uid()
       )
     )
  then
    raise exception 'forbidden: solo admin o el creador del libro';
  end if;

  select coalesce(max(number), 0) + 1 into next_num
    from chapters where book_id = book;

  insert into chapters (book_id, number, label)
  values (book, next_num, title);

  update books
     set total_chapters = greatest(total_chapters, next_num)
   where id = book;

  return next_num;
end;
$$;

-- ---------- 2 · Mínimo privilegio en RPC privilegiadas / de escritura ----------
-- Se revoca de anon Y de PUBLIC (PUBLIC cubre la concesión por defecto que
-- reciben las funciones al crearse, causa raíz de que anon pudiera llamar).
do $$
declare
  fn text;
  privilegiadas text[] := array[
    'add_book_chapter(uuid, text)',
    'captain_books_left()',
    'club_kick_member(uuid, uuid)',
    'transfer_captaincy(uuid, uuid)',
    'admin_create_club(text, text, uuid)',
    'admin_stats()'
  ];
begin
  foreach fn in array privilegiadas loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('revoke all on function public.%s from anon, public', fn);
      execute format('grant execute on function public.%s to authenticated', fn);
    end if;
  end loop;
end $$;
