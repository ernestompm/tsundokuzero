import type { ChapterViewData } from './chapterTypes'

export const SAMPLE_CHAPTER: ChapterViewData = {
  bookId: 'sample',
  bookTitle: 'La Biblioteca de la Medianoche',
  chapterNumber: 8,
  chapterLabel: 'Antimateria',
  canWrite: true,
  discussions: [
    {
      id: '1',
      authorName: 'Alba Ferrer',
      authorId: 'a',
      kind: 'theory',
      body: 'La biblioteca no es un lugar: creo que cada estantería es una decisión que Nora no tomó. Fijaos en cómo la describe la señora Elm.',
      isClub: true,
      createdAt: 'hace 2 h',
      reactions: { '❤️': 6, '💡': 2 },
      myReaction: '💡',
      comments: [
        {
          id: 'c1',
          authorName: 'Carmen Ruiz',
          authorId: 'b',
          body: 'Yo también lo pensé, y ojo al reloj parado a las 00:00…',
          createdAt: 'hace 1 h',
        },
        {
          id: 'c2',
          authorName: 'Pau Roig',
          authorId: 'z',
          body: null,
          unlockChapter: 40,
          createdAt: 'hace 20 min',
        },
      ],
    },
    {
      id: '2',
      authorName: 'Chas Molina',
      authorId: 'c',
      kind: 'question',
      body: '¿Alguien más se ha parado en la cita inicial? Creo que resume el libro entero.',
      isClub: false,
      createdAt: 'hace 40 min',
      reactions: {},
      myReaction: null,
      comments: [],
    },
  ],
}
