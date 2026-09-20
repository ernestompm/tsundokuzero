-- =====================================================================
-- 042 · Agujeros de proceso, encontrados buscándolos
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Cuatro fallos que no da ninguna pantalla: son de los que pasan una vez
-- cada muchas y nadie relaciona con nada. Todos de la misma familia que
-- el de las menciones atascadas — dar por hecho que algo va a saltar, o
-- que solo hay un club.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1 · Editar un pensamiento ya no se traga las menciones nuevas
-- ---------------------------------------------------------------
-- Desde que se puede editar lo publicado, alguien puede añadir un
-- «@marina» al corregir su texto. Los disparadores de menciones estaban
-- declarados `after insert`, así que esa mención no existía para nadie:
-- ni aviso, ni entrega al llegar al capítulo. Silenciosa del todo.
--
-- Registrar dos veces no duplica nada: los índices únicos de `mentions`
-- lo impiden y `registrar_menciones` solo avisa si la fila es nueva.
drop trigger if exists discussions_menciones on public.discussions;
create trigger discussions_menciones
  after insert or update of body on public.discussions
  for each row execute function public.menciones_en_idea();

drop trigger if exists comments_menciones on public.discussion_comments;
create trigger comments_menciones
  after insert or update of body on public.discussion_comments
  for each row execute function public.menciones_en_respuesta();

-- ---------------------------------------------------------------
-- 2 · Terminar un libro cuenta aunque sea la primera marca
-- ---------------------------------------------------------------
-- `notify_book_finished_by_all` hace dos cosas grandes: ESTRENA las
-- reseñas del club (pone `premiered_at`) y avisa a todo el mundo. Estaba
-- declarado `after update`, y la primera vez que alguien toca su
-- progreso no es un update: es un insert. Si la última persona que
-- faltaba marcaba «terminado» sin haber marcado nunca antes —o lo metía
-- ya terminado desde su estantería—, el club se quedaba sin estreno y
-- sin aviso, y las reseñas sin abrir. Exactamente el mismo fallo que
-- tenían las menciones.
create or replace function public.notify_book_finished_by_all()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cl record;
  total int;
  done int;
  v_antes text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if new.status = 'finished' and v_antes is distinct from 'finished' then
    for cl in select id from clubs where current_book_id = new.book_id loop
      select count(*) into total from club_members where club_id = cl.id;
      select count(*) into done
        from club_members m
        join reading_progress rp
          on rp.user_id = m.user_id and rp.book_id = new.book_id
       where m.club_id = cl.id and rp.status = 'finished';

      if total > 0 and done >= total then
        -- El estreno: se abren todas las reseñas a la vez
        update club_readings
           set premiered_at = now()
         where club_id = cl.id and book_id = new.book_id and premiered_at is null;

        -- Una sola vez. Antes, cualquier cambio de progreso posterior de
        -- cualquier miembro volvía a cumplir la condición y repetía el
        -- aviso a todo el club: con el disparador abierto también a los
        -- inserts, eso pasaría más a menudo.
        if not exists (
          select 1 from notifications n
            join club_members m2 on m2.user_id = n.user_id and m2.club_id = cl.id
           where n.type = 'book_done' and n.book_id = new.book_id
        ) then
          insert into notifications (user_id, type, book_id)
          select m.user_id, 'book_done', new.book_id from club_members m
           where m.club_id = cl.id;
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists reading_progress_book_done_after_update on public.reading_progress;
create trigger reading_progress_book_done
  after insert or update on public.reading_progress
  for each row execute function public.notify_book_finished_by_all();

-- Lo mismo para el aviso de «se ha desbloqueado una respuesta a tu
-- mensaje»: avanzar por primera vez también desbloquea cosas.
create or replace function public.notify_unlocked_replies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes int := case when tg_op = 'INSERT' then 0
                      else coalesce(old.current_chapter, 0) end;
begin
  if new.current_chapter > v_antes then
    insert into notifications (user_id, actor_id, type, discussion_id)
    select new.user_id, c.author_id, 'unlock', c.discussion_id
      from discussion_comments c
      join discussions d on d.id = c.discussion_id
     where d.author_id = new.user_id
       and d.book_id = new.book_id
       and c.author_id <> new.user_id
       and coalesce(c.author_chapter, d.chapter_number) > v_antes
       and coalesce(c.author_chapter, d.chapter_number) <= new.current_chapter;
  end if;
  return new;
end;
$$;

drop trigger if exists reading_progress_unlock_after_update on public.reading_progress;
create trigger reading_progress_unlock
  after insert or update on public.reading_progress
  for each row execute function public.notify_unlocked_replies();

-- ---------------------------------------------------------------
-- 3 · La votación no puede elegir el libro que ya estáis leyendo
-- ---------------------------------------------------------------
-- Si el libro ganador es el que el club tiene entre manos, se quedaba
-- como «próxima lectura», y al cerrar el libro el club «empezaba» otra
-- vez el mismo. `start_club_bis` ya se protegía de esto; el cierre de
-- votación no.
create or replace function public.handle_poll_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book uuid;
  v_actual uuid;
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
      select po.book_id into v_book
        from poll_options po where po.id = new.winner_option_id;

      select c.current_book_id into v_actual from clubs c where c.id = new.club_id;

      -- Ganar la votación con el libro que ya se está leyendo no cambia
      -- nada: la votación se cierra y el club sigue como estaba.
      if v_book is not null and v_book is distinct from v_actual then
        if v_actual is null then
          update clubs set current_book_id = v_book, next_book_id = null,
                           next_starts_at = null
           where id = new.club_id;
        else
          update clubs set next_book_id = v_book where id = new.club_id;
        end if;

        -- A quien la propuso no hay que avisarle de su propio libro
        insert into notifications (user_id, type, book_id, club_id)
        select cm.user_id, 'next_book', v_book, new.club_id
          from club_members cm
         where cm.club_id = new.club_id
           and cm.user_id is distinct from new.created_by;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 4 · Un capitán manda en SU club, no en todos
