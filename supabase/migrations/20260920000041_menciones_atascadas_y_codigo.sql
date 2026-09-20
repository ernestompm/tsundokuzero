-- =====================================================================
-- 041 · Menciones atascadas y códigos que no entran
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- Dos fallos de producción, los dos por el mismo vicio: fiarlo todo a que
-- un disparador salte en el momento justo, o a que la persona escriba
-- exactamente lo que esperamos.
--
--   1. MENCIONES QUE NO SE ENTREGAN. «Alba te ha mencionado en el capítulo
--      10. Te faltan 10 capítulos» — estando en el 24. El disparador que
--      entrega las menciones estaba declarado `after update` sobre
--      reading_progress, y la primera vez que alguien marca su progreso
--      NO es un update: es un insert. Quien recibió la mención antes de
--      tener fila de progreso se quedaba con ella clavada para siempre.
--
--   2. EL CÓDIGO DEL CLUB. El botón de invitar copia un MENSAJE entero
--      («Únete a X… Código de invitación: kfmrqp») y quien lo recibe pega
--      lo que le han pasado. Comparábamos la cadena completa contra el
--      código, así que no entraba nadie. El error no es de quien pega: es
--      de quien le da a copiar un párrafo y luego exige seis letras.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1 · La entrega de menciones deja de depender del disparador
-- ---------------------------------------------------------------

-- Que salte también al crear la fila, no solo al actualizarla
drop trigger if exists reading_progress_menciones on public.reading_progress;
create trigger reading_progress_menciones
  after insert or update on public.reading_progress
  for each row execute function public.entregar_menciones();

-- El disparador de la 035 leía `old.current_chapter`, que en un INSERT no
-- existe: con `tg_op` se cubren los dos casos.
create or replace function public.entregar_menciones()
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
    insert into notifications (user_id, actor_id, type, discussion_id, book_id, chapter_number)
    select m.to_user, m.from_user, 'mention', m.discussion_id, m.book_id, m.chapter_number
      from mentions m
     where m.to_user = new.user_id
       and m.book_id = new.book_id
       and m.delivered_at is null
       and m.chapter_number <= new.current_chapter;

    update mentions
       set delivered_at = now()
     where to_user = new.user_id
       and book_id = new.book_id
       and delivered_at is null
       and chapter_number <= new.current_chapter;
  end if;
  return new;
end;
$$;

-- REPARACIÓN. Todo lo que se quedó atascado: si ya has pasado por ese
-- capítulo, la mención está entregada, se avise ahora o no. No se generan
-- avisos retroactivos —serían de hace semanas y no ayudan a nadie—; lo
-- que se arregla es que dejen de aparecer como «te faltan N capítulos»
-- cuando hace tiempo que no falta ninguno.
update public.mentions m
   set delivered_at = now()
  from public.reading_progress rp
 where rp.user_id = m.to_user
   and rp.book_id = m.book_id
   and m.delivered_at is null
   and m.chapter_number <= rp.current_chapter;

-- Y la lista se cura sola: aunque algún día vuelva a fallar un
-- disparador, `pending_mentions` no devuelve nada que ya puedas leer.
-- Una lista que se contradice con lo que el usuario está viendo en la
-- misma pantalla es peor que no tener lista.
drop function if exists public.pending_mentions();

