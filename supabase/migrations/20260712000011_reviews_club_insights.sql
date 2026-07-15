-- =====================================================================
-- Tsundoku Zero — Reseñas, notificaciones nuevas y gestión de club
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
-- =====================================================================

-- ---------- 1 · Reseña final del libro ----------
alter table book_ratings add column if not exists review text;

-- ---------- 2 · Tipos de notificación nuevos + columna book ----------
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done'));
alter table notifications add column if not exists book_id uuid references books(id) on delete cascade;

-- ---------- 3 · Al avanzar: notificar respuestas que se desbloquean ----------
-- Respuestas a TUS mensajes cuyo author_chapter entra en (viejo, nuevo].
create or replace function public.notify_unlocked_replies()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.current_chapter > coalesce(old.current_chapter, 0) then
    insert into notifications (user_id, actor_id, type, discussion_id)
    select new.user_id, c.author_id, 'unlock', c.discussion_id
      from discussion_comments c
      join discussions d on d.id = c.discussion_id
     where d.book_id = new.book_id
       and d.author_id = new.user_id
       and c.author_id <> new.user_id
       and coalesce(c.author_chapter, d.chapter_number) > coalesce(old.current_chapter, 0)
       and coalesce(c.author_chapter, d.chapter_number) <= new.current_chapter;
  end if;
  return new;
end;
$$;

drop trigger if exists reading_progress_unlock_after_update on reading_progress;
create trigger reading_progress_unlock_after_update
  after update on reading_progress
  for each row execute function public.notify_unlocked_replies();

-- ---------- 4 · Libro terminado por TODO el club → avisar a todos ----------
create or replace function public.notify_book_finished_by_all()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cl record;
  total int;
  done int;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    for cl in select id from clubs where current_book_id = new.book_id loop
      select count(*) into total from club_members where club_id = cl.id;
      select count(*) into done
        from club_members m
        join reading_progress rp
          on rp.user_id = m.user_id and rp.book_id = new.book_id
       where m.club_id = cl.id and rp.status = 'finished';
      if total > 0 and done >= total then
        insert into notifications (user_id, type, book_id)
        select m.user_id, 'book_done', new.book_id from club_members m
         where m.club_id = cl.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists reading_progress_book_done_after_update on reading_progress;
create trigger reading_progress_book_done_after_update
  after update on reading_progress
  for each row execute function public.notify_book_finished_by_all();

-- ---------- 5 · Traspaso de capitanía ----------
create or replace function public.transfer_captaincy(club uuid, new_captain uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_club_captain(club) and not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  update club_members set role = 'member' where club_id = club and role = 'captain';
  update club_members set role = 'captain'
   where club_id = club and user_id = new_captain;
end;
$$;

revoke all on function public.transfer_captaincy(uuid, uuid) from anon;
grant execute on function public.transfer_captaincy(uuid, uuid) to authenticated;

-- ---------- 6 · Crear club (super admin) ----------
create or replace function public.admin_create_club(
  club_name text, club_slug text, book uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  insert into clubs (name, slug, current_book_id)
  values (club_name, club_slug, book)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.admin_create_club(text, text, uuid) from anon;
grant execute on function public.admin_create_club(text, text, uuid) to authenticated;
