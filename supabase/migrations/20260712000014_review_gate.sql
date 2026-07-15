-- =====================================================================
-- Tsundoku Zero — Reseñas ocultas hasta terminar el libro (anti-spoiler)
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
-- El TEXTO de una reseña solo se puede leer si has TERMINADO el libro
-- (o si es tuya). La valoración numérica (estrellas) sí es visible: no
-- es spoiler. Se aplica en servidor: el texto no viaja al cliente.
-- =====================================================================

-- 1) Bloqueo a nivel de columna: nadie lee `review` directamente de la
--    tabla; solo la vista enmascarada de abajo puede.
revoke select on book_ratings from anon, authenticated;
grant select (book_id, user_id, rating, created_at) on book_ratings
  to anon, authenticated;

-- 2) Vista enmascarada: review = null salvo que hayas terminado el libro
--    (o sea tu propia reseña). `has_review` indica que existe una reseña
--    sin revelar su contenido (para poder decir «N reseñas, termina el
--    libro para leerlas»).
create or replace view public.book_reviews as
select
  r.book_id,
  r.user_id,
  r.rating,
  r.created_at,
  (r.review is not null and length(trim(r.review)) > 0) as has_review,
  case
    when r.user_id = auth.uid()
      or exists (
        select 1 from reading_progress rp
        where rp.user_id = auth.uid()
          and rp.book_id = r.book_id
          and rp.status = 'finished'
      )
    then r.review
  end as review
from book_ratings r;

alter view public.book_reviews set (security_invoker = false);
revoke all on public.book_reviews from anon, authenticated;
grant select on public.book_reviews to authenticated;