create function public.pending_mentions()
returns table (
  book_id uuid,
  book_title text,
  chapter_number int,
  my_chapter int,
  total_chapters int,
  cuantas int,
  quien text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.book_id,
    b.title,
    min(m.chapter_number)::int,
    -- Subconsulta escalar en vez de left join + max: el progreso es UNA
    -- fila por persona y libro, y así no depende de la agrupación.
    coalesce((
      select rp.current_chapter from reading_progress rp
       where rp.user_id = auth.uid() and rp.book_id = m.book_id
    ), 0)::int,
    b.total_chapters,
    count(*)::int,
    (select p.display_name
       from mentions m2
       join profiles p on p.id = m2.from_user
      where m2.to_user = auth.uid()
        and m2.book_id = m.book_id
        and m2.delivered_at is null
      order by m2.chapter_number asc
      limit 1)
  from mentions m
  join books b on b.id = m.book_id
  where m.to_user = auth.uid()
    and m.delivered_at is null
    -- Lo que ya puedes leer no está «esperando»
    and m.chapter_number > coalesce((
      select rp.current_chapter from reading_progress rp
       where rp.user_id = auth.uid() and rp.book_id = m.book_id
    ), 0)
  group by m.book_id, b.title, b.total_chapters;
$$;

revoke all on function public.pending_mentions() from anon, public;
grant execute on function public.pending_mentions() to authenticated;

-- ---------------------------------------------------------------
-- 2 · El código de invitación, tolerante con lo que pega la gente
-- ---------------------------------------------------------------
-- Se busca el código DENTRO de lo que han escrito, como palabra suelta.
-- Así entra igual quien teclea «kfmrqp» que quien pega el mensaje entero
-- que le han reenviado por WhatsApp.
create or replace function public.codigo_en_texto(p_texto text, p_codigo text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_codigo, '') <> ''
     and lower(coalesce(p_texto, '')) ~
         ('(^|[^a-z0-9])' || lower(p_codigo) || '($|[^a-z0-9])');
$$;

create or replace function public.complete_onboarding(
  invite text,
  new_username text,
  new_display_name text,
  accepted_terms_version int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
  v_texto text := coalesce(invite, '');
  v_club uuid;
begin
  if uid is null then
    raise exception 'forbidden';
  end if;

  -- Consentimiento obligatorio, también en servidor (RGPD art. 7)
  if accepted_terms_version is null or accepted_terms_version < 1 then
    raise exception 'terms_not_accepted';
  end if;

  -- ¿Está el código de algún club en lo que han escrito? Entonces vale
  -- como invitación Y te mete en ese club.
  select c.id into v_club
    from clubs c
   where public.codigo_en_texto(v_texto, c.invite_code)
   limit 1;

  if v_club is null then
    select value into stored from private_settings where key = 'invite_code';
    if stored is null or btrim(stored) = '' then
      -- Cerrado por defecto: sin código configurado no entra nadie nuevo
      raise exception 'invite_not_configured';
    end if;
    if not public.codigo_en_texto(v_texto, btrim(stored)) then
      raise exception 'invalid_invite';
    end if;
  end if;

  insert into profiles (id, username, display_name)
  values (uid, new_username, new_display_name);

  insert into consents (user_id, doc, doc_version)
  values (uid, 'terms', accepted_terms_version)
  on conflict do nothing;

  if v_club is not null then
    insert into club_members (club_id, user_id)
    values (v_club, uid)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, int) from anon;
grant execute on function public.complete_onboarding(text, text, text, int) to authenticated;

-- Por si algún club se quedó sin código: sin él no puede entrar nadie
update public.clubs
   set invite_code = public.codigo_de_club()
 where coalesce(invite_code, '') = '';

-- ---------------------------------------------------------------
-- 3 · Entrar en un club, con la misma tolerancia
-- ---------------------------------------------------------------
create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'forbidden'; end if;

  select c.id into v_id
    from clubs c
   where public.codigo_en_texto(p_code, c.invite_code)
   limit 1;
  if v_id is null then
    raise exception 'Ese código no es de ningún club.';
  end if;

  if exists (select 1 from club_members m where m.club_id = v_id and m.user_id = uid) then
    return v_id;
  end if;
  if exists (select 1 from club_members m where m.user_id = uid) then
    raise exception 'Ya estás en un club. Sal de él antes de entrar en otro.';
  end if;

  insert into club_members (club_id, user_id) values (v_id, uid);
  return v_id;
end;
$$;

revoke all on function public.join_club(text) from anon, public;
grant execute on function public.join_club(text) to authenticated;
