import type { ThreadViewData } from './chapterTypes'

export const SAMPLE_THREAD: ThreadViewData = {
  discussionId: 'sample',
  bookId: 'sample',
  bookTitle: 'La Biblioteca de la Medianoche',
  chapterNumber: 8,
  chapterLabel: 'Antimateria',
  authorId: 'a',
  authorName: 'Alba Ferrer',
  authorUsername: 'alba',
  kind: 'theory',
  // Dos párrafos a propósito: los saltos de línea ya se respetan (migr. 037)
  body: [
    'La biblioteca no es un lugar: creo que cada estantería es una decisión que Nora no tomó.',
    'Fijaos en cómo la describe la señora Elm, siempre en términos de caminos y bifurcaciones. No es casualidad.',
  ].join('\n\n'),
  isClub: true,
  createdAt: 'hace 2 h',
  reactions: { '❤️': 6, '💡': 2 },
  myReaction: '💡',
  canWrite: true,
  myChapter: 8,
  comments: [
    {
      id: 'c1',
      authorId: 'b',
      authorName: 'Carmen Ruiz',
      body: 'Yo también lo pensé, y ojo al reloj parado a las 00:00: creo que marca el umbral entre sus vidas.',
      createdAt: 'hace 1 h',
    },
    {
      id: 'c2',
      authorId: 'e',
      authorName: 'Ernesto Pérez',
      body: 'Buena observación. A mí me recordó al jardín de los senderos que se bifurcan de Borges.',
      createdAt: 'hace 30 min',
    },
    {
      id: 'c3',
      authorId: 'z',
      authorName: 'Pau Roig',
      body: null,
      unlockChapter: 40,
      createdAt: 'hace 10 min',
    },
    // Jurada: cerrada para ti, pero su autora dice que no destripa nada
    {
      id: 'c4',
      authorId: 'm',
      authorName: 'Marina Álvarez',
      body: null,
      unlockChapter: 31,
      swornSafe: true,
      canReveal: true,
      createdAt: 'hace 5 min',
    },
  ],
}
