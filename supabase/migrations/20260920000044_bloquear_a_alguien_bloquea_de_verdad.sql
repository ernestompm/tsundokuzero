-- =====================================================================
-- 044 · Bloquear a alguien tenía que bloquearle del todo
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Los bloqueos se aplicaban en CUATRO pantallas (Inicio, capítulo, hilo
-- y avisos) llamando a `fetchBlockedIds` desde el cliente. Las otras
-- seis no los aplicaban, y así es como se acaba con una séptima: cada
-- pantalla nueva tiene que acordarse.
--
-- Lo más gordo que se colaba era la RESEÑA, que es el texto más personal
-- que hay en la app: bloqueabas a alguien y seguías leyendo lo que
-- escribió en la ficha del libro y en Opiniones.
--
-- Se arregla donde ya vive el candado —en la vista, en el servidor—, no
-- añadiendo un filtro más a seis sitios. `mentionables` y
-- `recommend_book` ya lo hacían bien; les faltaba compañía.
-- =====================================================================

create or replace function public.bloqueado(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = p_user)
        or (b.blocker_id = p_user and b.blocked_id = auth.uid())
  );
$$;

grant execute on function public.bloqueado(uuid) to authenticated;

-- ---------- Las reseñas de quien has bloqueado no existen ----------
-- Tu propia fila nunca se filtra: bloquearte a ti mismo no se puede, y
-- aun así conviene que la regla sea explícita.
drop view if exists public.book_reviews;
create view public.book_reviews as
select
  r.book_id,
  r.user_id,
  r.rating,
  r.d_think,
  r.d_flow,
  r.d_feel,
  r.d_recommend,
  r.created_at,
  (r.review is not null and length(trim(r.review)) > 0) as has_review,
  not exists (
    select 1
      from club_readings cr
      join club_members cm
        on cm.club_id = cr.club_id and cm.user_id = auth.uid()
     where cr.book_id = r.book_id and cr.premiered_at is null
  ) as premiered,
  case
    when r.user_id = auth.uid() then r.review
    when exists (
           select 1 from reading_progress rp
            where rp.user_id = auth.uid()
              and rp.book_id = r.book_id
              and rp.status = 'finished'
         )
     and not exists (
           select 1
             from club_readings cr
             join club_members cm
               on cm.club_id = cr.club_id and cm.user_id = auth.uid()
            where cr.book_id = r.book_id and cr.premiered_at is null
         )
    then r.review
  end as review
from book_ratings r
where r.user_id = auth.uid() or not public.bloqueado(r.user_id);

alter view public.book_reviews set (security_invoker = false);
revoke all on public.book_reviews from anon, authenticated;
grant select on public.book_reviews to authenticated;

-- ---------------------------------------------------------------
-- Lo que NO se toca aquí, y por qué
-- ---------------------------------------------------------------
-- Los contadores de «lo nuevo» (`club_activity`, `club_news`) también
-- cuentan la actividad de gente bloqueada: dicen «3 ideas nuevas» y al
-- entrar hay dos, porque el cliente esconde la tercera después de
-- haberla contado. Es un fallo real, pero de recuento, no de fuga: el
-- contenido no se ve.
--
-- No se arreglan en esta migración a propósito. Son dos funciones largas
-- que funcionan, y reescribirlas aquí significa copiarlas enteras para
-- añadir una línea — que es justo como se rompen las cosas que iban
-- bien. Se filtran cuando haya que tocarlas por otro motivo.
