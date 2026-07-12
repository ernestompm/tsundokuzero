-- =====================================================================
-- Tsundoku Zero · MVP-0 — Datos semilla (Plan MVP-0 §6)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase tras las migraciones,
-- en una instalación limpia.
--
-- ✍️  SOLO tienes que editar la lista de TÍTULOS de abajo: pégalos en el
--     orden real de lectura de vuestra edición. El sistema les asigna la
--     posición (1º, 2º, 3º…) y calcula el total de capítulos solo.
--     Puedes poner los que quieras: no hace falta que estén numerados.
-- =====================================================================

-- Libro semilla (total_chapters se recalcula más abajo)
insert into books (id, title, author, total_chapters)
values (
  '00000000-0000-4000-8000-000000000001',
  'La Biblioteca de la Medianoche',
  'Matt Haig',
  1
)
on conflict (id) do update
  set title = excluded.title, author = excluded.author;

-- Instalación limpia: quita capítulos previos de este libro antes de sembrar.
delete from chapters where book_id = '00000000-0000-4000-8000-000000000001';

-- >>> PEGA AQUÍ LOS TÍTULOS DE TUS CAPÍTULOS, EN ORDEN <<<
-- (añade o quita filas libremente; el número se asigna por el orden)
insert into chapters (book_id, number, label)
select
  '00000000-0000-4000-8000-000000000001',
  ord,
  title
from unnest(array[
  'Título del capítulo 1',
  'Título del capítulo 2',
  'Título del capítulo 3',
  'Título del capítulo 4',
  'Título del capítulo 5',
  'Título del capítulo 6',
  'Título del capítulo 7',
  'Título del capítulo 8'
  -- … sigue añadiendo tus títulos reales, uno por línea, separados por comas
]) with ordinality as t(title, ord);

-- total_chapters = nº de títulos que hayas puesto arriba
update books
   set total_chapters = (
     select count(*) from chapters
     where book_id = '00000000-0000-4000-8000-000000000001'
   )
 where id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------
-- Club fundador (el primer usuario que se una será el capitán)
-- ---------------------------------------------------------------------
insert into clubs (id, name, slug, description, current_book_id)
values (
  '00000000-0000-4000-8000-000000000002',
  'Tsundoku Zero',
  'tsundoku-zero',
  'El club fundador. Leemos acompañados, sin spoilers.',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

-- Poll de ejemplo «Libro de agosto» con 3 propuestas
insert into polls (id, club_id, title, status, closes_at)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'Libro de agosto',
  'open',
  '2026-07-31T23:59:59+02:00'
)
on conflict (id) do nothing;

insert into poll_options (poll_id, book_title, book_author, note) values
  ('00000000-0000-4000-8000-000000000003', 'Kafka en la orilla', 'Haruki Murakami', 'Para agosto necesitamos gatos que hablan.'),
  ('00000000-0000-4000-8000-000000000003', 'El Golem', 'Gustav Meyrink', null),
  ('00000000-0000-4000-8000-000000000003', 'Los asquerosos', 'Santiago Lorenzo', null)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Añadir capítulos SUELTOS más adelante (por título, sin tocar números):
--   select add_book_chapter('00000000-0000-4000-8000-000000000001', 'Nuevo capítulo');
-- ---------------------------------------------------------------------
