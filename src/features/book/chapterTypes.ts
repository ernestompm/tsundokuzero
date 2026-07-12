import type { DiscussionKind } from '../../lib/database.types'

export interface ThreadComment {
  id: string
  authorName: string
  authorId: string
  body: string
  createdAt: string
}

export interface ThreadDiscussion {
  id: string
  authorName: string
  authorId: string
  kind: DiscussionKind
  body: string
  isClub: boolean
  createdAt: string
  comments: ThreadComment[]
}

export interface ChapterViewData {
  bookId: string
  bookTitle: string
  chapterNumber: number
  chapterLabel: string | null
  /** true si el capítulo está dentro del progreso del lector (puede escribir) */
  canWrite: boolean
  discussions: ThreadDiscussion[]
}

export const KIND_LABEL: Record<DiscussionKind, string> = {
  comment: 'Comentario',
  theory: 'Teoría',
  question: 'Pregunta',
  reaction: 'Reacción',
}
