-- =====================================================================
-- 045 · Rachas: volver mañana
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- La app premiaba los totales —libros terminados, ideas escritas— y los
-- totales no hacen volver a nadie mañana. Lo que engancha en Strava no es
-- el kilometraje: es no querer romper una racha de doce días.
--
-- Aquí se cuentan dos cosas, y solo dos:
--
--   · DÍAS LEYENDO      — días en los que moviste tu capítulo
--   · DÍAS HABLANDO     — días en los que escribiste algo al club
--
-- Las dos son de hacer, no de abrir la app. Entrar a mirar no cuenta, y
-- eso es deliberado: una racha que se mantiene mirando el móvil no
-- premia leer, premia mirar el móvil.
--
-- EL DÍA ES EL DE MADRID, no el UTC. Con UTC, quien marca su capítulo a
-- la una de la madrugada estaría sumando al día anterior y vería la
-- racha rota sin haber fallado. El club es español; si algún día deja de
-- serlo, esto es lo que hay que tocar.
-- =====================================================================

create or replace function public.dia_local()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

-- ---------- El diario ----------
-- Una fila por persona y día. `reading_progress` solo guarda dónde vas
-- AHORA, así que sin esto no hay forma de saber qué días leíste.
create table if not exists public.lector_dias (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null,
  /** capítulos avanzados ese día */
  capitulos int not null default 0,
  /** pensamientos y respuestas escritos ese día */
  comentarios int not null default 0,
  primary key (user_id, dia)
);

create index if not exists lector_dias_idx on public.lector_dias (user_id, dia desc);

alter table public.lector_dias enable row level security;

-- Se lee lo propio y lo del club (la racha de los demás se enseña en su
-- perfil: una racha que nadie ve no aprieta a nadie).
drop policy if exists "lector_dias_select" on public.lector_dias;
create policy "lector_dias_select" on public.lector_dias
  for select to authenticated using (true);

-- Solo escriben los disparadores
revoke insert, update, delete on public.lector_dias from anon, authenticated;
grant select on public.lector_dias to authenticated;

-- ---------- Apuntar el día al avanzar ----------
create or replace function public.apuntar_dia_lectura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes int := case when tg_op = 'INSERT' then 0
                      else coalesce(old.current_chapter, 0) end;
  v_avance int;
begin
  v_avance := coalesce(new.current_chapter, 0) - v_antes;
  if v_avance > 0 then
    begin
      insert into lector_dias (user_id, dia, capitulos)
      values (new.user_id, public.dia_local(), v_avance)
      on conflict (user_id, dia) do update
        set capitulos = lector_dias.capitulos + excluded.capitulos;
    exception when others then null;  -- llevar el diario no tumba nada
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists apuntar_dia_lectura on public.reading_progress;
create trigger apuntar_dia_lectura
  after insert or update on public.reading_progress
  for each row execute function public.apuntar_dia_lectura();

-- ---------- Apuntar el día al escribir ----------
create or replace function public.apuntar_dia_palabra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into lector_dias (user_id, dia, comentarios)
    values (new.author_id, public.dia_local(), 1)
    on conflict (user_id, dia) do update
      set comentarios = lector_dias.comentarios + 1;
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists apuntar_dia_idea on public.discussions;
create trigger apuntar_dia_idea
  after insert on public.discussions
  for each row execute function public.apuntar_dia_palabra();

drop trigger if exists apuntar_dia_respuesta on public.discussion_comments;
create trigger apuntar_dia_respuesta
  after insert on public.discussion_comments
  for each row execute function public.apuntar_dia_palabra();

-- ---------- Sembrar lo que ya se sabe ----------
-- De los pensamientos y respuestas sí hay historia: llevan su fecha. De
-- la lectura no —solo se guarda dónde vas ahora—, así que las rachas de
-- lectura empiezan hoy para todo el mundo. Es lo honesto: inventar días
-- leídos que nadie puede comprobar sería regalar una racha.
insert into public.lector_dias (user_id, dia, comentarios)
select d.author_id,
       (d.created_at at time zone 'Europe/Madrid')::date,
       count(*)
  from public.discussions d
 group by 1, 2
