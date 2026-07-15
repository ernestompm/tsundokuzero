-- =====================================================================
-- Tsundoku Zero — Reacciones a las publicaciones (❤️ 🔥 😮 💡)
-- EJECUTAR ENTERO en el SQL Editor (idempotente).
--
-- Una reacción por persona y publicación (se puede cambiar de emoji o
-- quitar). Solo se puede reaccionar a lo que puedes ver: la política
-- comprueba la visibilidad vía RLS de `discussions` (el spoiler gate).
-- =====================================================================

create table if not exists reactions (
  discussion_id uuid not null references discussions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (discussion_id, user_id)
);

create index if not exists reactions_discussion_idx on reactions (discussion_id);

alter table reactions enable row level security;

-- Ver reacciones solo de publicaciones visibles para ti (hereda el gate)
drop policy if exists "reactions_select" on reactions;
create policy "reactions_select" on reactions for select to authenticated
  using (
    exists (select 1 from discussions d where d.id = reactions.discussion_id)
  );

-- Reaccionar solo a lo que puedes ver
drop policy if exists "reactions_insert_own" on reactions;
create policy "reactions_insert_own" on reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from discussions d where d.id = reactions.discussion_id)
  );

drop policy if exists "reactions_update_own" on reactions;
create policy "reactions_update_own" on reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reactions_delete_own" on reactions;
create policy "reactions_delete_own" on reactions for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on reactions to authenticated;

-- La vista del feed ya expone los datos de la discusión; las reacciones
-- se consultan aparte por discussion_id.
