-- =====================================================================
-- Tsundoku Zero — Descartar una votación (borrarla sin efecto)
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
-- Cerrar una votación calcula la ganadora (trigger handle_poll_close).
-- «Descartar» = borrarla entera (opciones y votos caen en cascada) sin
-- ningún efecto. Solo el capitán del club o un super admin.
-- =====================================================================

drop policy if exists "polls_delete_captain" on polls;
create policy "polls_delete_captain" on polls for delete to authenticated
  using (public.is_club_captain(club_id) or public.is_super_admin());
