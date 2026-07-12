-- =====================================================================
-- Tsundoku Zero — Discusiones semilla (Plan MVP-0 §6)
-- Ejecutar UNA VEZ, DESPUÉS de que exista al menos un usuario (el
-- capitán). Ancladas a los primeros capítulos para que ningún beta
-- tester llegue a una sala vacía. Autor: el capitán del club.
-- =====================================================================

with captain as (
  select cm.user_id, cm.club_id
    from club_members cm
   where cm.role = 'captain'
   order by cm.joined_at
   limit 1
),
book as (
  select id from books
   where id = '00000000-0000-4000-8000-000000000001'
)
insert into discussions (book_id, chapter_number, author_id, kind, body, club_id)
select b.id, v.chapter, c.user_id, v.kind, v.body, c.club_id
  from captain c
 cross join book b
 cross join (values
    (1, 'question', '¿Qué os ha parecido el arranque con la señora Elm y la lluvia? A mí ese tablero de ajedrez ya me tiene intrigado.'),
    (1, 'comment', 'Bienvenidos al club 📚 Regla de oro: aquí solo verás conversaciones de capítulos que ya hayas alcanzado. Marca tu progreso y participa sin miedo.'),
    (2, 'comment', 'El salto de «diecinueve años después» me ha descolocado en el buen sentido. Matt Haig no pierde el tiempo.'),
    (3, 'theory', 'Teoría temprana: el hombre de la puerta va a ser más importante de lo que parece. Apunto aquí para reírnos luego.'),
    (4, 'question', '¿Alguien más ha subrayado media «Teoría de cuerdas»? Qué manera de contar la física sin contar física.')
 ) as v(chapter, kind, body)
on conflict do nothing;
