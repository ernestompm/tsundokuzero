-- =====================================================================
-- Tsundoku Zero — Catálogo rico + teasers borrosos seguros
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
--  1. Autores como entidad propia (bio + contexto) y ficha de libro
--     ampliada: sinopsis y enlace de compra.
--  2. Valoración con estrellas al TERMINAR un libro.
--  3. Cada respuesta guarda el capítulo por el que iba su autor al
--     escribirla; solo se lee si has llegado a ese punto.
--  4. Vistas enmascaradas para los teasers: el cuerpo de lo bloqueado
--     JAMÁS viaja al cliente — el blur no es cosmético.
-- =====================================================================

-- ---------- 1 · Autores + ficha de libro ----------
create table if not exists authors (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  bio text,
  birth_year int,
  nationality text,
  website text,
  created_at timestamptz not null default now()
);

alter table authors enable row level security;
drop policy if exists "authors_select" on authors;
create policy "authors_select" on authors for select to authenticated using (true);
drop policy if exists "authors_admin_insert" on authors;
create policy "authors_admin_insert" on authors for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "authors_admin_update" on authors;
create policy "authors_admin_update" on authors for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "authors_admin_delete" on authors;
create policy "authors_admin_delete" on authors for delete to authenticated
  using (public.is_super_admin());

alter table books add column if not exists author_id uuid references authors(id);
alter table books add column if not exists synopsis text;
alter table books add column if not exists buy_url text;

-- Backfill: un autor por cada nombre ya existente en books.author
insert into authors (name)
select distinct author from books
on conflict (name) do nothing;

update books b
   set author_id = a.id
  from authors a
 where a.name = b.author
   and b.author_id is null;

-- ---------- 2 · Valoraciones (solo con el libro terminado) ----------
create table if not exists book_ratings (
  book_id uuid not null references books(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

alter table book_ratings enable row level security;
drop policy if exists "ratings_select" on book_ratings;
create policy "ratings_select" on book_ratings for select to authenticated using (true);
drop policy if exists "ratings_upsert_own" on book_ratings;
create policy "ratings_upsert_own" on book_ratings for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from reading_progress rp
      where rp.user_id = auth.uid() and rp.book_id = book_ratings.book_id
        and rp.status = 'finished'
    )
  );
drop policy if exists "ratings_update_own" on book_ratings;
create policy "ratings_update_own" on book_ratings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ratings_delete_own" on book_ratings;
create policy "ratings_delete_own" on book_ratings for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 3 · Posición del autor en cada respuesta ----------
alter table discussion_comments add column if not exists author_chapter int;

create or replace function public.set_comment_author_chapter()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select public.current_chapter_of(new.author_id, d.book_id)
    into new.author_chapter
    from discussions d
   where d.id = new.discussion_id;
  return new;
end;
$$;

drop trigger if exists comment_author_chapter_before_insert on discussion_comments;
create trigger comment_author_chapter_before_insert
  before insert on discussion_comments
  for each row execute function public.set_comment_author_chapter();

-- Backfill de respuestas antiguas: como mínimo iban por el capítulo del hilo
update discussion_comments c
   set author_chapter = d.chapter_number
  from discussions d
 where d.id = c.discussion_id
   and c.author_chapter is null;

-- Endurecer la lectura directa de respuestas: solo desbloqueadas
drop policy if exists "comments_select_gate" on discussion_comments;
create policy "comments_select_gate" on discussion_comments for select to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from discussions d
      where d.id = discussion_id
        and coalesce(discussion_comments.author_chapter, d.chapter_number)
            <= public.current_chapter_of(auth.uid(), d.book_id)
    )
  );

-- ---------- 4 · Vistas enmascaradas (teasers sin cuerpo) ----------
-- Corren con permisos del propietario (bypass RLS) pero SOLO exponen el
-- cuerpo cuando está desbloqueado; para lo bloqueado devuelven body=null.

create or replace view public.feed_discussions as
select
  d.id, d.book_id, d.chapter_number, d.author_id, d.kind, d.club_id, d.created_at,
  (d.author_id = auth.uid()
   or d.chapter_number <= public.current_chapter_of(auth.uid(), d.book_id)) as unlocked,
  case
    when d.author_id = auth.uid()
      or d.chapter_number <= public.current_chapter_of(auth.uid(), d.book_id)
    then d.body
  end as body
from discussions d;

alter view public.feed_discussions set (security_invoker = false);
revoke all on public.feed_discussions from anon, authenticated;
grant select on public.feed_discussions to authenticated;

create or replace view public.thread_comments as
select
  c.id, c.discussion_id, c.author_id, c.created_at,
  coalesce(c.author_chapter, d.chapter_number) as author_chapter,
  d.book_id,
  (c.author_id = auth.uid()
   or coalesce(c.author_chapter, d.chapter_number)
      <= public.current_chapter_of(auth.uid(), d.book_id)) as unlocked,
  case
    when c.author_id = auth.uid()
      or coalesce(c.author_chapter, d.chapter_number)
         <= public.current_chapter_of(auth.uid(), d.book_id)
    then c.body
  end as body
from discussion_comments c
join discussions d on d.id = c.discussion_id
-- el hilo padre debe estar desbloqueado para ver siquiera el teaser
where d.author_id = auth.uid()
   or d.chapter_number <= public.current_chapter_of(auth.uid(), d.book_id);

alter view public.thread_comments set (security_invoker = false);
revoke all on public.thread_comments from anon, authenticated;
grant select on public.thread_comments to authenticated;
