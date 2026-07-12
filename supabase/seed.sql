-- =====================================================================
-- Tsundoku Zero · MVP-0 — Datos semilla (Plan MVP-0 §6)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase tras las migraciones,
-- en una instalación limpia.
--
-- Libro semilla: La Biblioteca de la Medianoche (Matt Haig) con sus 73
-- capítulos titulados, en orden. El número (posición) se asigna solo y
-- total_chapters se recalcula al final.
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

-- Capítulos por TÍTULO, en orden de lectura (el número lo asigna `ordinality`).
insert into chapters (book_id, number, label)
select
  '00000000-0000-4000-8000-000000000001',
  ord,
  title
from unnest(array[
  'Una conversación sobre la lluvia',
  'Diecinueve años después',
  'El hombre de la puerta',
  'Teoría de cuerdas',
  'Vivir es sufrir',
  'Puertas',
  'Cómo ser un agujero negro',
  'Antimateria',
  '00:00:00',
  'La bibliotecaria',
  'La biblioteca de la medianoche',
  'Las estanterías móviles',
  'El libro de los arrepentimientos',
  'Sobrecarga de arrepentimientos',
  'Toda vida comienza ahora',
  'Las tres herraduras',
  'La penúltima actualización que Nora publicó antes de encontrarse entre la vida y la muerte',
  'El tablero de ajedrez',
  'La única manera de aprender es vivir',
  'Fuego',
  'Pecera',
  'La última actualización que Nora publicó antes de encontrarse entre la vida y la muerte',
  'La vida exitosa',
  'Té de menta',
  'El árbol que es nuestra vida',
  'Error del sistema',
  'Svalbard',
  'Hugo Lefèvre',
  'Caminando en círculos',
  'Un momento de crisis extrema en medio de ninguna parte',
  'La frustración de no encontrar una biblioteca cuando realmente necesitas una',
  'Isla',
  'Permafrost',
  'Una noche en Longyearbyen',
  'Expectativa',
  'La vida, la muerte y la función de onda cuántica',
  'Si algo me está ocurriendo, quiero estar allí',
  'Dios y otros bibliotecarios',
  'Fama',
  'Vía Láctea',
  'Salvaje y libre',
  'Ryan Bailey',
  'Una bandeja de plata con pastelitos de miel',
  'El pódcast de las revelaciones',
  '«Aullido»',
  'Amor y dolor',
  'Equidistancia',
  'El sueño de otra persona',
  'Una vida tranquila',
  '¿Por qué querer otro universo si este tiene perros?',
  'Cena con Dylan',
  'El salón de la última oportunidad',
  'Viñedo Buena Vista',
  'Las muchas vidas de Nora Seed',
  'Perdida en la biblioteca',
  'Una perla dentro de la concha',
  'El juego',
  'La vida perfecta',
  'Una búsqueda espiritual de una conexión más profunda con el universo',
  'Hammersmith',
  'Triciclo',
  'Ya no está aquí',
  'Un incidente con la policía',
  'Una nueva manera de ver',
  'Las flores tienen agua',
  'Ningún lugar donde aterrizar',
  '¡No se te ocurra rendirte, Nora Seed!',
  'Despertar',
  'El otro lado de la desesperación',
  'Algo que he aprendido',
  'Vivir frente a comprender',
  'El volcán',
  'Cómo termina'
]) with ordinality as t(title, ord);

-- total_chapters = nº real de capítulos insertados (73)
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
--   select add_book_chapter('00000000-0000-4000-8000-000000000001', 'Nuevo título');
-- ---------------------------------------------------------------------
