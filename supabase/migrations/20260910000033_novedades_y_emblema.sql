-- =====================================================================
-- 033 · Novedades de verdad y emblema con imagen
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- QUÉ ESTABA MAL
-- --------------
-- La migración 032 puso contadores de actividad en la tira del club, pero
-- eran solo eso: números que no llevaban a ninguna parte. Un aviso que no
-- se puede abrir ni marcar como visto no es un aviso, es adorno.
--
-- QUÉ TRAE
-- --------
--  1. `club_news()` devuelve LOS ELEMENTOS, no cuentas: quién respondió
--     qué, a qué idea, en qué hilo. Con eso se puede pintar una pantalla
--     de «Lo nuevo» donde tocas y vas al sitio.
--  2. Marcas por tipo, para que se apaguen por separado.
--  3. El emblema del club puede ser una imagen subida, como los avatares.
-- =====================================================================

-- ---------- 1 · Marcas de «visto» por tipo ----------
alter table public.profiles
  add column if not exists ideas_seen_at timestamptz,
  add column if not exists replies_seen_at timestamptz,
  add column if not exists reactions_seen_at timestamptz,
  add column if not exists ahead_seen_at timestamptz;

-- Quien no tenga marca arranca donde estuviera la general, y si no, desde
-- que se registró: nunca desde el principio de los tiempos.
update public.profiles
   set ideas_seen_at     = coalesce(ideas_seen_at,     club_seen_at, created_at),
       replies_seen_at   = coalesce(replies_seen_at,   club_seen_at, created_at),
       reactions_seen_at = coalesce(reactions_seen_at, club_seen_at, created_at),
       ahead_seen_at     = coalesce(ahead_seen_at,     club_seen_at, created_at);

-- Marca uno solo, o todos si no se dice cuál
create or replace function public.mark_seen(p_kind text default 'all')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_kind not in ('all', 'ideas', 'replies', 'reactions', 'ahead') then
    raise exception 'Tipo de aviso no válido.';
  end if;

  update profiles
     set club_seen_at      = now(),
         ideas_seen_at     = case when p_kind in ('all', 'ideas')     then now() else ideas_seen_at end,
         replies_seen_at   = case when p_kind in ('all', 'replies')   then now() else replies_seen_at end,
         reactions_seen_at = case when p_kind in ('all', 'reactions') then now() else reactions_seen_at end,
         ahead_seen_at     = case when p_kind in ('all', 'ahead')     then now() else ahead_seen_at end
   where id = auth.uid();
end;
$$;

revoke all on function public.mark_seen(text) from anon, public;
grant execute on function public.mark_seen(text) to authenticated;

-- ---------- 2 · Las novedades, con su contenido ----------
-- Devuelve los elementos para poder pintarlos y tocarlos, no solo cuántos
-- hay. Sigue respetando el candado: nada por delante de tu capítulo.
create or replace function public.club_news()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_libro uuid;
  v_cap int := 0;
  p record;
begin
  if v_uid is null then
    return '{}'::jsonb;
  end if;

  select * into p from profiles where id = v_uid;

  select cm.club_id into v_club from club_members cm where cm.user_id = v_uid limit 1;
  if v_club is null then
    return '{}'::jsonb;
  end if;

  select c.current_book_id into v_libro from clubs c where c.id = v_club;

  select coalesce(rp.current_chapter, 0) into v_cap
    from reading_progress rp where rp.user_id = v_uid and rp.book_id = v_libro;
  v_cap := coalesce(v_cap, 0);

  return jsonb_build_object(
    -- Respuestas a lo que tú escribiste
    'replies', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
                 'id', dc.id,
                 'thread_id', dc.discussion_id,
                 'author', pr.display_name,
                 'avatar', pr.avatar_url,
                 'body', left(dc.body, 160),
                 'created_at', dc.created_at
               ) as x
          from discussion_comments dc
          join discussions d on d.id = dc.discussion_id
          join profiles pr on pr.id = dc.author_id
         where d.author_id = v_uid
           and dc.author_id <> v_uid
           and dc.created_at > coalesce(p.replies_seen_at, p.created_at)
         order by dc.created_at desc
         limit 20
      ) t
    ), '[]'::jsonb),

    -- Reacciones a tus ideas
    'reactions', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
                 'thread_id', r.discussion_id,
                 'author', pr.display_name,
                 'avatar', pr.avatar_url,
                 'emoji', r.emoji,
                 'excerpt', left(d.body, 90),
                 'created_at', r.created_at
               ) as x
          from reactions r
          join discussions d on d.id = r.discussion_id
          join profiles pr on pr.id = r.user_id
         where d.author_id = v_uid
           and r.user_id <> v_uid
           and r.created_at > coalesce(p.reactions_seen_at, p.created_at)
         order by r.created_at desc
         limit 20
      ) t
    ), '[]'::jsonb),

    -- Ideas nuevas del club, solo hasta donde has leído
    'ideas', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
                 'thread_id', d.id,
                 'author', pr.display_name,
                 'avatar', pr.avatar_url,
                 'chapter', d.chapter_number,
                 'body', left(d.body, 160),
                 'created_at', d.created_at
               ) as x
          from discussions d
          join profiles pr on pr.id = d.author_id
         where d.book_id = v_libro
           and d.author_id <> v_uid
           and d.chapter_number <= v_cap
           and d.created_at > coalesce(p.ideas_seen_at, p.created_at)
         order by d.created_at desc
         limit 20
      ) t
    ), '[]'::jsonb),

    -- Quién ha avanzado por delante de ti
    'ahead', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', pr.display_name,
               'avatar', pr.avatar_url,
               'chapter', rp.current_chapter
             ) order by rp.current_chapter desc)
        from reading_progress rp
        join club_members cm on cm.user_id = rp.user_id and cm.club_id = v_club
        join profiles pr on pr.id = rp.user_id
       where rp.book_id = v_libro
         and rp.user_id <> v_uid
         and rp.current_chapter > v_cap
         and rp.updated_at > coalesce(p.ahead_seen_at, p.created_at)
    ), '[]'::jsonb),

    'book_id', v_libro,
    'my_chapter', v_cap
  );
end;
$$;

revoke all on function public.club_news() from anon, public;
grant execute on function public.club_news() to authenticated;

-- ---------- 3 · El emblema puede ser una imagen ----------
alter table public.clubs
  add column if not exists emblem_url text;

comment on column public.clubs.emblem_url is
  'Imagen del escudo del club, subida al bucket avatars bajo clubs/. Si está, manda sobre el emoji.';

-- El bucket «avatars» acepta también la carpeta «clubs», donde solo
-- escriben el capitán y los administradores. La lectura ya era pública.
drop policy if exists "avatars_insert_club" on storage.objects;
create policy "avatars_insert_club"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from club_members cm
         where cm.user_id = auth.uid() and cm.role = 'captain'
      )
    )
  );

drop policy if exists "avatars_update_club" on storage.objects;
create policy "avatars_update_club"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from club_members cm
         where cm.user_id = auth.uid() and cm.role = 'captain'
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
  );

drop policy if exists "avatars_delete_club" on storage.objects;
create policy "avatars_delete_club"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and (
      public.is_super_admin()
      or exists (
        select 1 from club_members cm
         where cm.user_id = auth.uid() and cm.role = 'captain'
      )
    )
  );
