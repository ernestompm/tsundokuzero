-- =====================================================================
-- 028 · El final del libro: valoración por dimensiones, cierre de lectura
--       e historial del club con «el bis»
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- PROBLEMA (pedido por Ernesto)
-- -----------------------------
-- La app acompaña muy bien mientras leéis y os abandona al terminar. No
-- hay cierre, no hay sitio donde reposen las opiniones, no hay memoria de
-- lo que ha leído el club, y una estrella sola no explica por qué gustó.
-- Encima, un libro terminado hace meses sigue saliendo como conversación
-- activa porque nada lo cierra nunca.
--
-- QUÉ TRAE
-- --------
--  1. Valoración en 4 dimensiones además de la estrella general.
--  2. Historial de lecturas del club, con «el bis» como lectura extra
--     cuando el club se ventila el libro antes de tiempo.
--  3. Hoja de capitanía: qué propuso cada capitán y cómo le fue.
-- =====================================================================

-- ---------- 1 · Valoración por dimensiones ----------
-- No son spoiler: se leen igual que la estrella. El TEXTO de la reseña
-- sigue sellado por la vista book_reviews (migr. 014), que no se toca.
alter table public.book_ratings
  add column if not exists d_think     int check (d_think     between 1 and 5),
  add column if not exists d_flow      int check (d_flow      between 1 and 5),
  add column if not exists d_feel      int check (d_feel      between 1 and 5),
  add column if not exists d_recommend int check (d_recommend between 1 and 5);

comment on column public.book_ratings.d_think     is 'Cuánto te hizo pensar (1-5)';
comment on column public.book_ratings.d_flow      is 'Cuánto se lee solo (1-5)';
comment on column public.book_ratings.d_feel      is 'Cuánto te removió (1-5)';
comment on column public.book_ratings.d_recommend is 'Ganas de recomendarlo (1-5)';

-- La vista enmascarada aprende las dimensiones. Se recrea entera porque
-- cambia su lista de columnas.
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

-- `rate_book` gana las cuatro dimensiones. Se borra la versión de 3
-- argumentos para no dejar dos sobrecargas ambiguas; la nueva lleva
-- valores por defecto, así que el cliente ya desplegado, que solo manda
-- libro, estrellas y texto, sigue funcionando sin cambios.
drop function if exists public.rate_book(uuid, int, text);

create or replace function public.rate_book(
  p_book uuid,
  p_rating int,
  p_review text default null,
  p_think int default null,
  p_flow int default null,
  p_feel int default null,
  p_recommend int default null
)
returns table (
  rating int, review text,
  d_think int, d_flow int, d_feel int, d_recommend int
)
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
     where rp.user_id = auth.uid() and rp.book_id = p_book and rp.status = 'finished'
  ) then
    raise exception 'Termina el libro para poder reseñarlo.';
  end if;

  insert into book_ratings as r
    (book_id, user_id, rating, review, d_think, d_flow, d_feel, d_recommend)
  values
    (p_book, auth.uid(), p_rating, v_review, p_think, p_flow, p_feel, p_recommend)
  on conflict (book_id, user_id) do update
    set rating      = excluded.rating,
        review      = excluded.review,
        d_think     = excluded.d_think,
        d_flow      = excluded.d_flow,
        d_feel      = excluded.d_feel,
        d_recommend = excluded.d_recommend;

  return query
    select r.rating, r.review, r.d_think, r.d_flow, r.d_feel, r.d_recommend
      from book_ratings r
     where r.book_id = p_book and r.user_id = auth.uid();
end;
$$;

revoke all on function public.rate_book(uuid, int, text, int, int, int, int)
  from anon, public;
grant execute on function public.rate_book(uuid, int, text, int, int, int, int)
  to authenticated;

-- El texto de la reseña sigue sin poder leerse directamente de la tabla
revoke select (review) on public.book_ratings from anon, authenticated;

-- ---------- 2 · Historial de lecturas del club ----------
create table if not exists public.club_readings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  -- 'main' = lectura del mes; 'bis' = la extra que se pide cuando el club
  -- se termina la principal antes de tiempo
  kind text not null default 'main' check (kind in ('main', 'bis')),
  proposed_by uuid references profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists club_readings_club_idx
  on public.club_readings (club_id, started_at desc);
create unique index if not exists club_readings_open_unique
  on public.club_readings (club_id) where closed_at is null;

alter table public.club_readings enable row level security;

drop policy if exists "club_readings_select_member" on public.club_readings;
create policy "club_readings_select_member" on public.club_readings
  for select to authenticated using (
    exists (
      select 1 from club_members cm
       where cm.club_id = club_readings.club_id and cm.user_id = auth.uid()
    )
  );
