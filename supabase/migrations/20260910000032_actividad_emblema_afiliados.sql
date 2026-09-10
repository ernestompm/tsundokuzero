-- =====================================================================
-- 032 · Actividad del club, emblema, afiliados y más datos para insignias
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- De lo que pidió Ernesto:
--   · avisos de actividad en «Tu club»: cuántos mensajes nuevos hay y
--     quién te ha adelantado desde la última vez que miraste
--   · un emblema para el club, que se vea que perteneces a algo
--   · el enlace de compra con etiqueta de afiliado, para que el club
--     pueda sostenerse algún día
--   · insignias también por usar la app, no solo por leer
-- =====================================================================

-- ---------- 1 · Cuándo miraste el club por última vez ----------
alter table public.profiles
  add column if not exists club_seen_at timestamptz;

-- Quien nunca lo haya mirado arranca desde que entró, no desde el
-- principio de los tiempos: si no, el primer aviso sería absurdo.
update public.profiles set club_seen_at = created_at where club_seen_at is null;

create or replace function public.mark_club_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set club_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.mark_club_seen() from anon, public;
grant execute on function public.mark_club_seen() to authenticated;

-- ---------- 2 · Qué ha pasado desde entonces ----------
-- Todo respeta el candado: solo cuenta lo que está en capítulos que ya
-- has leído. Un contador que incluyera mensajes de más adelante ya sería
-- un spoiler («algo gordo pasa en el 31»).
create or replace function public.club_activity()
returns table (
  ideas_nuevas int,
  respuestas_nuevas int,
  reacciones_nuevas int,
  adelantos jsonb,
  desde timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_desde timestamptz;
  v_club uuid;
  v_libro uuid;
  v_mi_cap int := 0;
begin
  if v_uid is null then
    return;
  end if;

  select coalesce(p.club_seen_at, p.created_at) into v_desde
    from profiles p where p.id = v_uid;

  select cm.club_id into v_club
    from club_members cm where cm.user_id = v_uid limit 1;
  if v_club is null then
    return;
  end if;

  select c.current_book_id into v_libro from clubs c where c.id = v_club;

  select coalesce(rp.current_chapter, 0) into v_mi_cap
    from reading_progress rp
   where rp.user_id = v_uid and rp.book_id = v_libro;
  v_mi_cap := coalesce(v_mi_cap, 0);

  return query
  select
    -- Ideas nuevas de otros, solo hasta donde has leído
    (select count(*)::int from discussions d
      where d.book_id = v_libro
        and d.author_id <> v_uid
        and d.chapter_number <= v_mi_cap
        and d.created_at > v_desde)                            as ideas_nuevas,

    -- Respuestas a lo que tú escribiste
    (select count(*)::int from discussion_comments dc
       join discussions d on d.id = dc.discussion_id
      where d.author_id = v_uid
        and dc.author_id <> v_uid
        and dc.created_at > v_desde)                           as respuestas_nuevas,

    -- Reacciones a tus ideas
    (select count(*)::int from reactions r
       join discussions d on d.id = r.discussion_id
      where d.author_id = v_uid
        and r.user_id <> v_uid
        and r.created_at > v_desde)                            as reacciones_nuevas,

    -- Quién va por delante de ti y se ha movido desde la última vez
    coalesce((
      select jsonb_agg(jsonb_build_object('name', pr.display_name, 'chapter', rp.current_chapter)
                       order by rp.current_chapter desc)
        from reading_progress rp
        join club_members cm on cm.user_id = rp.user_id and cm.club_id = v_club
        join profiles pr on pr.id = rp.user_id
       where rp.book_id = v_libro
         and rp.user_id <> v_uid
         and rp.current_chapter > v_mi_cap
         and rp.updated_at > v_desde
    ), '[]'::jsonb)                                            as adelantos,

    v_desde                                                    as desde;
end;
$$;

revoke all on function public.club_activity() from anon, public;
grant execute on function public.club_activity() to authenticated;

-- ---------- 3 · El emblema del club ----------
alter table public.clubs
  add column if not exists emblem text,
  add column if not exists emblem_color text;

comment on column public.clubs.emblem is
  'Emoji que hace de escudo del club. Corto a propósito: un emblema, no una frase.';

-- ---------- 4 · Afiliados ----------
-- La etiqueta se guarda en el club y el cliente la añade a los enlaces de
-- Amazon. Así el club puede sostenerse sin cobrar a nadie.
alter table public.clubs
  add column if not exists affiliate_tag text;

comment on column public.clubs.affiliate_tag is
  'Etiqueta de afiliado de Amazon, p. ej. «miclub-21». Se añade como ?tag= a los enlaces de compra.';

-- ---------- 5 · Más datos para las insignias ----------
-- Ernesto acepta insignias por uso de la app, no solo por leer. Se añaden
-- los datos que hacían falta, siempre derivados.
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

  -- ---- Datos de uso de la app ----
  (select count(*) from discussion_comments dc where dc.author_id = cm.user_id)::int
    as respuestas,

  (select count(*) from reactions r where r.user_id = cm.user_id)::int
    as reacciones,

  (select count(*) from poll_votes v
     join polls p on p.id = v.poll_id
    where v.user_id = cm.user_id and p.club_id = cm.club_id)::int
    as votaciones,

  (select count(*) from reading_progress rp where rp.user_id = cm.user_id)::int
    as libros_en_estanteria,

  (p.avatar_url is not null and p.bio is not null and length(btrim(p.bio)) > 0)
    as perfil_completo,

  p.created_at as en_la_app_desde

from club_members cm
join profiles p on p.id = cm.user_id;

alter view public.club_member_stats set (security_invoker = true);
grant select on public.club_member_stats to authenticated;
