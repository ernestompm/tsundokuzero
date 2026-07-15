-- =====================================================================
-- Tsundoku Zero — Expulsar miembro del club (solo capitán / super admin)
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
-- =====================================================================

create or replace function public.club_kick_member(club uuid, target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_club_captain(club) and not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if target = auth.uid() then
    raise exception 'no puedes expulsarte a ti mismo';
  end if;
  delete from club_members where club_id = club and user_id = target;
end;
$$;

revoke all on function public.club_kick_member(uuid, uuid) from anon;
grant execute on function public.club_kick_member(uuid, uuid) to authenticated;
