import type { DiscussionKind } from '../../lib/database.types'

export interface FeedItem {
  id: string
  /** idea = discusión anclada a capítulo · post = entrada de muro */
  type: 'idea' | 'post'
  authorName: string
  authorUsername?: string
  authorId: string
  bookId?: string | null
  bookTitle?: string | null
  chapterNumber?: number | null
  chapterLabel?: string | null
  kind: DiscussionKind | null
  postTitle?: string | null
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

/** Tarjeta «Conversaciones activas»: un libro con conversación en marcha. */
export interface BookConvo {
  bookId: string
  bookTitle: string
  author: string
  coverUrl?: string | null
  /** hasta qué capítulo hay conversación visible para ti */
  upTo: number
  count: number
  avatars: string[]
  extra: number
}

export interface HomeStats {
  ideas: number
  replies: number
  finished: number
}

export interface HomeDiscover {
  id: string
  title: string
  author: string
}

export interface HomeData {
  displayName: string
  /** id del usuario conectado (habilita acciones sobre lo propio) */
  myId?: string
  reading: HomeReading | null
  stats: HomeStats
  conversations: BookConvo[]
  discover: HomeDiscover[]
  feed: FeedItem[]
  /** votación abierta del club, si la hay (banner) */
  openPoll?: { id: string; title: string } | null
}
