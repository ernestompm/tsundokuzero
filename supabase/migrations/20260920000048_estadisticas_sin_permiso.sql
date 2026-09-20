-- =====================================================================
-- 048 · «No tienes permiso» en tus propias insignias
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- LA MISMA RAÍZ QUE EL PRIMER FALLO DE TODO ESTO, mordiendo en otro
-- sitio. La migración 014 cerró la columna `book_ratings.review` a cal y
-- canto, que es lo correcto —el texto de una reseña no puede viajar a la
-- API antes del estreno—:
--
--     revoke select on book_ratings from anon, authenticated;
--     grant select (book_id, user_id, rating, created_at) on book_ratings…
--
-- Pero `club_member_stats` está declarada `security_invoker = true`, o
-- sea que se ejecuta con los permisos de QUIEN LA CONSULTA. Y dentro
-- cuenta reseñas así:
--
--     ... where br.review is not null and length(btrim(br.review)) > 0
--
-- Leer esa columna es justo lo que nadie puede hacer. Resultado:
-- «permission denied for column review», la vista entera falla, y en el
-- perfil desaparecen las insignias, las rachas y los ex libris de golpe.
-- Contar cuántas reseñas tienes texto no es leer ninguna, pero al motor
-- eso le da igual.
--
-- ARREGLO: la vista deja de ser invoker. Son datos agregados del club
-- —cuántos libros, cuántas ideas—, no contenido. A cambio, el filtro de
-- seguridad se escribe AQUÍ y a la vista, en vez de heredarlo: solo se
-- ven las filas de los clubes a los que perteneces.
-- =====================================================================

drop view if exists public.club_member_stats;

create view public.club_member_stats as
select
  cm.club_id,
  cm.user_id,
  cm.joined_at,
  cm.role,
  cm.last_captain_at,

  (select count(*) + 1 from club_members m2
    where m2.club_id = cm.club_id and m2.joined_at < cm.joined_at)::int
    as orden_llegada,

  (select count(*) from club_readings cr
     join reading_progress rp
       on rp.book_id = cr.book_id and rp.user_id = cm.user_id
    where cr.club_id = cm.club_id and rp.status = 'finished')::int
    as libros_terminados,

  (select count(*) from club_readings cr
    where cr.club_id = cm.club_id
      and cm.user_id = (
        select rp.user_id
          from reading_progress rp
          join club_members m3
            on m3.user_id = rp.user_id and m3.club_id = cm.club_id
         where rp.book_id = cr.book_id and rp.status = 'finished'
         order by rp.updated_at asc
         limit 1
      ))::int
    as veces_primero,

  (select count(*) from club_readings cr
    where cr.club_id = cm.club_id and cr.proposed_by = cm.user_id)::int
    as libros_propuestos,

  (select count(*) from discussions d where d.author_id = cm.user_id)::int
    as ideas,

  (select count(*) from book_ratings br
    where br.user_id = cm.user_id
      and br.review is not null and length(btrim(br.review)) > 0)::int
    as resenas,

  (select count(*) from discussion_comments dc where dc.author_id = cm.user_id)::int
    as respuestas,

  (select count(*) from reactions r where r.user_id = cm.user_id)::int
    as reacciones,

  (select count(*) from poll_votes v
     join polls p2 on p2.id = v.poll_id
    where v.user_id = cm.user_id and p2.club_id = cm.club_id)::int
    as votaciones,

  (select count(*) from reading_progress rp where rp.user_id = cm.user_id)::int
    as libros_en_estanteria,

  (p.avatar_url is not null and p.bio is not null and length(btrim(p.bio)) > 0)
    as perfil_completo,

  p.created_at as en_la_app_desde,

  (select coalesce(sum(rp.current_chapter), 0)
     from reading_progress rp where rp.user_id = cm.user_id)::int
    as capitulos_leidos

from club_members cm
join profiles p on p.id = cm.user_id
-- El filtro que antes ponía RLS, ahora explícito: solo la gente de los
-- clubes a los que perteneces. Con `security_invoker` desactivado esto
-- deja de ser opcional, así que va escrito y a la vista.
where exists (
  select 1 from club_members yo
   where yo.club_id = cm.club_id and yo.user_id = auth.uid()
);

alter view public.club_member_stats set (security_invoker = false);
revoke all on public.club_member_stats from anon, authenticated;
grant select on public.club_member_stats to authenticated;
