-- =====================================================================
-- 037 · «Juro que no hay spoiler»: la respuesta que no hace esperar
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- EL PROBLEMA
-- -----------
-- El candado es lo que hace especial a Tsundoku, pero tiene un coste que
-- se paga en las RESPUESTAS: si voy por el capítulo 30 y contesto a un
-- pensamiento tuyo del 12, mi respuesta se te sella hasta que llegues al
-- 30. Puede que tarde un mes. Para entonces la conversación ha muerto.
--
-- Y casi siempre mi respuesta no destripaba nada: era «sí, a mí también
-- me pasó con ese personaje».
--
-- LA SOLUCIÓN, EN DOS CONSENTIMIENTOS
-- -----------------------------------
--   1. Quien responde JURA que su respuesta no tiene spoiler. Es un acto
--      deliberado, con nombre y apellidos, y deja registro.
--   2. Quien recibe DECIDE si la abre. No se le enseña nada sin querer:
--      ve que hay una respuesta jurada y la abre si le apetece.
--
-- Sin los dos síes no se abre nada. Y esto vale SOLO para respuestas:
-- los pensamientos anclados a un capítulo que no has alcanzado siguen
-- sellados sin excepción, que es la regla madre y no se toca.
--
-- Para que el juramento no sea un formulismo, se guarda el historial:
-- cuántas veces has jurado y cuántas te han denunciado por spoiler. Se
-- enseña justo antes de abrir. Un juramento que no se puede romper no
-- vale nada; uno que se puede romper y se ve, sí.
--
-- De paso, dos cosas pequeñas que pedían a gritos:
--   · los saltos de línea se respetan (con un tope de dos seguidos)
--   · los pensamientos tienen un límite de verdad, 1500 caracteres
-- =====================================================================

-- ---------------------------------------------------------------
-- 1 · Saltos de línea y longitud
-- ---------------------------------------------------------------
-- Se conservan los saltos que escribe la gente, pero se recortan los
-- abusos: nada de veinte líneas en blanco para ocupar media pantalla.
create or replace function public.normalizar_cuerpo(t text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        replace(coalesce(t, ''), E'\r\n', E'\n'),
        E'[ \t]+\n', E'\n', 'g'
      ),
      E'\n{3,}', E'\n\n', 'g'
    )
  );
$$;

create or replace function public.limpiar_cuerpo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.body := public.normalizar_cuerpo(new.body);
  if new.body = '' then
    raise exception 'Escribe algo antes de publicarlo.';
  end if;
  return new;
end;
$$;

drop trigger if exists limpiar_cuerpo_discussions on public.discussions;
create trigger limpiar_cuerpo_discussions
  before insert or update of body on public.discussions
  for each row execute function public.limpiar_cuerpo();

drop trigger if exists limpiar_cuerpo_comments on public.discussion_comments;
create trigger limpiar_cuerpo_comments
  before insert or update of body on public.discussion_comments
  for each row execute function public.limpiar_cuerpo();

-- El tope baja de 4000 a 1500. Un pensamiento largo no es mejor: si no
-- cabe, es una entrada del muro. Va `not valid` para no tropezar con lo
-- que ya está escrito; lo nuevo sí se comprueba.
alter table public.discussions drop constraint if exists discussions_body_tope;
alter table public.discussions add constraint discussions_body_tope
  check (length(body) <= 1500) not valid;

alter table public.discussion_comments drop constraint if exists comments_body_tope;
alter table public.discussion_comments add constraint comments_body_tope
  check (length(body) <= 1500) not valid;

-- ---------------------------------------------------------------
-- 2 · El juramento
-- ---------------------------------------------------------------
alter table public.discussion_comments
  add column if not exists sworn_safe boolean not null default false;

comment on column public.discussion_comments.sworn_safe is
  'Su autor juró que la respuesta no destripa nada por delante del hilo.';