on conflict (user_id, dia) do update
  set comentarios = lector_dias.comentarios + excluded.comentarios;

insert into public.lector_dias (user_id, dia, comentarios)
select c.author_id,
       (c.created_at at time zone 'Europe/Madrid')::date,
       count(*)
  from public.discussion_comments c
 group by 1, 2
on conflict (user_id, dia) do update
  set comentarios = lector_dias.comentarios + excluded.comentarios;

-- ---------- Las rachas ----------
-- Una racha se corta si te saltas un día. Cuenta si el último día con
-- actividad es HOY o AYER: si fuera solo hoy, a las 00:01 todo el mundo
-- tendría la racha a cero y sería desmoralizante en vez de motivador.
create or replace function public.racha_de(p_user uuid, p_tipo text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with dias as (
    select dia from lector_dias
     where user_id = p_user
       and case when p_tipo = 'lectura' then capitulos else comentarios end > 0
  ),
  grupos as (
    select dia,
           dia - (row_number() over (order by dia))::int as grupo
      from dias
  ),
  ultimo as (
    select grupo, max(dia) as fin, count(*)::int as largo
      from grupos group by grupo
     order by fin desc limit 1
  )
  select coalesce((
    select largo from ultimo
     where fin >= public.dia_local() - 1
  ), 0);
$$;

create or replace function public.mis_rachas()
returns table (
  dias_leyendo int,
  dias_hablando int,
  leido_hoy boolean,
  hablado_hoy boolean,
  mejor_leyendo int,
  dias_totales int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.racha_de(auth.uid(), 'lectura'),
    public.racha_de(auth.uid(), 'palabra'),
    coalesce((select capitulos > 0 from lector_dias
               where user_id = auth.uid() and dia = public.dia_local()), false),
    coalesce((select comentarios > 0 from lector_dias
               where user_id = auth.uid() and dia = public.dia_local()), false),
    -- La mejor racha de lectura de tu historia, para tener contra qué ir
    coalesce((
      with dias as (
        select dia from lector_dias where user_id = auth.uid() and capitulos > 0
      ),
      grupos as (
        select dia, dia - (row_number() over (order by dia))::int as grupo from dias
      )
      select max(c)::int from (select count(*) as c from grupos group by grupo) t
    ), 0),
    coalesce((select count(*)::int from lector_dias
               where user_id = auth.uid() and (capitulos > 0 or comentarios > 0)), 0);
$$;

revoke all on function public.mis_rachas() from anon, public;
grant execute on function public.mis_rachas() to authenticated;
revoke all on function public.racha_de(uuid, text) from anon, public;
grant execute on function public.racha_de(uuid, text) to authenticated;

-- ---------- Los ex libris, que son coleccionables ----------
-- Qué libros has terminado, cuándo, y con quién. La ficha del libro
-- enseñaba una estampa suelta que no era de nadie; esto es una
-- colección, que es lo que hace que quieras la siguiente.
create or replace function public.mis_exlibris()
returns table (
  book_id uuid,
  title text,
  author text,
  cover_url text,
  terminado_el timestamptz,
  companeros text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.author,
    b.cover_url,
    rp.updated_at,
    coalesce((
      select array_agg(p.display_name order by rp2.updated_at)
        from reading_progress rp2
        join profiles p on p.id = rp2.user_id
        join club_members m on m.user_id = rp2.user_id
        join club_members yo on yo.club_id = m.club_id and yo.user_id = auth.uid()
       where rp2.book_id = b.id
         and rp2.status = 'finished'
         and rp2.user_id <> auth.uid()
    ), array[]::text[])
  from reading_progress rp
  join books b on b.id = rp.book_id
 where rp.user_id = auth.uid() and rp.status = 'finished'
 order by rp.updated_at desc;
$$;

revoke all on function public.mis_exlibris() from anon, public;
grant execute on function public.mis_exlibris() to authenticated;
