-- =====================================================================
-- Tsundoku Zero · MVP-0 — Capítulos por título
--
-- El `number` sigue siendo el orden canónico interno (lo usa el spoiler
-- gate), pero el contenido editorial es el `label` (título). Esta función
-- añade un capítulo por título asignando el siguiente número solo.
-- =====================================================================

create or replace function public.add_book_chapter(book uuid, title text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  next_num int;
begin
  -- Solo un super admin (o el rol de servicio en el SQL Editor, donde no
  -- hay usuario) puede dar de alta capítulos.
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'forbidden: solo un super admin puede añadir capítulos';
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

revoke all on function public.add_book_chapter(uuid, text) from anon;
grant execute on function public.add_book_chapter(uuid, text) to authenticated;
