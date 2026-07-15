import type { BookViewData } from './bookTypes'

const TITLES = [
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
  'La penúltima actualización de Nora',
  'El tablero de ajedrez',
  'La única manera de aprender es vivir',
  'Fuego',
]

const CURRENT = 8
const COUNTS: Record<number, number> = { 1: 5, 2: 2, 4: 8, 5: 3, 7: 4, 8: 3 }

export const SAMPLE_BOOK: BookViewData = {
  bookId: 'sample',
  title: 'La Biblioteca de la Medianoche',
  author: 'Matt Haig',
  authorId: null,
  coverUrl: null,
  synopsis:
    'Entre la vida y la muerte hay una biblioteca. Cada libro de sus estanterías es una vida que Nora Seed pudo haber vivido: la que dejó al abandonar la natación, la que perdió al cancelar su boda, la que nunca empezó en Australia. Esta noche, Nora tendrá que decidir qué vida merece de verdad ser vivida.',
  buyUrl: 'https://www.amazon.es/dp/8420454826',
  currentChapter: CURRENT,
  totalChapters: 73,
  currentLabel: TITLES[CURRENT - 1],
  avgRating: 4.3,
  ratingCount: 6,
  myRating: 4,
  canRate: true,
  chapters: TITLES.map((label, i) => {
    const number = i + 1
    const unlocked = number <= CURRENT
    return {
      number,
      label,
      unlocked,
      commentCount: unlocked ? (COUNTS[number] ?? 0) : 0,
      isCurrent: number === CURRENT,
    }
  }),
}
