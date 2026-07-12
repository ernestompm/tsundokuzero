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
  coverUrl: null,
  currentChapter: CURRENT,
  totalChapters: 73,
  currentLabel: TITLES[CURRENT - 1],
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