-- Lo que cada persona ha decidido abrir. Es SU decisión y solo la suya:
-- abrirla no se la abre a nadie más.
create table if not exists public.comment_reveals (
  comment_id uuid not null references public.discussion_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_reveals enable row level security;

drop policy if exists "comment_reveals_select_own" on public.comment_reveals;
create policy "comment_reveals_select_own" on public.comment_reveals
  for select to authenticated using (user_id = auth.uid());

-- Se abre solo por RPC: hay que comprobar que la respuesta lleva
-- juramento antes de dejar pasar a nadie.
revoke insert, update, delete on public.comment_reveals from anon, authenticated;
grant select on public.comment_reveals to authenticated;

-- ---------------------------------------------------------------
-- 3 · La vista de respuestas, con las dos puertas
-- ---------------------------------------------------------------
-- `unlocked` sigue significando lo mismo: puedes leerla. Lo nuevo es
-- `can_reveal`, que dice «esta está cerrada PERO su autor juró, así que
-- puedes abrirla tú si quieres».
create or replace view public.thread_comments as
select
  c.id, c.discussion_id, c.author_id, c.created_at,
  coalesce(c.author_chapter, d.chapter_number) as author_chapter,
  d.book_id,
  puerta.abierto as unlocked,
  case when puerta.abierto then c.body end as body,
  c.sworn_safe,
  (not puerta.abierto and c.sworn_safe) as can_reveal
from discussion_comments c
join discussions d on d.id = c.discussion_id
cross join lateral (
  select (
    c.author_id = auth.uid()
    or coalesce(c.author_chapter, d.chapter_number)
       <= public.current_chapter_of(auth.uid(), d.book_id)
    or coalesce(
         (select p.show_ahead_replies from public.profiles p where p.id = auth.uid()),
         false
       )
    or exists (
         select 1 from public.comment_reveals r
          where r.comment_id = c.id and r.user_id = auth.uid()
       )
  ) as abierto
) puerta
-- el hilo padre debe estar desbloqueado para ver siquiera el teaser
where d.author_id = auth.uid()
   or d.chapter_number <= public.current_chapter_of(auth.uid(), d.book_id);

alter view public.thread_comments set (security_invoker = false);
revoke all on public.thread_comments from anon, authenticated;
grant select on public.thread_comments to authenticated;

-- ---------------------------------------------------------------
-- 4 · Abrir una respuesta jurada
-- ---------------------------------------------------------------
create or replace function public.reveal_comment(p_comment uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_body text;
  v_jurada boolean;
  v_hilo_visible boolean;
begin
  if uid is null then raise exception 'forbidden'; end if;

  select c.body,
         c.sworn_safe,
         (d.author_id = uid
          or d.chapter_number <= public.current_chapter_of(uid, d.book_id))
    into v_body, v_jurada, v_hilo_visible
    from discussion_comments c
    join discussions d on d.id = c.discussion_id
   where c.id = p_comment;

  if v_body is null then
    raise exception 'Esa respuesta ya no existe.';
  end if;
  if not coalesce(v_hilo_visible, false) then
    raise exception 'Todavía no puedes ver este hilo.';
  end if;
  if not coalesce(v_jurada, false) then
    raise exception 'Esta respuesta no lleva juramento: se abrirá cuando llegues a su capítulo.';
  end if;

  insert into comment_reveals (comment_id, user_id)
  values (p_comment, uid)
  on conflict do nothing;

  return v_body;
end;
$$;

revoke all on function public.reveal_comment(uuid) from anon, public;
grant execute on function public.reveal_comment(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 5 · Quién se queda esperando si no juro
-- ---------------------------------------------------------------
-- Lo que se le enseña a quien responde ANTES de jurar, para que el
-- juramento tenga cara: «Marina y Jorge van por detrás de ti».
create or replace function public.quien_espera(p_discussion uuid)
returns table (user_id uuid, display_name text, avatar_url text, chapter int)
language sql
stable
security definer
set search_path = public
as $$
  select
    otros.user_id,
    p.display_name,
    p.avatar_url,
    coalesce(rp.current_chapter, 0)::int
  from discussions d
  join club_members yo on yo.user_id = auth.uid()
  join club_members otros
    on otros.club_id = yo.club_id and otros.user_id <> auth.uid()
  join profiles p on p.id = otros.user_id
  left join reading_progress rp
    on rp.user_id = otros.user_id and rp.book_id = d.book_id
  where d.id = p_discussion
    -- ven el hilo…
    and coalesce(rp.current_chapter, 0) >= d.chapter_number
    -- …pero van por detrás de mí, así que mi respuesta se les sellaría
    and coalesce(rp.current_chapter, 0)
        < public.current_chapter_of(auth.uid(), d.book_id)
    and not exists (
      select 1 from blocks b
       where (b.blocker_id = otros.user_id and b.blocked_id = auth.uid())
          or (b.blocker_id = auth.uid() and b.blocked_id = otros.user_id)
    )
  order by 4 desc;
$$;

revoke all on function public.quien_espera(uuid) from anon, public;
grant execute on function public.quien_espera(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 6 · El historial del juramento
-- ---------------------------------------------------------------
-- Cuántas veces ha jurado alguien y cuántas le han denunciado por
-- spoiler. Se enseña justo antes de abrir una respuesta suya: es lo que
-- convierte el juramento en algo que se puede perder.
create or replace function public.record_jurado(p_user uuid)
returns table (jurados int, fallos int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from discussion_comments c
      where c.author_id = p_user and c.sworn_safe),
    (select count(distinct r.target_id)::int from reports r
      where r.reported_user_id = p_user
        and r.target_type = 'comment'
        and r.reason = 'spoiler'
        and r.status <> 'dismissed');
$$;

revoke all on function public.record_jurado(uuid) from anon, public;
grant execute on function public.record_jurado(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 7 · El aviso: «te ha respondido y jura que no hay spoiler»
-- ---------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention', 'mention_wait',
                  'reply_sworn', 'all_ready'));
-- ('all_ready' es de la 038; va aquí también para que volver a ejecutar
--  esta migración después de aquella no borre un tipo que ya se usa)

-- El aviso jurado viaja con el mismo interruptor que las respuestas.
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

  if (new.type in ('reply', 'reply_sworn') and not prefs.reply)
  or (new.type = 'follow'         and not prefs.follow)
  or (new.type = 'poll'           and not prefs.poll)
  or (new.type = 'unlock'         and not prefs.unlock)
  or (new.type = 'book_done'      and not prefs.book_done)
  or (new.type = 'reaction'       and not prefs.reaction)
  or (new.type = 'new_idea'       and not prefs.new_idea)
  or (new.type = 'captain'        and not prefs.captain)
  or (new.type = 'next_book'      and not prefs.next_book)
  or (new.type = 'recommendation' and not prefs.recommendation)
  or (new.type in ('mention', 'mention_wait') and not prefs.mention)
  then
    return null;
  end if;

  return new;
end;
$$;

-- Aviso a todos los que se habrían quedado esperando.
create or replace function public.avisar_respuesta_jurada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v_cap int;
begin
  if not new.sworn_safe then
    return new;
  end if;

  select * into d from discussions where id = new.discussion_id;
  if not found then
    return new;
  end if;
  v_cap := coalesce(new.author_chapter, d.chapter_number);

  insert into notifications (user_id, actor_id, type, discussion_id, book_id, chapter_number)
  select otros.user_id, new.author_id, 'reply_sworn', new.discussion_id, d.book_id, v_cap
    from club_members yo
    join club_members otros
      on otros.club_id = yo.club_id and otros.user_id <> new.author_id
    left join reading_progress rp
      on rp.user_id = otros.user_id and rp.book_id = d.book_id
   where yo.user_id = new.author_id
     and coalesce(rp.current_chapter, 0) >= d.chapter_number
     and coalesce(rp.current_chapter, 0) < v_cap
     and not exists (
       select 1 from blocks b
        where (b.blocker_id = otros.user_id and b.blocked_id = new.author_id)
           or (b.blocker_id = new.author_id and b.blocked_id = otros.user_id)
     );

  return new;
end;
$$;

drop trigger if exists avisar_respuesta_jurada_after_insert on public.discussion_comments;
create trigger avisar_respuesta_jurada_after_insert
  after insert on public.discussion_comments
  for each row execute function public.avisar_respuesta_jurada();

-- El autor del hilo no debe recibir DOS avisos por la misma respuesta:
-- si le llega el jurado, el normal sobra.
create or replace function public.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v_cap int;
  v_autor_atras boolean;
begin
  select * into d from discussions where id = new.discussion_id;
  if not found or d.author_id is null or d.author_id = new.author_id then
    return new;
  end if;

  v_cap := coalesce(new.author_chapter, d.chapter_number);
  v_autor_atras := public.current_chapter_of(d.author_id, d.book_id) < v_cap;

  -- Si la respuesta va jurada y el autor del hilo se queda detrás, el
  -- aviso que recibe es el jurado, que además le explica qué hacer.
  if new.sworn_safe and v_autor_atras then
    return new;
  end if;

  insert into notifications (user_id, actor_id, type, discussion_id)
  values (d.author_id, new.author_id, 'reply', new.discussion_id);

  return new;
end;
$$;
