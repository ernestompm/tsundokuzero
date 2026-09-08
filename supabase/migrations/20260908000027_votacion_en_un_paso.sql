-- =====================================================================
-- 027 · Votación en un paso: pegas los ISBN y la encuesta se abre sola
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- PROBLEMA (reportado por Ernesto: «el equipo vota por WhatsApp»)
-- --------------------------------------------------------------
-- Para abrir una votación de 3 libros, el capitán tenía que darlos de
-- alta ANTES, uno a uno, en «Libros de tu capitanía», con su ISBN y sus
-- capítulos, y con una cuota de 3 libros por mandato. La propia pantalla
-- lo admitía: «¿Falta el libro que quieres proponer? Créalo primero».
-- Proponer tres libros costaba tres altas completas. Por eso el ritual
-- se fue a WhatsApp, que es lo peor que le puede pasar a esta app.
--
-- SOLUCIÓN
-- --------
-- Una sola RPC: le pasas los libros candidatos tal como los devuelve la
-- búsqueda por ISBN o título, y hace todo dentro de una transacción:
-- deduplica contra el catálogo, crea los que falten, abre la votación y
-- cuelga las opciones. El trigger notify_on_poll ya existente avisa a
-- todos los miembros, con push incluido.
--
-- CAPÍTULOS PROVISIONALES
-- -----------------------
-- Un libro que solo es CANDIDATO todavía no necesita capítulos exactos:
-- nadie lo está leyendo y el candado anti-spoiler no interviene. Pero
-- `books.total_chapters` es NOT NULL. Se marca por eso con
-- `chapters_confirmed = false` y se corrige con `set_book_chapters`
-- cuando el libro gana la votación o alguien va a empezarlo. Así el
-- capitán no tiene que inventarse tres índices para abrir una encuesta.
-- =====================================================================

-- ---------- 1 · Marca de capítulos por confirmar ----------
alter table public.books
  add column if not exists chapters_confirmed boolean not null default true;

comment on column public.books.chapters_confirmed is
  'false = el número de capítulos es provisional (libro creado como candidato de una votación). Confirmar con set_book_chapters antes de leerlo.';