-- La escritura va solo por las RPC de abajo (security definer)
revoke insert, update, delete on public.club_readings from anon, authenticated;
grant select on public.club_readings to authenticated;

-- Abrir lectura automáticamente cuando cambia el libro del club. Cubre
-- los dos caminos: el capitán lo cambia a mano y el cierre de una
-- votación lo aplica solo (migr. 015).
create or replace function public.track_club_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_book_id is distinct from old.current_book_id then
    update club_readings
       set closed_at = now()
     where club_id = new.id and closed_at is null;

    if new.current_book_id is not null then
      insert into club_readings (club_id, book_id, kind, proposed_by)
      values (
        new.id,
        new.current_book_id,
        'main',
        (select cm.user_id from club_members cm
          where cm.club_id = new.id and cm.role = 'captain' limit 1)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_track_reading on public.clubs;
create trigger clubs_track_reading
  after update on public.clubs
  for each row execute function public.track_club_reading();

-- Sembrado: si el club ya tiene libro y no hay historial, se abre su fila
insert into club_readings (club_id, book_id, kind, proposed_by)
select c.id, c.current_book_id, 'main',
       (select cm.user_id from club_members cm
         where cm.club_id = c.id and cm.role = 'captain' limit 1)
  from clubs c
 where c.current_book_id is not null
   and not exists (select 1 from club_readings r where r.club_id = c.id);

-- ---------- 3 · Cerrar la lectura y pedir «el bis» ----------
-- Cierra el libro del club sin poner otro: la conversación deja de estar
-- viva y el libro pasa al historial.
create or replace function public.close_club_reading()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain'
   limit 1;

  if v_club is null and public.is_super_admin() then
    select c.id into v_club from clubs c order by c.created_at limit 1;
  end if;

  if v_club is null then
    raise exception 'forbidden: solo el capitán puede cerrar la lectura';
  end if;

  -- El trigger de clubs cierra la fila abierta al quedarse sin libro
  update clubs set current_book_id = null where id = v_club;
end;
$$;

revoke all on function public.close_club_reading() from anon, public;
grant execute on function public.close_club_reading() to authenticated;

-- «El bis»: la lectura extra que se pide cuando el club va sobrado.
create or replace function public.start_club_bis(p_book uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_reading uuid;
begin
  select cm.club_id into v_club
    from club_members cm
   where cm.user_id = auth.uid() and cm.role = 'captain'
   limit 1;

  if v_club is null and public.is_super_admin() then
    select c.id into v_club from clubs c order by c.created_at limit 1;
  end if;

  if v_club is null then
    raise exception 'forbidden: solo el capitán puede proponer el bis';
  end if;

  if not exists (select 1 from books b where b.id = p_book) then
    raise exception 'Ese libro no está en el catálogo.';
  end if;

  -- Si ya es el libro del club, el trigger no abriría lectura nueva y
  -- acabaríamos reetiquetando la actual como bis por error.
  if exists (select 1 from clubs c where c.id = v_club and c.current_book_id = p_book) then
    raise exception 'Ese ya es el libro del club. Elige otro para el bis.';
  end if;

  -- El trigger cierra la lectura anterior y abre la nueva como 'main'
  update clubs set current_book_id = p_book where id = v_club;

  update club_readings
     set kind = 'bis', proposed_by = auth.uid()
   where club_id = v_club and closed_at is null
   returning id into v_reading;

  return v_reading;
end;
$$;

revoke all on function public.start_club_bis(uuid) from anon, public;
grant execute on function public.start_club_bis(uuid) to authenticated;

-- ---------- 4 · Hoja de capitanía ----------
-- Qué propuso cada capitán y cómo le fue. Se cuenta también cuánta gente
-- terminó el libro: premiar solo por estrellas empuja a elegir lecturas
-- fáciles de gustar, y terminar mide mejor el acierto.
create or replace view public.club_captain_record as
with por_libro as (
  select
    cr.club_id,
    cr.proposed_by,
    cr.book_id,
    cr.kind,
    (select avg(br.rating) from book_ratings br where br.book_id = cr.book_id) as media,
    (select count(*) from reading_progress rp
      where rp.book_id = cr.book_id and rp.status = 'finished') as terminaron
  from club_readings cr
  where cr.proposed_by is not null
)
select
  club_id,
  proposed_by as user_id,
  count(*)::int                                as libros,
  count(*) filter (where kind = 'bis')::int    as bises,
  round(avg(media)::numeric, 2)                as media_estrellas,
  sum(terminaron)::int                         as lecturas_terminadas
from por_libro
group by club_id, proposed_by;

alter view public.club_captain_record set (security_invoker = true);
grant select on public.club_captain_record to authenticated;
