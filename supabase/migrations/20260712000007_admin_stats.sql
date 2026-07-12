-- =====================================================================
-- Tsundoku Zero — Métricas para el panel de administración
-- (las cuentas directas desde el cliente estarían limitadas por el
--  spoiler gate; esta RPC cuenta TODO, solo para super admins)
-- =====================================================================

create or replace function public.admin_stats()
returns table (
  users bigint,
  ideas bigint,
  replies bigint,
  books bigint,
  ideas_week bigint,
  new_users_week bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  return query select
    (select count(*) from profiles),
    (select count(*) from discussions),
    (select count(*) from discussion_comments),
    (select count(*) from books),
    (select count(*) from discussions where created_at > now() - interval '7 days'),
    (select count(*) from profiles where created_at > now() - interval '7 days');
end;
$$;

revoke all on function public.admin_stats() from anon;
grant execute on function public.admin_stats() to authenticated;
