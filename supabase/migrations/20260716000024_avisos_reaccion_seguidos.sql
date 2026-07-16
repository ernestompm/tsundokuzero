-- ============================================================
-- 024 · Dos avisos nuevos + sus preferencias
--
--   reaction  → alguien reaccionó a una idea tuya
--   new_idea  → alguien a quien SIGUES compartió una idea
--
-- Anti-spoiler: el aviso no lleva contenido, solo quién y dónde.
-- Al tocarlo se aterriza en el hilo, donde el gate del servidor
-- decide qué se ve (teaser si no has llegado a ese capítulo).
-- El CHECK de tipos se eliminó en la 018_compliance, así que no
-- hay que tocar la tabla notifications.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Preferencias nuevas (activadas por defecto)
-- ------------------------------------------------------------
alter table public.notification_prefs
  add column if not exists reaction boolean not null default true,
  add column if not exists new_idea boolean not null default true;

-- El filtro único (migr. 018) aprende los dos tipos nuevos
create or replace function public.notification_pref_allows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.notification_prefs%rowtype;
begin
  select * into prefs
  from public.notification_prefs
  where user_id = new.user_id;

  if not found then
    return new; -- sin preferencias guardadas: se avisa de todo
  end if;

  if (new.type = 'reply'     and not prefs.reply)
  or (new.type = 'follow'    and not prefs.follow)
  or (new.type = 'poll'      and not prefs.poll)
  or (new.type = 'unlock'    and not prefs.unlock)
  or (new.type = 'book_done' and not prefs.book_done)
  or (new.type = 'reaction'  and not prefs.reaction)
  or (new.type = 'new_idea'  and not prefs.new_idea)
  then
    return null; -- descartado en silencio
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2) reaction · reaccionan a una idea tuya
-- ------------------------------------------------------------
create or replace function public.notify_reaction()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  idea_author uuid;
begin
  select d.author_id into idea_author
  from public.discussions d
  where d.id = new.discussion_id;

  -- Nunca por reaccionarte a ti mismo
  if idea_author is not null and idea_author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, discussion_id)
    values (idea_author, new.user_id, 'reaction', new.discussion_id);
  end if;
  return new;
end;
$$;

revoke all on function public.notify_reaction() from public, anon, authenticated;

drop trigger if exists notify_reaction_after_insert on public.reactions;
create trigger notify_reaction_after_insert
  after insert on public.reactions
  for each row execute function public.notify_reaction();

-- ------------------------------------------------------------
-- 3) new_idea · alguien a quien sigues comparte una idea
-- ------------------------------------------------------------
create or replace function public.notify_new_idea()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Un aviso por cada seguidor del autor (escala de club: decenas)
  insert into public.notifications (user_id, actor_id, type, discussion_id, book_id)
  select f.follower_id, new.author_id, 'new_idea', new.id, new.book_id
  from public.follows f
  where f.followed_id = new.author_id
    and f.follower_id <> new.author_id;
  return new;
end;
$$;

revoke all on function public.notify_new_idea() from public, anon, authenticated;

drop trigger if exists notify_new_idea_after_insert on public.discussions;
create trigger notify_new_idea_after_insert
  after insert on public.discussions
  for each row execute function public.notify_new_idea();
