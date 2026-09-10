-- =====================================================================
-- 036 · «Te han mencionado más adelante»: el aviso que empuja a leer
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- QUÉ CAMBIA
-- ----------
-- En la 035 una mención por delante de tu punto de lectura se guardaba en
-- silencio y solo aparecía al llegar. Se cumplía el candado, sí, pero se
-- perdía lo mejor: saber que alguien pensó en ti unos capítulos más
-- adelante es la mejor razón del mundo para seguir leyendo esta noche.
--
-- Ahora se avisa AL MOMENTO, pero sin contar nada:
--
--     «Ernesto te ha mencionado en un pensamiento del capítulo 40.
--      Te faltan 28 capítulos para poder leerlo.»
--
-- Quién y dónde, nunca qué. El aviso lleva a la ficha del libro, que es
-- donde se marca el progreso, no al hilo, que sigue cerrado. Y cuando de
-- verdad llegas, salta el aviso bueno con el enlace al mensaje.
-- =====================================================================

-- El capítulo en el aviso, para poder decirlo sin consultar nada más
alter table public.notifications
  add column if not exists chapter_number int;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention', 'mention_wait'));

-- El aviso de espera se apaga con el mismo interruptor que las menciones:
-- son la misma cosa contada en dos momentos.
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
  or (new.type in ('mention', 'mention_wait') and not prefs.mention)
  then
    return null;
  end if;

  return new;
end;
$$;

-- ---------- Registrar la mención, avisando en los dos casos ----------
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
  v_puede boolean;
  v_filas int;
begin
  if p_texto is null or p_texto = '' then
    return;
  end if;

  -- La arroba tiene que ir al principio o detrás de algo que no sea
  -- letra, número ni otra arroba: si no, «hola@dominio.com» se leería
  -- como una mención a «dominio».
  for v_user in
    select distinct lower(m[2])
      from regexp_matches(p_texto, '(^|[^A-Za-z0-9_@])@([a-z0-9_]{3,20})', 'g') as m
  loop
    select id into v_id from profiles where username = v_user;
    continue when v_id is null or v_id = p_from;

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

    select coalesce(rp.current_chapter, 0) into v_cap
      from reading_progress rp
     where rp.user_id = v_id and rp.book_id = p_book;
    v_cap := coalesce(v_cap, 0);

    v_puede := v_cap >= coalesce(p_chapter, 0);

    insert into mentions (
      discussion_id, comment_id, book_id, chapter_number,
      from_user, to_user, delivered_at
    )
    values (
      p_discussion, p_comment, p_book, coalesce(p_chapter, 0),
      p_from, v_id, case when v_puede then now() end
    )
    on conflict do nothing;

    -- Si no se insertó nada, ya estaba mencionado ahí: no se repite el aviso
    get diagnostics v_filas = row_count;
    continue when v_filas = 0;

    if v_puede then
      -- Puede leerlo ya: al mensaje directamente
      insert into notifications (user_id, actor_id, type, discussion_id, book_id, chapter_number)
      values (v_id, p_from, 'mention', p_discussion, p_book, coalesce(p_chapter, 0));
    else
      -- Todavía no: se le dice QUIÉN y DÓNDE, nunca qué, y el aviso lleva
      -- a la ficha del libro para que marque por dónde va.
      insert into notifications (user_id, actor_id, type, book_id, chapter_number)
      values (v_id, p_from, 'mention_wait', p_book, coalesce(p_chapter, 0));
    end if;
  end loop;
end;
$$;

revoke all on function public.registrar_menciones(text, uuid, uuid, uuid, uuid, int)
  from anon, public, authenticated;

-- ---------- Al llegar: el aviso bueno, con su enlace ----------
create or replace function public.entregar_menciones()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.current_chapter > coalesce(old.current_chapter, 0) then
    insert into notifications (user_id, actor_id, type, discussion_id, book_id, chapter_number)
    select m.to_user, m.from_user, 'mention', m.discussion_id, m.book_id, m.chapter_number
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

-- ---------- Lo que te espera, para poder insistir en la app ----------
-- Devuelve, por libro, el capítulo más cercano donde te espera algo,
-- cuántas menciones hay y quién te mencionó. Nunca el contenido.
create or replace function public.pending_mentions()
returns table (
  book_id uuid,
  book_title text,
  chapter_number int,
  my_chapter int,
  total_chapters int,
  cuantas int,
  quien text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.book_id,
    b.title,
    min(m.chapter_number)::int,
    coalesce(max(rp.current_chapter), 0)::int,
    b.total_chapters,
    count(*)::int,
    (select p.display_name
       from mentions m2
       join profiles p on p.id = m2.from_user
      where m2.to_user = auth.uid()
        and m2.book_id = m.book_id
        and m2.delivered_at is null
      order by m2.chapter_number asc
      limit 1)
  from mentions m
  join books b on b.id = m.book_id
  left join reading_progress rp
    on rp.book_id = m.book_id and rp.user_id = auth.uid()
  where m.to_user = auth.uid() and m.delivered_at is null
  group by m.book_id, b.title, b.total_chapters;
$$;

revoke all on function public.pending_mentions() from anon, public;
grant execute on function public.pending_mentions() to authenticated;
