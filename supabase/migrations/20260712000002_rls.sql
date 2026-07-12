-- =====================================================================
-- Tsundoku Zero · MVP-0 — RLS + funciones + triggers (Plan MVP-0 §3.1)
--
-- Regla de oro: el spoiler gate se aplica AQUÍ, en Postgres.
-- El cliente jamás decide qué contenido es visible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones auxiliares (security definer: evitan recursión de RLS y
-- centralizan la lógica del gate). search_path fijado por seguridad.
-- ---------------------------------------------------------------------

-- Capítulo actual de un lector en un libro (0 si no lo ha empezado).
create or replace function public.current_chapter_of(reader uuid, book uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select current_chapter from reading_progress
      where user_id = reader and book_id = book),
    0
  );
$$;

create or replace function public.is_club_member(club uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from club_members
    where club_id = club and user_id = auth.uid()
  );
$$;

create or replace function public.is_club_captain(club uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from club_members
    where club_id = club and user_id = auth.uid() and role = 'captain'
  );
$$;

-- ¿Es capitán de algún club? (alta de libros al cerrar votaciones)
create or replace function public.is_any_captain()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from club_members
    where user_id = auth.uid() and role = 'captain'
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- El primer miembro de un club es su capitán; el resto entra como member
-- (ignora cualquier role que venga del cliente: sin auto-ascensos).
create or replace function public.handle_club_member_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from club_members where club_id = new.club_id) then
    new.role := 'member';
  else
    new.role := 'captain';
  end if;
  return new;
end;
$$;

create trigger club_member_role_before_insert
  before insert on club_members
  for each row execute function public.handle_club_member_role();

-- Auto-follow bidireccional entre el nuevo miembro y los existentes.
create or replace function public.handle_club_auto_follow()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into follows (follower_id, followed_id)
  select new.user_id, m.user_id
    from club_members m
   where m.club_id = new.club_id and m.user_id <> new.user_id
  on conflict do nothing;

  insert into follows (follower_id, followed_id)
  select m.user_id, new.user_id
    from club_members m
   where m.club_id = new.club_id and m.user_id <> new.user_id
  on conflict do nothing;

  return new;
end;
$$;

create trigger club_member_auto_follow_after_insert
  after insert on club_members
  for each row execute function public.handle_club_auto_follow();

-- reading_progress.updated_at al día.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reading_progress_touch_before_update
  before update on reading_progress
  for each row execute function public.touch_updated_at();

-- Al cerrar una poll sin ganadora explícita, gana la opción más votada
-- (desempate: la propuesta más antigua entre las votadas primero).
create or replace function public.handle_poll_close()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'open' and new.status = 'closed'
     and new.winner_option_id is null then
    select v.option_id into new.winner_option_id
      from poll_votes v
     where v.poll_id = new.id
     group by v.option_id
     order by count(*) desc, min(v.created_at) asc
     limit 1;
  end if;
  return new;
end;
$$;

create trigger poll_close_before_update
  before update on polls
  for each row execute function public.handle_poll_close();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table profiles enable row level security;
alter table follows enable row level security;
alter table books enable row level security;
alter table chapters enable row level security;
alter table reading_progress enable row level security;
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table discussions enable row level security;
alter table discussion_comments enable row level security;
alter table posts enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

-- profiles: visibles para usuarios autenticados; cada uno gestiona el suyo.
create policy "profiles_select" on profiles for select to authenticated
  using (true);
create policy "profiles_insert_own" on profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- follows: visibles (contadores, estados «Siguiendo»); solo gestiono los míos.
create policy "follows_select" on follows for select to authenticated
  using (true);
create policy "follows_insert_own" on follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy "follows_delete_own" on follows for delete to authenticated
  using (follower_id = auth.uid());

-- books/chapters: lectura para todos; alta solo capitanes (cierre de polls).
create policy "books_select" on books for select to authenticated
  using (true);
create policy "books_insert_captain" on books for insert to authenticated
  with check (public.is_any_captain());
create policy "chapters_select" on chapters for select to authenticated
  using (true);
create policy "chapters_insert_captain" on chapters for insert to authenticated
  with check (public.is_any_captain());

-- reading_progress: visible (feed del club «va entre el cap. X y el Y»,
-- «leyendo el libro del club»); cada uno escribe solo el suyo.
create policy "progress_select" on reading_progress for select to authenticated
  using (true);
