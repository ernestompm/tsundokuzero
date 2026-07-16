export interface BookChapter {
  number: number
  label: string | null
  unlocked: boolean
  commentCount: number
  isCurrent: boolean
}

export interface BookViewData {
  bookId: string
  title: string
  author: string
  authorId: string | null
  coverUrl: string | null
  synopsis: string | null
  buyUrl: string | null
  /** procedencia de la portada, para la atribución (LPI, P1-8) */
  coverSource: string | null
  currentChapter: number
  totalChapters: number
  currentLabel: string | null
  chapters: BookChapter[]
  avgRating: number | null
  ratingCount: number
  myRating: number | null
  myReview: string | null
  /** puede valorar: tiene el libro terminado */
  canRate: boolean
  /** estado de lectura: null si el libro no está en tu biblioteca */
  status: 'reading' | 'finished' | 'want' | null
  /** reseñas de otros lectores (solo visibles si terminaste el libro) */
  reviews: { name: string; rating: number; review: string }[]
  /** nº de reseñas ocultas por no haber terminado (para el aviso) */
  hiddenReviews: number
}
