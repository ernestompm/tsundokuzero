-- =====================================================================
-- 035 · Menciones, con entrega diferida
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- «@carlos, esto me ha recordado a ti.»
--
-- EL PROBLEMA QUE NADIE MÁS TIENE
-- -------------------------------
-- En cualquier otra app mencionar es trivial: escribes @alguien y le
-- llega. Aquí no, porque los mensajes están sellados por capítulo. Si
-- mencionas a Carlos en el capítulo 40 y Carlos va por el 12, avisarle
-- ahora sería destriparle que en el 40 pasa algo.
--
-- LA SOLUCIÓN, QUE ADEMÁS ES MEJOR
-- --------------------------------
-- La mención se guarda y se ENTREGA cuando Carlos llega a ese capítulo.
-- No se pierde y no destripa nada: le llega exactamente en el momento en
-- que puede entenderla. El candado deja de quitar y pasa a guardar.
-- =====================================================================

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  -- De dónde sale: una idea o una respuesta
  discussion_id uuid references discussions(id) on delete cascade,
  comment_id uuid references discussion_comments(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  -- Capítulo a partir del cual se puede entregar sin destripar nada
  chapter_number int not null default 0,
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- null = todavía esperando a que llegue a ese capítulo
  delivered_at timestamptz,
  constraint mentions_origen check (discussion_id is not null or comment_id is not null),
  constraint mentions_no_self check (from_user <> to_user)
);

create unique index if not exists mentions_unica_disc
  on public.mentions (discussion_id, to_user) where discussion_id is not null;
create unique index if not exists mentions_unica_com
  on public.mentions (comment_id, to_user) where comment_id is not null;
create index if not exists mentions_pendientes_idx
  on public.mentions (to_user, book_id) where delivered_at is null;

alter table public.mentions enable row level security;

-- Solo la ves si te mencionaron o mencionaste tú
drop policy if exists "mentions_select_mine" on public.mentions;
create policy "mentions_select_mine" on public.mentions
  for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

revoke insert, update, delete on public.mentions from anon, authenticated;
grant select on public.mentions to authenticated;

-- Tipo de aviso nuevo
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention'));
alter table public.notification_prefs
  add column if not exists mention boolean not null default true;

create or replace function public.notification_pref_allows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.notification_prefs%rowtype;
begin
  select * into prefs from public.notification_prefs where user_id = new.user_id;
  if not found then
    return new;
  end if;

  if (new.type = 'reply'          and not prefs.reply)
  or (new.type = 'follow'         and not prefs.follow)
  or (new.type = 'poll'           and not prefs.poll)
  or (new.type = 'unlock'         and not prefs.unlock)
  or (new.type = 'book_done'      and not prefs.book_done)
  or (new.type = 'reaction'       and not prefs.reaction)
  or (new.type = 'new_idea'       and not prefs.new_idea)
  or (new.type = 'captain'        and not prefs.captain)
  or (new.type = 'next_book'      and not prefs.next_book)
  or (new.type = 'recommendation' and not prefs.recommendation)
  or (new.type = 'mention'        and not prefs.mention)
  then
    return null;
  end if;

  return new;
end;
$$;

