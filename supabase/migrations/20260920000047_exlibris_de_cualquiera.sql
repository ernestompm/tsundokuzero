-- =====================================================================
-- 047 · Los ex libris de cualquiera
-- EJECUTAR ENTERO en el SQL Editor. Idempotente.
--
-- `mis_exlibris` solo devolvía los míos, así que la colección solo se
-- veía en MI perfil. Media gracia de una colección es enseñarla, y la
-- otra media es ver la de los demás y querer la que te falta: en el
-- perfil público no había ni rastro.
-- =====================================================================

create or replace function public.exlibris_de(p_user uuid)
returns table (
  book_id uuid,
  title text,
  author text,
  cover_url text,
  terminado_el timestamptz,
  companeros text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.author,
    b.cover_url,
    rp.updated_at,
    coalesce((
      select array_agg(p.display_name order by rp2.updated_at)
        from reading_progress rp2
        join profiles p on p.id = rp2.user_id
        join club_members m on m.user_id = rp2.user_id
        join club_members yo on yo.club_id = m.club_id and yo.user_id = auth.uid()
       where rp2.book_id = b.id
         and rp2.status = 'finished'
         and rp2.user_id <> p_user
         and not public.bloqueado(rp2.user_id)
    ), array[]::text[])
  from reading_progress rp
  join books b on b.id = rp.book_id
 where rp.user_id = p_user
   and rp.status = 'finished'
   -- Solo de gente de tu club: la estantería de un desconocido no es
   -- asunto tuyo, aunque sus libros sean públicos.
   and (
     p_user = auth.uid()
     or exists (
       select 1 from club_members a
       join club_members b2 on b2.club_id = a.club_id
        where a.user_id = auth.uid() and b2.user_id = p_user
     )
   )
 order by rp.updated_at desc;
$$;

revoke all on function public.exlibris_de(uuid) from anon, public;
grant execute on function public.exlibris_de(uuid) to authenticated;
