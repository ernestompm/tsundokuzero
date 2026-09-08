import type { Dimensions } from '../../components/RatingBars'

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
  /** tus 4 dimensiones (migr. 028), todas opcionales */
  myDimensions: Dimensions
  /** media del club en cada dimensión, null si nadie la ha puntuado */
  clubDimensions: Dimensions
  /** puede valorar: tiene el libro terminado */
  canRate: boolean
  /** estado de lectura: null si el libro no está en tu biblioteca */
  status: 'reading' | 'finished' | 'want' | null
  /** reseñas de otros lectores (solo visibles si terminaste el libro) */
  reviews: { name: string; rating: number; review: string }[]
  /** nº de reseñas ocultas por no haber terminado (para el aviso) */
  hiddenReviews: number
  /** el club ya abrió las reseñas de este libro (migr. 029) */
  premiered: boolean
  /** dónde va cada miembro del club en este libro (mapa, migr. 029) */
  readers: {
    id: string
    name: string
    avatar: string | null
    chapter: number
    isMe: boolean
  }[]
}
