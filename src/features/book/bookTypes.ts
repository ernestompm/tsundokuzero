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
  currentChapter: number
  totalChapters: number
  currentLabel: string | null
  chapters: BookChapter[]
  avgRating: number | null
  ratingCount: number
  myRating: number | null
  /** puede valorar: tiene el libro terminado */
  canRate: boolean
}
