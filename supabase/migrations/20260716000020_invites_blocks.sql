-- =====================================================================
-- 020 · Invitación en servidor + bloqueos + transparencia
-- EJECUTAR ENTERO en el SQL Editor. Idempotente (re-ejecutable).
--
--  1. private_settings — ajustes SECRETOS (código de invitación). Sin
--     políticas RLS: solo las funciones security definer los leen.
--  2. complete_onboarding() — crea el perfil validando el código de
--     invitación EN SERVIDOR (P1-7; antes solo se comprobaba en cliente)
--     y registra el consentimiento de términos en la misma transacción.
--     Se elimina la política de INSERT directo en profiles.
--  3. blocks — bloqueos entre usuarios (P2-13) con RPCs block_user /
--     unblock_user (romper follows en ambos sentidos requiere definer).
--  4. moderation_stats() — datos agregados para la página pública de
--     transparencia (P2-15). Solo recuentos, jamás datos personales.
--
-- ⚠️ TRAS EJECUTAR: fija el código de invitación en Administración →
--    Usuarios (o: select admin_set_invite_code('tu-código')). Hasta
--    entonces NADIE nuevo puede completar el onboarding.
-- =====================================================================

-- ---------- 1 · Ajustes privados ----------
create table if not exists private_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table private_settings enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leer/escribir directo.
revoke all on table private_settings from anon, authenticated;

create or replace function public.admin_set_invite_code(code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  insert into private_settings (key, value, updated_at)
  values ('invite_code', coalesce(trim(code), ''), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.admin_get_invite_code()
returns text
language plpgsql stable security definer set search_path = public
as $$
declare v text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select value into v from private_settings where key = 'invite_code';
  return coalesce(v, '');
end;
$$;

revoke all on function public.admin_set_invite_code(text) from anon;
revoke all on function public.admin_get_invite_code() from anon;

-- ---------- 2 · Onboarding con invitación validada en servidor ----------
-- El perfil ya no se crea por INSERT directo del cliente:
drop policy if exists "profiles_insert_own" on profiles;

create or replace function public.complete_onboarding(
  invite text,
  new_username text,
  new_display_name text,
  accepted_terms_version int
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
begin
  if uid is null then
    raise exception 'forbidden';
  end if;

  -- Consentimiento obligatorio, ahora exigido también en servidor
  -- (RGPD art. 7; hasta ahora solo lo exigía la UI).
  if accepted_terms_version is null or accepted_terms_version < 1 then
    raise exception 'terms_not_accepted';
  end if;

  select value into stored from private_settings where key = 'invite_code';
  if stored is null or stored = '' then
    -- Cerrado por defecto: sin código configurado no entra nadie nuevo.
    raise exception 'invite_not_configured';
  end if;
  if invite is null or lower(trim(invite)) <> lower(trim(stored)) then
    raise exception 'invalid_invite';
  end if;

  insert into profiles (id, username, display_name)
  values (uid, new_username, new_display_name);

  insert into consents (user_id, doc, doc_version)
  values (uid, 'terms', accepted_terms_version)
  on conflict do nothing;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, int) from anon;
grant execute on function public.complete_onboarding(text, text, text, int) to authenticated;

-- ---------- 3 · Bloqueos entre usuarios ----------
create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

alter table blocks enable row level security;

drop policy if exists "blocks_select_own" on blocks;
create policy "blocks_select_own" on blocks for select to authenticated
  using (blocker_id = auth.uid());

-- insert/delete vía RPC (hay que romper follows en ambos sentidos)

create or replace function public.block_user(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'forbidden'; end if;
  if target = uid then raise exception 'no puedes bloquearte a ti mismo'; end if;

  insert into blocks (blocker_id, blocked_id)
  values (uid, target)
  on conflict do nothing;

  -- El bloqueo rompe la relación de seguimiento en ambos sentidos
  delete from follows
   where (follower_id = uid and followed_id = target)
      or (follower_id = target and followed_id = uid);
end;
$$;

create or replace function public.unblock_user(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  delete from blocks where blocker_id = auth.uid() and blocked_id = target;
end;
$$;

revoke all on function public.block_user(uuid) from anon;
revoke all on function public.unblock_user(uuid) from anon;

-- Un bloqueado no puede (re)seguirme mientras dure el bloqueo
create or replace function public.forbid_follow_when_blocked()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from blocks
     where (blocker_id = new.followed_id and blocked_id = new.follower_id)
        or (blocker_id = new.follower_id and blocked_id = new.followed_id)
  ) then
    raise exception 'follow_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists forbid_follow_when_blocked_trg on follows;
create trigger forbid_follow_when_blocked_trg
  before insert on follows
  for each row execute function public.forbid_follow_when_blocked();

-- ---------- 4 · Transparencia: datos agregados de moderación ----------
-- Público (página /legal/transparencia). Solo recuentos globales.
create or replace function public.moderation_stats()
returns table (open bigint, actioned bigint, dismissed bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where status = 'open'),
    count(*) filter (where status = 'actioned'),
    count(*) filter (where status = 'dismissed')
  from reports;
$$;

grant execute on function public.moderation_stats() to anon, authenticated;
