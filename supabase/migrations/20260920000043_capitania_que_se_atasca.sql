-- =====================================================================
-- 043 · La capitanía que se atasca y las reseñas que se quedan selladas
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Segunda tanda de la cacería. Estos son peores que los de la 042: dos
-- de ellos no se pueden deshacer desde ninguna pantalla una vez pasan.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1 · Reseñas selladas PARA SIEMPRE por un relevo de capitán
-- ---------------------------------------------------------------
-- El peor de todos. Capitanía «por libro» con tope de días: cuando el
-- tope vence, `rotate_captain_if_due` cierra la lectura y quita el libro
-- del club. Pero marca `closed_at` y NO marca `premiered_at`.
--
-- La vista `book_reviews` sella el texto ajeno mientras haya una lectura
-- del club sin estrenar. Así que ese libro quedaba con las reseñas de
-- todo el mundo cerradas a cal y canto, y sin forma de abrirlas: el
-- botón «Abrir las reseñas ya» actúa sobre la lectura ABIERTA, y esa ya
-- estaba cerrada. Una trampa permanente, y silenciosa.
create or replace function public.rotate_captain_if_due()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_club uuid;
  v_next uuid;
begin
  select cm.club_id into v_club
    from club_members cm where cm.user_id = auth.uid() limit 1;
  if v_club is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_club::text, 0));

  select * into c from clubs where id = v_club;
  if c.captain_mode = 'manual' then return null; end if;
  if c.captain_term_ends_at is null or now() < c.captain_term_ends_at then
    return null;
  end if;

  v_next := public.next_captain_id(v_club);
  if v_next is null then return null; end if;

  -- Capitanía por libro vencida por el tope: se cierra la lectura Y SE
  -- ESTRENA. Cerrar un libro sin estrenarlo deja las reseñas de todo el
  -- club selladas para siempre.
  if c.captain_term = 'book' and c.current_book_id is not null then
    update club_readings
       set closed_at = now(),
           premiered_at = coalesce(premiered_at, now())
     where club_id = v_club and closed_at is null;
    update clubs set current_book_id = null where id = v_club;
  end if;

  perform public.assign_captain(v_club, v_next);
  return v_next;
end;
$$;

-- REPARACIÓN: cualquier lectura ya cerrada sin estrenar. Si el club
-- terminó con ese libro, sus reseñas tienen que poder leerse.
update public.club_readings
   set premiered_at = closed_at
 where closed_at is not null and premiered_at is null;

