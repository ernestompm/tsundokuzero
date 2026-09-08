-- =====================================================================
-- 026 · Alta de libro inteligente (cualquier lector, deduplicada, atómica)
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- PROBLEMA
-- --------
-- Añadir un libro era un callejón: solo admin (Admin → Libros) o capitán
-- con cupo (Club → Gestionar), a golpe de ISBN y pegando los títulos de
-- TODOS los capítulos. Un lector normal no podía añadir el libro que
-- está leyendo. Además el alta eran dos escrituras separadas (books +
-- chapters) con un «rollback» compensatorio desde el cliente.
--
-- DECISIÓN DE PRODUCTO (reversible en una línea, ver «límite»)
-- -----------------------------------------------------------
-- Una red social de lectura necesita que cualquier lector pueda añadir el
-- libro que tiene entre manos. Se abre el alta a todo usuario autenticado
-- con estas salvaguardas:
--   · DEDUPLICADO en servidor: mismo ISBN, o mismo título+autor (sin
--     mayúsculas ni espacios), devuelve el libro ya existente en vez de
--     crear un duplicado.
--   · LÍMITE: 10 altas al día por usuario (admin sin límite).
--   · ATÓMICO: libro + capítulos + estantería en una sola transacción.
--   · TRAZABLE: books.created_by queda registrado; el admin edita/borra.
-- La cuota de 3 libros por capitanía (migr. 015) sigue existiendo como
-- política RLS para INSERT directo, pero la app ya no la usa.
-- =====================================================================

-- ---------- 1 · ISBN en el catálogo (clave de deduplicado) ----------
alter table public.books add column if not exists isbn text;

-- Índice único parcial: dos libros no comparten ISBN (si lo tienen).
create unique index if not exists books_isbn_unique
  on public.books (isbn) where isbn is not null;

-- Índice para el deduplicado por título+autor normalizados.
create index if not exists books_title_author_norm_idx
  on public.books (lower(btrim(title)), lower(btrim(author)));

-- ---------- 2 · RPC de alta ----------
create or replace function public.add_book_smart(
  p_title text,
  p_author text,
  p_isbn text default null,
  p_cover_url text default null,
  p_cover_source text default null,
  p_synopsis text default null,
  p_synopsis_source text default null,
  p_buy_url text default null,
  p_total_chapters int default null,
  p_chapter_labels text[] default null,
  p_status text default null
)
returns table (book_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_author text := btrim(coalesce(p_author, ''));
  v_isbn text := nullif(regexp_replace(upper(coalesce(p_isbn, '')), '[^0-9X]', '', 'g'), '');
  v_labels text[] := coalesce(p_chapter_labels, '{}');
  v_n int;
  v_book uuid;
  v_author_id uuid;
  v_created boolean := false;
  v_today int;
begin
  if v_uid is null then
    raise exception 'forbidden: hace falta sesión';
  end if;

  if p_status is not null and p_status not in ('want', 'reading') then
    raise exception 'Estado de lectura no válido.';
  end if;

  -- ISBN plausible (10 o 13) o nada: evita basura como clave de dedupe.
  if v_isbn is not null and length(v_isbn) not in (10, 13) then
    v_isbn := null;
  end if;

  -- ---- Deduplicado: primero por ISBN, luego por título+autor ----
  if v_isbn is not null then
    select b.id into v_book from books b where b.isbn = v_isbn limit 1;
  end if;
  if v_book is null and v_title <> '' and v_author <> '' then
    select b.id into v_book
      from books b
     where lower(btrim(b.title)) = lower(v_title)
       and lower(btrim(b.author)) = lower(v_author)
     limit 1;
  end if;

  if v_book is null then
    -- ---- Alta nueva ----
    if v_title = '' or v_author = '' then
      raise exception 'Hacen falta título y autor.';
    end if;

    v_n := coalesce(nullif(array_length(v_labels, 1), 0), p_total_chapters);
    if v_n is null or v_n < 1 or v_n > 500 then
      raise exception 'Indica cuántos capítulos tiene el libro (entre 1 y 500).';
    end if;

    if not public.is_super_admin() then
      select count(*) into v_today
        from books b
       where b.created_by = v_uid and b.created_at > now() - interval '1 day';
      if v_today >= 10 then
        raise exception 'Has añadido muchos libros hoy. Vuelve a intentarlo mañana.';
      end if;
    end if;

    -- Ficha de autor (la página /author/:id la necesita)
    select a.id into v_author_id from authors a
     where lower(a.name) = lower(v_author) limit 1;
    if v_author_id is null then
      insert into authors (name) values (v_author)
      on conflict (name) do update set name = excluded.name
      returning id into v_author_id;
    end if;

    insert into books (
      title, author, author_id, isbn, cover_url, cover_source,
      synopsis, synopsis_source, buy_url, total_chapters, created_by
    ) values (
      v_title, v_author, v_author_id, v_isbn,
      nullif(btrim(coalesce(p_cover_url, '')), ''),
      case when nullif(btrim(coalesce(p_cover_url, '')), '') is null then null
           else coalesce(nullif(btrim(coalesce(p_cover_source, '')), ''), 'Manual') end,
      nullif(btrim(coalesce(p_synopsis, '')), ''),
      case when nullif(btrim(coalesce(p_synopsis, '')), '') is null then null
           else coalesce(nullif(btrim(coalesce(p_synopsis_source, '')), ''), 'Propia') end,
      nullif(btrim(coalesce(p_buy_url, '')), ''),
      v_n, v_uid
    )
    returning id into v_book;

    -- Capítulos 1..N; etiqueta si la hay, si no queda null y la app pinta «Capítulo N».
    insert into chapters (book_id, number, label)
    select v_book, g, nullif(btrim(coalesce(v_labels[g], '')), '')
      from generate_series(1, v_n) as g;

    v_created := true;
  end if;

  -- ---- Estantería del que lo añade (opcional) ----
  if p_status is not null then
    insert into reading_progress (user_id, book_id, status, current_chapter)
    values (v_uid, v_book, p_status, case when p_status = 'reading' then 1 else 0 end)
    on conflict (user_id, book_id) do update
      set status = case
                     -- nunca «desterminar» un libro leído desde aquí
                     when reading_progress.status = 'finished' then reading_progress.status
                     else excluded.status
                   end,
          current_chapter = case
                     when reading_progress.status = 'finished' then reading_progress.current_chapter
                     when excluded.status = 'reading' then greatest(reading_progress.current_chapter, 1)
                     else reading_progress.current_chapter
                   end;
  end if;

  return query select v_book, v_created;
end;
$$;

revoke all on function public.add_book_smart(text, text, text, text, text, text, text, text, int, text[], text)
  from anon, public;
grant execute on function public.add_book_smart(text, text, text, text, text, text, text, text, int, text[], text)
  to authenticated;

-- ---------- 3 · Quitar un libro de MI estantería ----------
-- Permite «Quitar de la estantería» desde la Biblioteca (solo lo propio).
drop policy if exists "progress_delete_own" on public.reading_progress;
create policy "progress_delete_own" on public.reading_progress
  for delete to authenticated using (user_id = auth.uid());