-- ---------------------------------------------------------------
-- `set_book_chapters` dejaba tocar el número de capítulos de cualquier
-- libro a cualquiera que fuese capitán de cualquier club. Con un solo
-- club daba igual; desde que se pueden fundar clubes, el capitán del
-- club B podía reescribir el libro que está leyendo el club A — y el
-- candado anti-spoiler depende de ese número.
create or replace function public.set_book_chapters(p_book uuid, p_total int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_usado int;
begin
  if auth.uid() is null then
    raise exception 'forbidden: hace falta sesión';
  end if;

  -- Admin, quien creó el libro, o el capitán de un club que lo esté
  -- leyendo (ahora o como próxima lectura).
  if not public.is_super_admin()
     and not exists (select 1 from books b where b.id = p_book and b.created_by = auth.uid())
     and not exists (
       select 1 from club_members cm
         join clubs c on c.id = cm.club_id
        where cm.user_id = auth.uid()
          and cm.role = 'captain'
          and (c.current_book_id = p_book or c.next_book_id = p_book
               or exists (select 1 from club_readings cr
                           where cr.club_id = c.id and cr.book_id = p_book))
     )
  then
    raise exception 'forbidden: solo el capitán del club que lo lee, quien lo añadió o un admin';
  end if;

  if p_total is null or p_total < 1 or p_total > 500 then
    raise exception 'El número de capítulos debe estar entre 1 y 500.';
  end if;

  select greatest(
           coalesce((select max(d.chapter_number) from discussions d where d.book_id = p_book), 0),
           coalesce((select max(rp.current_chapter) from reading_progress rp where rp.book_id = p_book), 0)
         )
    into v_max_usado;

  if p_total < v_max_usado then
    raise exception 'Ya hay lectura o conversación hasta el capítulo %; no puedes bajar de ahí.', v_max_usado;
  end if;

  insert into chapters (book_id, number, label)
  select p_book, g, null
    from generate_series(1, p_total) as g
   where not exists (
     select 1 from chapters c where c.book_id = p_book and c.number = g
   );

  delete from chapters c where c.book_id = p_book and c.number > p_total;

  update books
     set total_chapters = p_total,
         chapters_confirmed = true
   where id = p_book;

  return p_total;
end;
$$;

-- ---------------------------------------------------------------
-- 5 · «El club» de un admin es el suyo, no el más antiguo
-- ---------------------------------------------------------------
-- Seis funciones caen a `select id from clubs order by created_at limit
-- 1` cuando quien llama es super admin y no capitán. Con varios clubes
-- eso significa «el club fundador», que casi nunca es el que el admin
-- está mirando.
--
-- OJO: aquí solo se deja la pieza. Cambiar las seis funciones es
-- reescribirlas enteras, y el fallo solo se dispara cuando un super
-- admin que NO es capitán actúa sobre un club habiendo varios — que hoy
-- no pasa. Se sustituye una a una según se toquen, no de golpe.
create or replace function public.club_del_mando()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  -- Primero: el club donde SOY capitán
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain'
   limit 1;
  if v_club is not null then return v_club; end if;

  if not public.is_super_admin() then return null; end if;

  -- Un admin manda también donde sea miembro sin ser capitán
  select cm.club_id into v_club
    from club_members cm where cm.user_id = auth.uid()
   order by cm.joined_at limit 1;
  if v_club is not null then return v_club; end if;

  -- Y si no está en ninguno, el fundador, como hasta ahora
  select c.id into v_club from clubs c order by c.created_at limit 1;
  return v_club;
end;
$$;

revoke all on function public.club_del_mando() from anon, public;
grant execute on function public.club_del_mando() to authenticated;

-- ---------------------------------------------------------------
-- 6 · Editar una respuesta jurada rompe el juramento
-- ---------------------------------------------------------------
-- Esto lo abrí yo al permitir editar lo publicado: juro que mi respuesta
-- no destripa nada, tú la abres confiando en eso, y después la edito y
-- meto el spoiler. Tú ya la tenías abierta.
--
-- El juramento es sobre UN TEXTO, no sobre una fila. Si el texto cambia,
-- el juramento se cae y las aperturas que provocó también: vuelve a estar
-- sellada hasta que su autor la vuelva a jurar.
create or replace function public.romper_juramento_al_editar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.body is distinct from old.body and old.sworn_safe then
    new.sworn_safe := false;
    delete from comment_reveals where comment_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists romper_juramento_al_editar on public.discussion_comments;
create trigger romper_juramento_al_editar
  before update of body on public.discussion_comments
  for each row execute function public.romper_juramento_al_editar();

-- ---------------------------------------------------------------
-- 7 · Un pensamiento editado no puede cambiar de capítulo
-- ---------------------------------------------------------------
-- El candado entero cuelga de `chapter_number`. Editar el texto está
-- bien; mover el ancla a un capítulo anterior abriría de golpe un hilo
-- que estaba sellado para media docena de personas. La política de
-- UPDATE de `discussions` deja escribir cualquier columna propia, así
-- que esto se cierra aquí.
create or replace function public.ancla_inmovil()
returns trigger
language plpgsql
as $$
begin
  new.chapter_number := old.chapter_number;
  new.book_id := old.book_id;
  new.author_id := old.author_id;
  return new;
end;
$$;

drop trigger if exists ancla_inmovil on public.discussions;
create trigger ancla_inmovil
  before update on public.discussions
  for each row execute function public.ancla_inmovil();