-- ---------------------------------------------------------------
-- 2 · La rotación de capitán estaba atascada
-- ---------------------------------------------------------------
-- El turno se calculaba con `joined_at > (el del capitán actual)`. Suena
-- bien hasta que miras cómo entró la gente: la migración 006 metió a
-- TODOS los perfiles en el club fundador con un solo `insert`, y `now()`
-- dentro de una transacción es el mismo instante para todas las filas.
-- O sea: en el club de verdad, todo el mundo tiene el mismo `joined_at`.
--
-- Con empates, «el siguiente» no existe nunca, se cae al primero por
-- orden, y el primero puede ser perfectamente el que ya era capitán. La
-- rotación se quedaba dando vueltas sobre la misma persona.
--
-- Se desempata por `user_id`, que es estable y único: el turno pasa a ser
-- una vuelta de verdad aunque todos entraran a la vez.
create or replace function public.next_captain_id(p_club uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_actual uuid;
  v_desde timestamptz;
  v_next uuid;
  v_total int;
begin
  select captain_mode into v_mode from clubs where id = p_club;
  select user_id, joined_at into v_actual, v_desde
    from club_members where club_id = p_club and role = 'captain' limit 1;
  select count(*) into v_total from club_members where club_id = p_club;
  if v_total < 2 then return null; end if;

  if v_mode = 'rotation' then
    -- Orden estable: fecha de entrada y, a igualdad, el identificador
    select user_id into v_next
      from club_members
     where club_id = p_club
       and (v_actual is null or (joined_at, user_id) > (v_desde, v_actual))
     order by joined_at asc, user_id asc
     limit 1;
    if v_next is null then
      -- Se ha dado la vuelta entera: vuelta a empezar
      select user_id into v_next
        from club_members where club_id = p_club
        order by joined_at asc, user_id asc limit 1;
    end if;
    -- Con un solo miembro por delante, el «siguiente» no puede ser el
    -- mismo que ya manda
    if v_next = v_actual then return null; end if;
    return v_next;
  end if;

  if v_mode = 'random' then
    select user_id into v_next
      from club_members
     where club_id = p_club
       and (v_actual is null or user_id <> v_actual)
     order by last_captain_at asc nulls first, random()
     limit 1;
    return v_next;
  end if;

  return null;  -- manual: no hay relevo automático
end;
$$;

-- ---------------------------------------------------------------
-- 3 · Un club no puede quedarse sin capitán
-- ---------------------------------------------------------------
-- Si el capitán borra su cuenta —o se le expulsa— su fila de
-- `club_members` cae por cascada y el club se queda sin nadie al mando.
-- `handle_club_member_role` solo nombra capitán al PRIMER miembro, así
-- que ni siquiera entrando gente nueva se arregla: el club queda
-- gobernado por nadie hasta que un super admin lo toque a mano.
create or replace function public.club_sin_capitan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo uuid;
begin
  if old.role <> 'captain' then
    return old;
  end if;
  if exists (
    select 1 from club_members
     where club_id = old.club_id and role = 'captain'
  ) then
    return old;
  end if;

  -- El que lleva más tiempo, que es el criterio menos arbitrario
  select user_id into v_nuevo
    from club_members
   where club_id = old.club_id
   order by joined_at asc, user_id asc
   limit 1;

  if v_nuevo is not null then
    update club_members
       set role = 'captain', captain_since = now(), last_captain_at = now()
     where club_id = old.club_id and user_id = v_nuevo;

    insert into notifications (user_id, type, club_id)
    select cm.user_id, 'captain', old.club_id
      from club_members cm where cm.club_id = old.club_id;
  end if;

  return old;
end;
$$;

drop trigger if exists club_sin_capitan on public.club_members;
create trigger club_sin_capitan
  after delete on public.club_members
  for each row execute function public.club_sin_capitan();

-- REPARACIÓN: clubes que ya se quedaron huérfanos
update public.club_members cm
   set role = 'captain', captain_since = coalesce(captain_since, now())
 where cm.user_id = (
   select user_id from club_members m2
    where m2.club_id = cm.club_id
    order by m2.joined_at asc, m2.user_id asc limit 1
 )
   and not exists (
     select 1 from club_members m3
      where m3.club_id = cm.club_id and m3.role = 'captain'
   );

-- ---------------------------------------------------------------
-- 4 · Borrar un libro que el club está leyendo
-- ---------------------------------------------------------------
-- `clubs.current_book_id` se declaró sin `on delete`, al contrario que
-- `next_book_id`. Borrar desde Administración un libro que es la lectura
-- del club fallaba con una violación de clave ajena, y el traductor de
-- errores lo enseñaba como «No tienes permiso para hacer esto» — que
-- manda a buscar el fallo justo donde no está.
do $$
declare v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.clubs'::regclass
     and contype = 'f'
     and pg_get_constraintdef(oid) like '%current_book_id%';
  if v_nombre is not null then
    execute format('alter table public.clubs drop constraint %I', v_nombre);
  end if;
end;
$$;

alter table public.clubs
  add constraint clubs_current_book_id_fkey
  foreign key (current_book_id) references public.books(id) on delete set null;

-- ---------------------------------------------------------------
-- 5 · El emblema de un club solo lo cambia SU capitán
-- ---------------------------------------------------------------
-- Las políticas del bucket comprobaban «¿eres capitán de algún club?»,
-- no «¿de este?». Con varios clubes, el capitán del club B podía
-- sobrescribir el escudo del club A. Mismo fallo que tenía
-- `set_book_chapters`, en otro sitio.
--
-- El fichero se llama `clubs/<id-del-club>-<uuid>.jpg`, así que la
-- comprobación es que el nombre empiece por el id de un club donde
-- mandes tú.
create or replace function public.puede_tocar_emblema(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from club_members cm
         where cm.user_id = auth.uid()
           and cm.role = 'captain'
           and split_part(p_name, '/', 2) like cm.club_id::text || '-%'
      );
$$;

grant execute on function public.puede_tocar_emblema(text) to authenticated;

drop policy if exists "avatars_insert_club" on storage.objects;
create policy "avatars_insert_club"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and public.puede_tocar_emblema(name)
  );

drop policy if exists "avatars_update_club" on storage.objects;
create policy "avatars_update_club"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and public.puede_tocar_emblema(name)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and public.puede_tocar_emblema(name)
  );

drop policy if exists "avatars_delete_club" on storage.objects;
create policy "avatars_delete_club"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and public.puede_tocar_emblema(name)
  );