-- ---------- 2 · Corregir el número de capítulos de un libro ----------
create or replace function public.set_book_chapters(p_book uuid, p_total int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_usado int;
begin
  if auth.uid() is null then
    raise exception 'forbidden: hace falta sesión';
  end if;

  -- Admin, quien creó el libro, o el capitán de cualquier club
  if not public.is_super_admin()
     and not exists (select 1 from books b where b.id = p_book and b.created_by = auth.uid())
     and not exists (
       select 1 from club_members cm
        where cm.user_id = auth.uid() and cm.role = 'captain'
     )
  then
    raise exception 'forbidden: solo el capitán, quien lo añadió o un admin';
  end if;

  if p_total is null or p_total < 1 or p_total > 500 then
    raise exception 'El número de capítulos debe estar entre 1 y 500.';
  end if;

  -- No se puede recortar por debajo de lo que ya tiene conversación o
  -- progreso: destruiría hilos y dejaría a gente fuera de rango.
  select greatest(
           coalesce((select max(d.chapter_number) from discussions d where d.book_id = p_book), 0),
           coalesce((select max(rp.current_chapter) from reading_progress rp where rp.book_id = p_book), 0)
         )
    into v_max_usado;

  if p_total < v_max_usado then
    raise exception 'Ya hay lectura o conversación hasta el capítulo %; no puedes bajar de ahí.', v_max_usado;
  end if;

  -- Añade los capítulos que falten (sin tocar los títulos ya escritos)
  insert into chapters (book_id, number, label)
  select p_book, g, null
    from generate_series(1, p_total) as g
   where not exists (
     select 1 from chapters c where c.book_id = p_book and c.number = g
   );

  -- Quita los sobrantes (seguro: están por encima de v_max_usado)
  delete from chapters c where c.book_id = p_book and c.number > p_total;

  update books
     set total_chapters = p_total,
         chapters_confirmed = true
   where id = p_book;

  return p_total;
end;
$$;

revoke all on function public.set_book_chapters(uuid, int) from anon, public;
grant execute on function public.set_book_chapters(uuid, int) to authenticated;

-- ---------- 3 · Crear la votación con sus libros, de una vez ----------
-- p_books: array JSON de candidatos. Cada uno admite:
--   { "title", "author", "isbn", "cover_url", "cover_source",
--     "synopsis", "synopsis_source", "buy_url", "total_chapters", "note" }
-- Solo `title` y `author` son obligatorios. `note` es el pitch del capitán.
create or replace function public.create_poll_with_books(
  p_title text,
  p_books jsonb,
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_poll uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_item jsonb;
  v_n int := 0;
  v_book uuid;
  v_bt text;
  v_ba text;
  v_isbn text;
  v_chapters int;
  v_author_id uuid;
  v_provisional constant int := 30;
begin
  if v_uid is null then
    raise exception 'forbidden: hace falta sesión';
  end if;

  if v_title = '' then
    raise exception 'Ponle un título a la votación.';
  end if;

  if jsonb_typeof(p_books) <> 'array' then
    raise exception 'No hay libros que proponer.';
  end if;

  -- Club donde eres capitán (o el primero, si eres admin)
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = v_uid and cm.role = 'captain'
   limit 1;

  if v_club is null and public.is_super_admin() then
    select c.id into v_club from clubs c order by c.created_at limit 1;
  end if;

  if v_club is null then
    raise exception 'forbidden: solo el capitán del club puede abrir una votación';
  end if;

  -- Una votación abierta a la vez: evita el lío de dos encuestas vivas
  if exists (
    select 1 from polls p where p.club_id = v_club and p.status = 'open'
  ) then
    raise exception 'Ya hay una votación abierta. Ciérrala o descártala antes de abrir otra.';
  end if;

  insert into polls (club_id, title, created_by, closes_at)
  values (v_club, v_title, v_uid, p_closes_at)
  returning id into v_poll;

  for v_item in select * from jsonb_array_elements(p_books)
  loop
    v_bt := btrim(coalesce(v_item->>'title', ''));
    v_ba := btrim(coalesce(v_item->>'author', ''));
    if v_bt = '' or v_ba = '' then
      continue;
    end if;

    v_isbn := nullif(regexp_replace(upper(coalesce(v_item->>'isbn', '')), '[^0-9X]', '', 'g'), '');
    if v_isbn is not null and length(v_isbn) not in (10, 13) then
      v_isbn := null;
    end if;

    -- ---- Deduplicado contra el catálogo: ISBN, luego título+autor ----
    v_book := null;
    if v_isbn is not null then
      select b.id into v_book from books b where b.isbn = v_isbn limit 1;
    end if;
    if v_book is null then
      select b.id into v_book
        from books b
       where lower(btrim(b.title)) = lower(v_bt)
         and lower(btrim(b.author)) = lower(v_ba)
       limit 1;
    end if;

    if v_book is null then
      v_chapters := nullif(v_item->>'total_chapters', '')::int;

      select a.id into v_author_id from authors a where lower(a.name) = lower(v_ba) limit 1;
      if v_author_id is null then
        insert into authors (name) values (v_ba)
        on conflict (name) do update set name = excluded.name
        returning id into v_author_id;
      end if;

      insert into books (
        title, author, author_id, isbn, cover_url, cover_source,
        synopsis, synopsis_source, buy_url, total_chapters,
        chapters_confirmed, created_by
      ) values (
        v_bt, v_ba, v_author_id, v_isbn,
        nullif(btrim(coalesce(v_item->>'cover_url', '')), ''),
        case when nullif(btrim(coalesce(v_item->>'cover_url', '')), '') is null then null
             else coalesce(nullif(btrim(coalesce(v_item->>'cover_source', '')), ''), 'Manual') end,
        nullif(btrim(coalesce(v_item->>'synopsis', '')), ''),
        case when nullif(btrim(coalesce(v_item->>'synopsis', '')), '') is null then null
             else coalesce(nullif(btrim(coalesce(v_item->>'synopsis_source', '')), ''), 'Propia') end,
        nullif(btrim(coalesce(v_item->>'buy_url', '')), ''),
        coalesce(v_chapters, v_provisional),
        v_chapters is not null,
        v_uid
      )
      returning id into v_book;

      insert into chapters (book_id, number, label)
      select v_book, g, null from generate_series(1, coalesce(v_chapters, v_provisional)) as g;
    end if;

    insert into poll_options (poll_id, book_id, book_title, book_author, note)
    values (
      v_poll, v_book, v_bt, v_ba,
      nullif(btrim(coalesce(v_item->>'note', '')), '')
    );
    v_n := v_n + 1;
  end loop;

  if v_n < 2 then
    -- Sin al menos dos opciones no hay votación: se deshace entera.
    raise exception 'Hacen falta al menos 2 libros para votar.';
  end if;

  return v_poll;
end;
$$;

revoke all on function public.create_poll_with_books(text, jsonb, timestamptz) from anon, public;
grant execute on function public.create_poll_with_books(text, jsonb, timestamptz) to authenticated;
