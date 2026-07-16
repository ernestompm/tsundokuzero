-- ============================================================
-- 017 · Ajuste por usuario: «puedo ver las respuestas de
--       personas que van por delante de mí en la lectura»
--
-- Algunos lectores prefieren conversación fluida a protección
-- total: si activan el ajuste, las RESPUESTAS escritas desde
-- capítulos más adelantados dejan de ocultarse PARA ELLOS.
-- Las IDEAS ancladas a capítulos no alcanzados siguen selladas
-- (esa es la regla madre anti-spoiler y no se toca).
--
-- El cambio es de servidor (la vista deja de enmascarar body);
-- el blur de la UI nunca fue la protección real.
-- ============================================================

alter table public.profiles
  add column if not exists show_ahead_replies boolean not null default false;

create or replace view public.thread_comments as
select
  c.id, c.discussion_id, c.author_id, c.created_at,
  coalesce(c.author_chapter, d.chapter_number) as author_chapter,
  d.book_id,
  (c.author_id = auth.uid()
   or coalesce(c.author_chapter, d.chapter_number)
      <= public.current_chapter_of(auth.uid(), d.book_id)
   or coalesce(
        (select p.show_ahead_replies from public.profiles p where p.id = auth.uid()),
        false
      )) as unlocked,
  case
    when c.author_id = auth.uid()
      or coalesce(c.author_chapter, d.chapter_number)
         <= public.current_chapter_of(auth.uid(), d.book_id)
      or coalesce(
           (select p.show_ahead_replies from public.profiles p where p.id = auth.uid()),
           false
         )
    then c.body
  end as body
from discussion_comments c
join discussions d on d.id = c.discussion_id
-- el hilo padre debe estar desbloqueado para ver siquiera el teaser
where d.author_id = auth.uid()
   or d.chapter_number <= public.current_chapter_of(auth.uid(), d.book_id);

alter view public.thread_comments set (security_invoker = false);
revoke all on public.thread_comments from anon, authenticated;
grant select on public.thread_comments to authenticated;
