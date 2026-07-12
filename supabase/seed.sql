-- =====================================================================
-- Tsundoku Zero · MVP-0 — Datos semilla (Plan MVP-0 §6)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase tras las migraciones.
--
-- ⚠️ AJUSTAD `total_chapters` (y el generate_series de abajo) al número
--    real de capítulos de la edición que vayáis a leer.
-- =====================================================================

-- Libro semilla
insert into books (id, title, author, total_chapters)
values (
  '00000000-0000-4000-8000-000000000001',
  'La Biblioteca de la Medianoche',
  'Matt Haig',
  45  -- ⚠️ ajustar a vuestra edición
);

insert into chapters (book_id, number, label)
select
  '00000000-0000-4000-8000-000000000001',
  n,
  'Capítulo ' || n
from generate_series(1, 45) as n;  -- ⚠️ mismo número que total_chapters

-- Club fundador (el primer usuario que se una será el capitán,
-- lo decide el trigger handle_club_member_role)
insert into clubs (id, name, slug, description, current_book_id)
values (
  '00000000-0000-4000-8000-000000000002',
  'Tsundoku Zero',
  'tsundoku-zero',
  'El club fundador. Leemos acompañados, sin spoilers.',
  '00000000-0000-4000-8000-000000000001'
);

-- Poll de ejemplo «Libro de agosto» con 3 propuestas
-- (created_by null: la semilla no tiene usuarios aún; el capitán real
-- podrá cerrar la votación igualmente)
insert into polls (id, club_id, title, status, closes_at)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'Libro de agosto',
  'open',
  '2026-07-31T23:59:59+02:00'
);

insert into poll_options (poll_id, book_title, book_author, note) values
  ('00000000-0000-4000-8000-000000000003', 'Kafka en la orilla', 'Haruki Murakami', 'Para agosto necesitamos gatos que hablan.'),
  ('00000000-0000-4000-8000-000000000003', 'El Golem', 'Gustav Meyrink', null),
  ('00000000-0000-4000-8000-000000000003', 'Los asquerosos', 'Santiago Lorenzo', null);

-- ---------------------------------------------------------------------
-- Discusiones semilla (4–6 para que nadie llegue a una sala vacía):
-- se crean DESPUÉS de que los fundadores se registren, desde la propia
-- app o con INSERTs como este (sustituid author_id):
--
-- insert into discussions (book_id, chapter_number, author_id, kind, body, club_id)
-- values ('00000000-0000-4000-8000-000000000001', 1, '<uuid-del-perfil>',
--         'question', '¿Alguien más se ha parado en la cita inicial?',
--         '00000000-0000-4000-8000-000000000002');
-- ---------------------------------------------------------------------
