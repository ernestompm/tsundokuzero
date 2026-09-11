-- =====================================================================
-- 040 · Las insignias, con su momento
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Las insignias se calculaban bien pero se ganaban en silencio: aparecían
-- en tu perfil sin que nadie te dijera nada, así que nadie descubría que
-- tenía una nueva. Una insignia sin el momento de ganarla es decoración.
--
-- Aquí van las dos piezas que faltaban:
--
--   1. CAPÍTULOS LEÍDOS. Hacía falta para poder premiar el camino y no
--      solo la meta: terminar un libro es raro, leer quince capítulos
--      pasa la primera semana.
--
--   2. MEMORIA DE LO YA CELEBRADO. Sin esto, el aviso saltaría en cada
--      carga para las mismas insignias de siempre. Se guarda en el perfil
--      la lista de las que ya se han enseñado.
-- =====================================================================

-- ---------- 1 · Lo que ya se ha celebrado ----------
alter table public.profiles
  add column if not exists badges_seen jsonb not null default '[]'::jsonb;

comment on column public.profiles.badges_seen is
  'Ids de insignias que ya se le han enseñado, para no repetir el aviso.';

-- Se marca por RPC y no por UPDATE directo para que solo se pueda AÑADIR:
-- si el cliente pudiera escribir la columna entera, un fallo de carga
-- borraría el historial y volverían a saltar todas de golpe.
create or replace function public.marcar_insignias(p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_actual jsonb;
begin
  if uid is null then raise exception 'forbidden'; end if;

  select coalesce(badges_seen, '[]'::jsonb) into v_actual
    from profiles where id = uid;

  select coalesce(jsonb_agg(distinct valor), '[]'::jsonb) into v_actual
    from (
      select jsonb_array_elements_text(v_actual) as valor
      union
      select unnest(coalesce(p_ids, array[]::text[]))
    ) t;

  update profiles set badges_seen = v_actual where id = uid;
  return v_actual;
end;
$$;

revoke all on function public.marcar_insignias(text[]) from anon, public;
grant execute on function public.marcar_insignias(text[]) to authenticated;

-- ---------- 2 · Capítulos leídos, para premiar el camino ----------
-- OJO: la vista gana una columna al final. `create or replace view` admite
-- añadir columnas por el final, pero no reordenarlas ni quitarlas.
create or replace view public.club_member_stats as
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

  -- Capítulos leídos en total: la suma de por dónde va en cada libro. Es
  -- el número que crece desde el primer día, y por eso permite premiar
  -- el camino y no solo la meta.
  (select coalesce(sum(rp.current_chapter), 0)
     from reading_progress rp where rp.user_id = cm.user_id)::int
    as capitulos_leidos

from club_members cm
join profiles p on p.id = cm.user_id;

alter view public.club_member_stats set (security_invoker = true);
grant select on public.club_member_stats to authenticated;
