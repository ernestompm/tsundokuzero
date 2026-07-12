-- =====================================================================
-- Tsundoku Zero · MVP-0 — Rol super admin + gestión de usuarios
--
-- El estado de super admin vive en auth.users.raw_app_meta_data
-- ("app_metadata"): el usuario NUNCA puede modificarlo desde el cliente
-- (solo el rol de servicio / dashboard / estas funciones security definer).
-- Es más seguro que una columna en profiles, que el propio usuario podría
-- tocar con su política update-own.
-- =====================================================================

-- ¿El usuario actual es super admin? Lee el claim del JWT.
create or replace function public.is_super_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- Listado de usuarios para el panel de administración.
-- El WHERE con is_super_admin() actúa de guarda: si quien llama no es
-- admin, la función devuelve cero filas (no expone ningún email).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  is_super_admin boolean,
  club_role text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select
    p.id,
    p.username,
    p.display_name,
    u.email::text,
    coalesce((u.raw_app_meta_data ->> 'is_super_admin')::boolean, false),
    (select cm.role from club_members cm where cm.user_id = p.id limit 1),
    p.created_at
  from profiles p
  join auth.users u on u.id = p.id
  where public.is_super_admin()
  order by p.created_at;
$$;

-- Promover / degradar a super admin a otro usuario (solo super admins).
create or replace function public.admin_set_super_admin(target uuid, value boolean)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: solo un super admin puede cambiar roles';
  end if;
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('is_super_admin', value)
   where id = target;
end;
$$;

revoke all on function public.admin_list_users() from anon;
revoke all on function public.admin_set_super_admin(uuid, boolean) from anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_super_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Bootstrap del fundador: cuando ernestompm@gmail.com complete su
-- onboarding (insert en profiles), se auto-promociona a super admin.
-- El cambio de app_metadata se refleja al refrescar el token, así que
-- tras registrarse deberá cerrar sesión y volver a entrar una vez.
-- ---------------------------------------------------------------------
create or replace function public.auto_promote_founder()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
           || '{"is_super_admin": true}'::jsonb
   where id = new.id
     and email = 'ernestompm@gmail.com';
  return new;
end;
$$;

create trigger promote_founder_after_profile_insert
  after insert on profiles
  for each row execute function public.auto_promote_founder();
