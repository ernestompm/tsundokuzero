-- =====================================================================
-- 039 · Un aviso que falla no puede tumbar la respuesta
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- EL FALLO
-- --------
-- Responder jurando devolvía «no tienes permiso». La respuesta en sí era
-- perfectamente legal: lo que fallaba era el AVISO que se manda detrás,
-- en un trigger, y al reventar el trigger se caía toda la transacción.
--
-- La causa más probable es el CHECK de `notifications.type`: la 036 lo
-- define sin 'reply_sworn', así que basta con haber reejecutado la 036
-- después de la 037 —cosa que pedí yo mismo para arreglar otra cosa—
-- para que el tipo de aviso nuevo deje de ser válido. Aquí se vuelve a
-- dejar la lista completa.
--
-- Pero el arreglo de verdad es el otro: **ningún efecto secundario puede
-- impedir la acción del usuario**. Escribir una respuesta es lo que ha
-- pedido; mandar el aviso es cosa nuestra. Si lo segundo falla, que falle
-- en silencio y que la respuesta se guarde igual. Es exactamente lo que
-- ya hacía el envío de push desde la 023 («jamás tumbar la creación del
-- aviso»); faltaba aplicarlo un escalón más arriba.
-- =====================================================================

-- ---------- 1 · La lista completa de tipos de aviso ----------
-- Esta es LA lista. Cualquier migración futura que toque este check debe
-- copiarla entera y añadir lo suyo, nunca reescribirla desde cero.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done',
                  'moderation', 'reaction', 'new_idea', 'captain',
                  'next_book', 'recommendation', 'mention', 'mention_wait',
                  'reply_sworn', 'all_ready'));

-- ---------- 2 · Avisar no puede impedir responder ----------
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

  -- Si el aviso no se puede escribir, la respuesta se guarda igual: lo
  -- que ha pedido esta persona es responder, no notificar.
  begin
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
  exception
    when others then null;
  end;

  return new;
end;
$$;

-- ---------- 3 · Lo mismo para el aviso normal de respuesta ----------
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

  begin
    insert into notifications (user_id, actor_id, type, discussion_id)
    values (d.author_id, new.author_id, 'reply', new.discussion_id);
  exception
    when others then null;
  end;

  return new;
end;
$$;

-- ---------- 4 · Y para el aviso de «ya lo tenemos todos» ----------
-- Mismo principio: marcar que tienes el libro no puede fallar porque el
-- capitán no se pueda enterar.
create or replace function public.avisar_todos_listos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_faltan int;
  v_capitan uuid;
begin
  begin
    select c.id into v_club from clubs c where c.next_book_id = new.book_id;
    if v_club is null then
      return new;
    end if;

    select count(*) into v_faltan
      from club_members m
     where m.club_id = v_club
       and not exists (
         select 1 from book_ready r
          where r.book_id = new.book_id and r.user_id = m.user_id
       );
    if v_faltan > 0 then
      return new;
    end if;

    select m.user_id into v_capitan
      from club_members m
     where m.club_id = v_club and m.role = 'captain'
     limit 1;
    if v_capitan is null then
      return new;
    end if;

    -- Una vez y no más, aunque alguien lo desmarque y lo vuelva a marcar
    if exists (
      select 1 from notifications n
       where n.user_id = v_capitan
         and n.type = 'all_ready'
         and n.book_id = new.book_id
    ) then
      return new;
    end if;

    insert into notifications (user_id, actor_id, type, book_id)
    values (v_capitan, null, 'all_ready', new.book_id);
  exception
    when others then null;
  end;

  return new;
end;
$$;

-- ---------- 5 · `is_beta()` no tiene por qué contestarle a anon ----------
-- Se quedó sin el revoke de rigor en la 038: no filtra nada (para anon
-- devuelve false), pero no pinta nada contestando sin sesión.
revoke all on function public.is_beta() from anon, public;
grant execute on function public.is_beta() to authenticated;
