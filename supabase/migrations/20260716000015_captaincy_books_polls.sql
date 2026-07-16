-- =====================================================================
-- Tsundoku Zero — Cuota de libros por capitanía + votaciones de catálogo
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
--  1. Cada libro registra quién y cuándo lo creó.
--  2. La capitanía tiene fecha de inicio (captain_since): un «mandato».
--     El capitán puede crear HASTA 3 LIBROS POR MANDATO; si vuelve a ser
--     capitán más adelante, empieza mandato nuevo → 3 más.
--  3. Las votaciones se componen de LIBROS DEL CATÁLOGO (poll_options
--     gana book_id) y, al cerrar con ganadora, ese libro pasa a ser
--     automáticamente el libro del club.
-- =====================================================================

-- ---------- 1 · Autoría de los libros ----------
alter table books add column if not exists created_at timestamptz not null default now();
alter table books add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();

-- ---------- 2 · Mandatos de capitanía ----------
alter table club_members add column if not exists captain_since timestamptz;
update club_members set captain_since = joined_at
 where role = 'captain' and captain_since is null;

-- El primer miembro estrena capitanía con fecha
create or replace function public.handle_club_member_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from club_members where club_id = new.club_id) then
    new.role := 'member';
    new.captain_since := null;
  else
    new.role := 'captain';
    new.captain_since := now();
  end if;
  return new;
end;
$$;

-- El traspaso abre mandato nuevo para el entrante y cierra el del saliente
create or replace function public.transfer_captaincy(club uuid, new_captain uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_club_captain(club) and not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  update club_members set role = 'member', captain_since = null
   where club_id = club and role = 'captain';
  update club_members set role = 'captain', captain_since = now()
   where club_id = club and user_id = new_captain;
end;
$$;

-- ---------- 3 · Cuota: 3 libros por mandato ----------
create or replace function public.captain_books_left()
returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  since timestamptz;
  used int;
begin
  select captain_since into since
    from club_members
   where user_id = auth.uid() and role = 'captain'
   order by captain_since desc nulls last
   limit 1;
  if since is null then
    return 0;
  end if;
  select count(*) into used
    from books
   where created_by = auth.uid() and created_at >= since;
  return greatest(0, 3 - used);
end;
$$;

revoke all on function public.captain_books_left() from anon;
grant execute on function public.captain_books_left() to authenticated;

-- Crear libros: super admin sin límite; capitán dentro de su cuota
drop policy if exists "books_insert_captain" on books;
drop policy if exists "books_admin_insert" on books;
drop policy if exists "books_insert_admin_or_captain" on books;
create policy "books_insert_admin_or_captain" on books for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.captain_books_left() > 0 and created_by = auth.uid())
  );

-- Capítulos: además del admin, el CREADOR del libro puede añadirlos
drop policy if exists "chapters_insert_captain" on chapters;
drop policy if exists "chapters_creator_insert" on chapters;
create policy "chapters_creator_insert" on chapters for insert to authenticated
  with check (
    exists (
      select 1 from books b
      where b.id = chapters.book_id and b.created_by = auth.uid()
    )
  );

create or replace function public.add_book_chapter(book uuid, title text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  next_num int;
begin
  if auth.uid() is not null
     and not public.is_super_admin()
     and not exists (
       select 1 from books b where b.id = book and b.created_by = auth.uid()
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

-- ---------- 4 · Votaciones con libros del catálogo ----------
alter table poll_options add column if not exists book_id uuid references books(id) on delete set null;

-- Al cerrar con ganadora: si la opción es un libro del catálogo, pasa a
-- ser el libro del club (cierra el bucle votación → lectura).
create or replace function public.handle_poll_close()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'open' and new.status = 'closed' then
    if new.winner_option_id is null then
      select v.option_id into new.winner_option_id
        from poll_votes v
       where v.poll_id = new.id
       group by v.option_id
       order by count(*) desc, min(v.created_at) asc
       limit 1;
    end if;
    if new.winner_option_id is not null then
      update clubs c
         set current_book_id = po.book_id
        from poll_options po
       where po.id = new.winner_option_id
         and po.book_id is not null
         and c.id = new.club_id;
    end if;
  end if;
  return new;
end;
$$;