create policy "progress_insert_own" on reading_progress for insert to authenticated
  with check (user_id = auth.uid());
create policy "progress_update_own" on reading_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- clubs: visibles; solo el capitán edita (libro del mes, descripción).
create policy "clubs_select" on clubs for select to authenticated
  using (true);
create policy "clubs_update_captain" on clubs for update to authenticated
  using (public.is_club_captain(id)) with check (public.is_club_captain(id));

-- club_members: visibles; unirse es en nombre propio (el trigger fija el rol);
-- el capitán puede cambiar roles (traspaso de capitanía).
create policy "club_members_select" on club_members for select to authenticated
  using (true);
create policy "club_members_insert_self" on club_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "club_members_update_captain" on club_members for update to authenticated
  using (public.is_club_captain(club_id)) with check (public.is_club_captain(club_id));

-- =====================================================================
-- discussions — EL SPOILER GATE (estructural, en servidor)
-- =====================================================================

-- SELECT: veo una discusión solo si su ancla está en un capítulo que ya
-- alcancé en ese libro (o soy su autor). Sin fila de progreso → capítulo 0
-- → no veo nada de ese libro.
create policy "discussions_select_gate" on discussions for select to authenticated
  using (
    author_id = auth.uid()
    or chapter_number <= public.current_chapter_of(auth.uid(), book_id)
  );

-- INSERT: escritura anclada — solo en capítulos <= mi progreso (puedo
-- comentar hacia atrás, nunca hacia delante). Si va al club, debo ser miembro.
create policy "discussions_insert_gate" on discussions for insert to authenticated
  with check (
    author_id = auth.uid()
    and chapter_number <= public.current_chapter_of(auth.uid(), book_id)
    and (club_id is null or public.is_club_member(club_id))
  );

create policy "discussions_delete_own" on discussions for delete to authenticated
  using (author_id = auth.uid());

-- discussion_comments: heredan el gate del padre (la subconsulta a
-- discussions aplica su propia RLS para el usuario actual).
create policy "comments_select_gate" on discussion_comments for select to authenticated
  using (
    exists (select 1 from discussions d where d.id = discussion_id)
  );
create policy "comments_insert_gate" on discussion_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from discussions d where d.id = discussion_id)
  );
create policy "comments_delete_own" on discussion_comments for delete to authenticated
  using (author_id = auth.uid());

-- posts: private → solo autor; followers/club → mis seguidores; con club_id
-- además lo ven los miembros del club (regla 5 del plan).
create policy "posts_select" on posts for select to authenticated
  using (
    author_id = auth.uid()
    or (
      visibility <> 'private'
      and (
        exists (
          select 1 from follows f
          where f.follower_id = auth.uid() and f.followed_id = author_id
        )
        or (club_id is not null and public.is_club_member(club_id))
      )
    )
  );
create policy "posts_insert_own" on posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (club_id is null or public.is_club_member(club_id))
  );
create policy "posts_update_own" on posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts_delete_own" on posts for delete to authenticated
  using (author_id = auth.uid());

-- polls: solo miembros del club las ven; solo el capitán las crea y cierra.
create policy "polls_select_member" on polls for select to authenticated
  using (public.is_club_member(club_id));
create policy "polls_insert_captain" on polls for insert to authenticated
  with check (public.is_club_captain(club_id) and created_by = auth.uid());
create policy "polls_update_captain" on polls for update to authenticated
  using (public.is_club_captain(club_id)) with check (public.is_club_captain(club_id));

create policy "poll_options_select_member" on poll_options for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id));
create policy "poll_options_insert_captain" on poll_options for insert to authenticated
  with check (
    exists (
      select 1 from polls p
      where p.id = poll_id and public.is_club_captain(p.club_id) and p.status = 'open'
    )
  );

-- poll_votes: un voto por persona (PK); se puede cambiar mientras esté abierta.
create policy "poll_votes_select_member" on poll_votes for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id));
create policy "poll_votes_insert_own" on poll_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from polls p
      where p.id = poll_id and public.is_club_member(p.club_id) and p.status = 'open'
    )
  );
create policy "poll_votes_update_own" on poll_votes for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open')
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from polls p
      where p.id = poll_id and public.is_club_member(p.club_id) and p.status = 'open'
    )
  );
create policy "poll_votes_delete_own" on poll_votes for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open')
  );
