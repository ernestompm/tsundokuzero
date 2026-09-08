-- =====================================================================
-- 025 · Guardar reseña por RPC (arregla «No tienes permiso» al reseñar)
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- CAUSA
-- -----
-- La migración 014 oculta la columna `book_ratings.review` con un
-- privilegio de COLUMNA (authenticated solo puede hacer SELECT de
-- book_id, user_id, rating, created_at). Es correcto: así el texto de
-- una reseña nunca viaja al cliente salvo por la vista enmascarada
-- `book_reviews`.
--
-- PERO el cliente guardaba la reseña con un UPSERT de PostgREST, que se
-- traduce en:
--     insert ... on conflict (book_id, user_id)
--       do update set ..., review = EXCLUDED.review
-- y PostgreSQL exige privilegio SELECT sobre toda columna leída en las
-- expresiones del ON CONFLICT (aquí EXCLUDED.review). Sin SELECT sobre
-- `review` → «permission denied for table book_ratings» → la app lo
-- traducía a «No tienes permiso para hacer esto».
--
-- ARREGLO
-- -------
-- La escritura pasa por una RPC SECURITY DEFINER que:
--   · exige sesión y que el libro esté TERMINADO (mismo requisito que la
--     política RLS de insert), con un mensaje claro si no lo está;
--   · hace el upsert por dentro (el definer sí ve la columna);
--   · devuelve la fila propia (rating + review) para refrescar la UI.
-- El privilegio de columna se mantiene intacto: el gate anti-spoiler de
-- la 014 no cambia.
-- =====================================================================

create or replace function public.rate_book(
  p_book uuid,
  p_rating int,
  p_review text default null
)
returns table (rating int, review text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review text := nullif(btrim(coalesce(p_review, '')), '');
begin
  if auth.uid() is null then
    raise exception 'forbidden: hace falta sesión';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La valoración debe estar entre 1 y 5 estrellas.';
  end if;

  if length(v_review) > 4000 then
    raise exception 'La reseña es demasiado larga (máximo 4000 caracteres).';
  end if;

  if not exists (
    select 1 from reading_progress rp
     where rp.user_id = auth.uid()
       and rp.book_id = p_book
       and rp.status = 'finished'
  ) then
    raise exception 'Termina el libro para poder reseñarlo.';
  end if;

  insert into book_ratings as r (book_id, user_id, rating, review)
  values (p_book, auth.uid(), p_rating, v_review)
  on conflict (book_id, user_id) do update
    set rating = excluded.rating,
        review = excluded.review;

  return query
    select r.rating, r.review
      from book_ratings r
     where r.book_id = p_book and r.user_id = auth.uid();
end;
$$;

-- Mínimo privilegio: solo usuarios autenticados (el guard interno decide).
revoke all on function public.rate_book(uuid, int, text) from anon, public;
grant execute on function public.rate_book(uuid, int, text) to authenticated;

-- Refuerzo explícito del gate (por si alguien re-concede SELECT completo):
-- authenticated NO debe leer `review` directamente de la tabla.
revoke select (review) on public.book_ratings from anon, authenticated;
