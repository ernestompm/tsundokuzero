import type { DiscussionKind } from '../../lib/database.types'

export interface ThreadComment {
  id: string
  authorName: string
  authorId: string
  /** null = bloqueada: su autor iba más adelante que tú */
  body: string | null
  unlockChapter?: number
  createdAt: string
}

export interface ThreadDiscussion {
  id: string
  authorName: string
  authorUsername?: string
  authorId: string
  kind: DiscussionKind
  body: string
  isClub: boolean
  createdAt: string
  comments: ThreadComment[]
  reactions: Record<string, number>
  myReaction: string | null
}

export interface ChapterViewData {
  bookId: string
  bookTitle: string
  chapterNumber: number
  chapterLabel: string | null
  /** true si el capítulo está dentro del progreso del lector (puede escribir) */
  canWrite: boolean
  /** capítulo por el que va el lector (para el aviso cuando canWrite=false) */
  myChapter?: number
  discussions: ThreadDiscussion[]
}

export const KIND_LABEL: Record<DiscussionKind, string> = {
  comment: 'Comentario',
  theory: 'Teoría',
  question: 'Pregunta',
  reaction: 'Reacción',
}
