import type { HomeData } from './homeTypes'

/** Datos de muestra para la página /preview (revisión de diseño sin login). */
export const SAMPLE_HOME: HomeData = {
  displayName: 'Ernesto',
  reading: {
    bookId: 'sample',
    title: 'La Biblioteca de la Medianoche',
    author: 'Matt Haig',
    coverUrl: null,
    chapterNumber: 18,
    chapterLabel: 'El tablero de ajedrez',
    totalChapters: 73,
    percent: 25,
  },
  stats: { streakDays: 15, booksThisYear: 3 },
  conversations: [
    {
      id: '1',
      bookTitle: 'La Biblioteca de la Medianoche',
      author: 'Matt Haig',
      coverUrl: null,
      range: 'Capítulos 1–10',
      commentCount: 12,
      avatars: ['Marina Ruiz', 'Carla Vega', 'Ola Prieto'],
      extra: 8,
    },
    {
      id: '2',
      bookTitle: 'Proyecto Hail Mary',
      author: 'Andy Weir',
      coverUrl: null,
      range: 'Capítulos 1–8',
      commentCount: 8,
      avatars: ['Ander Gil', 'Rosa Mateo', 'Iván Sol'],
      extra: 5,
    },
    {
      id: '3',
      bookTitle: 'Dune',
      author: 'Frank Herbert',
      coverUrl: null,
      range: 'Libro 1 · Capítulos 1–5',
      commentCount: 6,
      avatars: ['Nuria Paz', 'Pau Roig'],
      extra: 3,
    },
  ],
  discover: [
    { id: 'd1', title: 'Stoner', author: 'John Williams' },
    { id: 'd2', title: 'Los detectives salvajes', author: 'Roberto Bolaño' },
    { id: 'd3', title: 'La casa de hojas', author: 'Mark Z. Danielewski' },
    { id: 'd4', title: 'Piranesi', author: 'Susanna Clarke' },
    { id: 'd5', title: 'El infinito en un junco', author: 'Irene Vallejo' },
  ],
}
