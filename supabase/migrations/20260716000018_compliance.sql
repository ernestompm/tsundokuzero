-- =====================================================================
-- 018 · Cumplimiento normativo (auditoría legal 16/07/2026)
-- EJECUTAR ENTERO en el SQL Editor. Idempotente (re-ejecutable).
--
--  1. consents — aceptación de términos con versión y fecha (RGPD art. 7;
--     P0-2). Inmutable: solo insert/select del propio usuario.
--  2. delete_own_account() — derecho de supresión autoservicio (RGPD
--     art. 17; P0-4). Borra avatar + auth.users (cascada al resto).
--  3. reports — denuncias de contenido (DSA art. 16; P0-5) + resolución
--     con notificación motivada al autor (DSA art. 17).
--  4. Notificación tipo 'moderation' con nota (motivo de la retirada).
--  5. export_my_data() — portabilidad (RGPD art. 20; P1-6).
--  6. authors.photo_credit / photo_license — crédito obligatorio de la
--     foto de autor (LPI; P1-9).
--  7. books.cover_source / synopsis_source — procedencia de portada y
--     sinopsis (LPI; P1-8).
--  8. Se elimina el trigger auto_promote_founder (email personal
--     incrustado en código; P1-10). La promoción a admin ya se hace
--     desde el panel (admin_set_super_admin) o el dashboard.
-- =====================================================================

-- ---------- 1 · Registro de consentimientos ----------
create table if not exists consents (
  user_id uuid not null references profiles(id) on delete cascade,
  doc text not null check (doc in ('terms')),
  doc_version int not null check (doc_version > 0),
  accepted_at timestamptz not null default now(),
  primary key (user_id, doc, doc_version)
);

alter table consents enable row level security;

drop policy if exists "consents_select_own" on consents;
create policy "consents_select_own" on consents for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "consents_insert_own" on consents;
create policy "consents_insert_own" on consents for insert to authenticated
  with check (user_id = auth.uid());
-- Sin UPDATE ni DELETE: el registro de consentimiento es un log inmutable
-- (desaparece con la cuenta por la cascada del FK).

-- ---------- 2 · Supresión de cuenta por el propio usuario ----------
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth, storage
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'forbidden';
  end if;
  -- El avatar vive en Storage y no cae por cascada
  delete from storage.objects
   where bucket_id = 'avatars'
     and (storage.foldername(name))[1] = uid::text;
  -- auth.users → cascada a profiles y a todo el contenido
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------- 3 · Denuncias de contenido (DSA art. 16) ----------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  reported_user_id uuid references profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('discussion', 'comment', 'post', 'review', 'profile')),
  target_id text not null,
  excerpt text check (char_length(excerpt) <= 300),
  reason text not null
    check (reason in ('illegal', 'harassment', 'spoiler', 'spam', 'ip', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists reports_status_idx on reports (status, created_at desc);

alter table reports enable row level security;

drop policy if exists "reports_insert_own" on reports;
create policy "reports_insert_own" on reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "reports_select" on reports;
create policy "reports_select" on reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_super_admin());

drop policy if exists "reports_admin_update" on reports;
create policy "reports_admin_update" on reports for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- 4 · Notificación de moderación con motivo (DSA art. 17) ----------
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reply', 'follow', 'poll', 'unlock', 'book_done', 'moderation'));
alter table notifications add column if not exists note text;

-- Resolver una denuncia; si se retira contenido, notifica el motivo al autor.
create or replace function public.admin_resolve_report(
  report uuid,
  new_status text,
  note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r reports%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if new_status not in ('actioned', 'dismissed') then
    raise exception 'estado no válido';
  end if;

  select * into r from reports where id = report;
  if not found then
    raise exception 'denuncia no encontrada';
  end if;

  update reports
     set status = new_status,
         resolved_at = now(),
         resolution_note = note
   where id = report;

  -- DSA art. 17: motivación de la decisión al usuario afectado
  if new_status = 'actioned' and r.reported_user_id is not null then
    insert into notifications (user_id, type, note)
    values (
      r.reported_user_id,
      'moderation',
      coalesce(note, 'Un moderador ha retirado uno de tus contenidos por incumplir las normas de la comunidad.')
    );
  end if;
end;
$$;

-- Retiradas por tipo de contenido (espejo de admin_delete_discussion)
create or replace function public.admin_delete_comment(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from discussion_comments where id = target;
end;
$$;

create or replace function public.admin_delete_post(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from posts where id = target;
end;
$$;

create or replace function public.admin_delete_review(book uuid, target_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  delete from book_ratings where book_id = book and user_id = target_user;
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, text) from anon;
revoke all on function public.admin_delete_comment(uuid) from anon;
revoke all on function public.admin_delete_post(uuid) from anon;
revoke all on function public.admin_delete_review(uuid, uuid) from anon;

-- ---------- 5 · Portabilidad de datos (RGPD art. 20) ----------
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'service', 'Tsundoku Zero',
    'profile', (select to_jsonb(p) from profiles p where p.id = uid),
    'reading_progress', coalesce(
      (select jsonb_agg(to_jsonb(r)) from reading_progress r where r.user_id = uid), '[]'::jsonb),
    'discussions', coalesce(
      (select jsonb_agg(to_jsonb(d)) from discussions d where d.author_id = uid), '[]'::jsonb),
    'comments', coalesce(
      (select jsonb_agg(to_jsonb(c)) from discussion_comments c where c.author_id = uid), '[]'::jsonb),
    'posts', coalesce(
      (select jsonb_agg(to_jsonb(po)) from posts po where po.author_id = uid), '[]'::jsonb),
    'reviews', coalesce(
      (select jsonb_agg(to_jsonb(br)) from book_ratings br where br.user_id = uid), '[]'::jsonb),
    'reactions', coalesce(
      (select jsonb_agg(to_jsonb(re)) from reactions re where re.user_id = uid), '[]'::jsonb),
    'poll_votes', coalesce(
      (select jsonb_agg(to_jsonb(pv)) from poll_votes pv where pv.user_id = uid), '[]'::jsonb),
    'follows', jsonb_build_object(
      'following', coalesce(
        (select jsonb_agg(f.followed_id) from follows f where f.follower_id = uid), '[]'::jsonb),
      'followers', coalesce(
        (select jsonb_agg(f.follower_id) from follows f where f.followed_id = uid), '[]'::jsonb)),
    'club_memberships', coalesce(
      (select jsonb_agg(to_jsonb(cm)) from club_members cm where cm.user_id = uid), '[]'::jsonb),
    'consents', coalesce(
      (select jsonb_agg(to_jsonb(co)) from consents co where co.user_id = uid), '[]'::jsonb),
    'reports_filed', coalesce(
      (select jsonb_agg(to_jsonb(rp)) from reports rp where rp.reporter_id = uid), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------- 6 · Crédito y licencia de la foto de autor (LPI) ----------
alter table authors add column if not exists photo_credit text;
alter table authors add column if not exists photo_license text;

-- ---------- 7 · Procedencia de portada y sinopsis (LPI) ----------
alter table books add column if not exists cover_source text;
alter table books add column if not exists synopsis_source text;

-- ---------- 8 · Fuera el email personal incrustado ----------
drop trigger if exists promote_founder_after_profile_insert on profiles;
drop function if exists public.auto_promote_founder();