-- ---------- Guardar la mención y entregarla si ya se puede ----------
create or replace function public.registrar_menciones(
  p_texto text,
  p_from uuid,
  p_discussion uuid,
  p_comment uuid,
  p_book uuid,
  p_chapter int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
  v_id uuid;
  v_cap int;
  v_nueva boolean;
begin
  if p_texto is null or p_texto = '' then
    return;
  end if;

  -- Un @usuario por cada coincidencia. La arroba tiene que ir al principio
  -- o detrás de algo que no sea letra, número ni otra arroba: si no,
  -- «hola@dominio.com» se leería como una mención a «dominio».
  for v_user in
    select distinct lower(m[2])
      from regexp_matches(p_texto, '(^|[^A-Za-z0-9_@])@([a-z0-9_]{3,20})', 'g') as m
  loop
    select id into v_id from profiles where username = v_user;
    continue when v_id is null or v_id = p_from;

    -- Solo se menciona a gente de tu club: ni desconocidos ni bloqueos
    if not exists (
      select 1 from club_members a
        join club_members b on b.club_id = a.club_id
       where a.user_id = p_from and b.user_id = v_id
    ) then
      continue;
    end if;
    if exists (
      select 1 from blocks
       where (blocker_id = v_id and blocked_id = p_from)
          or (blocker_id = p_from and blocked_id = v_id)
    ) then
      continue;
    end if;

    -- ¿Por dónde va esa persona en este libro?
    select coalesce(rp.current_chapter, 0) into v_cap
      from reading_progress rp
     where rp.user_id = v_id and rp.book_id = p_book;
    v_cap := coalesce(v_cap, 0);

    v_nueva := v_cap >= coalesce(p_chapter, 0);

    insert into mentions (
      discussion_id, comment_id, book_id, chapter_number,
      from_user, to_user, delivered_at
    )
    values (
      p_discussion, p_comment, p_book, coalesce(p_chapter, 0),
      p_from, v_id, case when v_nueva then now() end
    )
    on conflict do nothing;

    -- Si ya ha llegado a ese capítulo, se le avisa al momento
    if v_nueva then
      insert into notifications (user_id, actor_id, type, discussion_id, book_id)
      values (v_id, p_from, 'mention', p_discussion, p_book);
    end if;
  end loop;
end;
$$;

revoke all on function public.registrar_menciones(text, uuid, uuid, uuid, uuid, int)
  from anon, public, authenticated;

-- ---------- Al publicar una idea ----------
create or replace function public.menciones_en_idea()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.registrar_menciones(
    new.body, new.author_id, new.id, null, new.book_id, new.chapter_number
  );
  return new;
end;
$$;

drop trigger if exists discussions_menciones on public.discussions;
create trigger discussions_menciones
  after insert on public.discussions
  for each row execute function public.menciones_en_idea();

-- ---------- Al responder ----------
create or replace function public.menciones_en_respuesta()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare d record;
begin
  select book_id, chapter_number into d from discussions where id = new.discussion_id;
  perform public.registrar_menciones(
    new.body, new.author_id, new.discussion_id, new.id, d.book_id,
    greatest(coalesce(new.author_chapter, 0), coalesce(d.chapter_number, 0))
  );
  return new;
end;
$$;

drop trigger if exists comments_menciones on public.discussion_comments;
create trigger comments_menciones
  after insert on public.discussion_comments
  for each row execute function public.menciones_en_respuesta();

-- ---------- Al avanzar: se entrega lo que estaba esperando ----------
-- Mismo patrón que el aviso de respuestas desbloqueadas de la migr. 011.
create or replace function public.entregar_menciones()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.current_chapter > coalesce(old.current_chapter, 0) then
    insert into notifications (user_id, actor_id, type, discussion_id, book_id)
    select m.to_user, m.from_user, 'mention', m.discussion_id, m.book_id
      from mentions m
     where m.to_user = new.user_id
       and m.book_id = new.book_id
       and m.delivered_at is null
       and m.chapter_number <= new.current_chapter;

    update mentions
       set delivered_at = now()
     where to_user = new.user_id
       and book_id = new.book_id
       and delivered_at is null
       and chapter_number <= new.current_chapter;
  end if;
  return new;
end;
$$;

drop trigger if exists reading_progress_menciones on public.reading_progress;
create trigger reading_progress_menciones
  after update on public.reading_progress
  for each row execute function public.entregar_menciones();

-- ---------- A quién puedes mencionar ----------
-- La lista para el autocompletado: la gente de tu club, sin bloqueos.
create or replace function public.mentionables()
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.username, p.display_name, p.avatar_url
    from club_members a
    join club_members b on b.club_id = a.club_id
    join profiles p on p.id = b.user_id
   where a.user_id = auth.uid()
     and b.user_id <> auth.uid()
     and not exists (
       select 1 from blocks
        where (blocker_id = p.id and blocked_id = auth.uid())
           or (blocker_id = auth.uid() and blocked_id = p.id)
     )
   order by p.display_name;
$$;

revoke all on function public.mentionables() from anon, public;
grant execute on function public.mentionables() to authenticated;

-- ---------- Menciones tuyas que aún esperan ----------
-- Para poder decir «cuando llegues al capítulo 40 te espera algo».
create or replace function public.pending_mentions()
returns table (book_id uuid, chapter_number int, cuantas int)
language sql
stable
security definer
set search_path = public
as $$
  select m.book_id, min(m.chapter_number)::int, count(*)::int
    from mentions m
   where m.to_user = auth.uid() and m.delivered_at is null
   group by m.book_id;
$$;

revoke all on function public.pending_mentions() from anon, public;
grant execute on function public.pending_mentions() to authenticated;
