-- =====================================================================
-- Tsundoku Zero — Alta de 3 libros por ISBN (petición de Ernesto)
-- EJECUTAR UNA VEZ en el SQL Editor. Idempotente.
--
--   978-84-663-8033-1 → El extranjero, Albert Camus (Debolsillo)
--   978-84-9105-621-8 → La muerte de Iván Ilich, Lev Tolstói (Alianza)
--   978-84-17263-46-1 → Stoner, John Williams (Baile del Sol)
--
-- Capítulos: El extranjero 11 (2 partes: 6+5) · Iván Ilich 12 · Stoner 17.
-- Sin filas en `chapters`: los títulos se añaden después desde
-- Administración → Libros («Añadir capítulo», en orden) si se quiere.
-- =====================================================================

-- Autores (con ficha)
insert into authors (name, bio, birth_year, nationality) values
  (
    'Albert Camus',
    'Escritor, dramaturgo y filósofo francés nacido en la Argelia colonial. Voz central del absurdo y de la revuelta, recibió el Premio Nobel de Literatura en 1957. Murió en un accidente de coche a los 46 años.',
    1913,
    'Francia'
  ),
  (
    'Lev Tolstói',
    'Novelista ruso, autor de «Guerra y paz» y «Ana Karénina». Tras una profunda crisis espiritual a los cuarenta años, su obra tardía —como «La muerte de Iván Ilich»— persigue una sola pregunta: cómo se vive una vida verdadera.',
    1828,
    'Rusia'
  ),
  (
    'John Williams',
    'Escritor y profesor universitario estadounidense. En vida publicó discretamente; medio siglo después, «Stoner» fue redescubierta como una obra maestra. Ganó el National Book Award en 1973 por «Augustus».',
    1922,
    'Estados Unidos'
  )
on conflict (name) do update
  set bio         = coalesce(authors.bio, excluded.bio),
      birth_year  = coalesce(authors.birth_year, excluded.birth_year),
      nationality = coalesce(authors.nationality, excluded.nationality);

-- Libros (idempotente por título+autor)
insert into books (title, author, author_id, total_chapters, synopsis, buy_url, cover_url)
select v.title, v.author, a.id, v.chapters, v.synopsis, v.buy, v.cover
from (
  values
    (
      'El extranjero',
      'Albert Camus',
      11,
      'Meursault asiste al entierro de su madre sin derramar una lágrima. Poco después, en una playa de Argel cegada por el sol, comete un acto que lo llevará a juicio — y la sociedad no juzgará tanto su crimen como su indiferencia. La novela fundacional del absurdo, en dos partes que se responden como un espejo.',
      'https://www.amazon.es/s?k=9788466380331',
      null
    ),
    (
      'La muerte de Iván Ilich',
      'Lev Tolstói',
      12,
      'Iván Ilich, juez respetable, ha vivido exactamente como se esperaba de él. Cuando una enfermedad lo condena, descubre horrorizado la pregunta que nunca se hizo: ¿y si mi vida entera no ha sido la que debía ser? La meditación más despiadada y luminosa de Tolstói sobre la muerte — y sobre la vida.',
      'https://www.amazon.es/s?k=9788491056218',
      null
    ),
    (
      'Stoner',
      'John Williams',
      17,
      'William Stoner, hijo de granjeros de Misuri, entra en la universidad para estudiar agronomía y una clase de literatura le cambia la vida para siempre. Profesor, esposo, padre: una existencia aparentemente corriente contada con una precisión que la vuelve inolvidable. La novela perfecta redescubierta medio siglo después.',
      'https://www.amazon.es/s?k=9788417263461',
      'https://covers.openlibrary.org/b/id/13711988-L.jpg'
    )
) as v(title, author, chapters, synopsis, buy, cover)
join authors a on a.name = v.author
where not exists (
  select 1 from books b where b.title = v.title and b.author = v.author
);
