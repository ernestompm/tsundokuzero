import type { DiscussionKind } from '../../lib/database.types'

export interface FeedItem {
  id: string
  authorName: string
  authorId: string
  bookId: string
  bookTitle: string
  chapterNumber: number
  chapterLabel: string | null
  kind: DiscussionKind
  body: string
  isClub: boolean
  createdAt: string
  commentCount: number
}

export interface HomeReading {
  bookId: string
  title: string
  author: string
  coverUrl?: string | null
  chapterNumber: number
  chapterLabel: string | null
  totalChapters: number
  percent: number
}

export interface HomeData {
  displayName: string
  /** id del usuario conectado (habilita acciones sobre lo propio) */
  myId?: string
  reading: HomeReading | null
  feed: FeedItem[]
}
