import type { DiscussionKind } from '../../lib/database.types'

/** Mensaje padre citado encima de una respuesta (contexto en el feed). */
export interface FeedParent {
  discussionId: string
  authorName: string
  authorAvatar?: string | null
  authorUsername?: string
  /** null = el padre está por delante de tu progreso */
  body: string | null
  chapterNumber: number
  chapterLabel: string | null
  bookTitle: string
  bookId?: string
}

/** Respuesta mostrada colgando de su publicación (o de la cita). */
export interface FeedReply {
  id: string
  authorId: string
  authorName: string
  authorAvatar?: string | null
  authorUsername?: string
  /** null = bloqueada (su autor iba por delante de ti) */
  body: string | null
  unlockChapter?: number
  createdAt: string
}

export interface FeedItem {
  id: string
  /** idea = publicación anclada · reply = respuesta (con padre citado) · post = muro */
  type: 'idea' | 'reply' | 'post'
  authorName: string
  authorAvatar?: string | null
  authorUsername?: string
  authorId: string
  createdAt: string
  /** null = bloqueada para ti (teaser con blur) */
  body: string | null
  isClub: boolean

  // --- idea ---
  bookId?: string | null
  bookTitle?: string | null
  chapterNumber?: number | null
  chapterLabel?: string | null
  kind?: DiscussionKind | null
  commentCount?: number
  reactions?: Record<string, number>
  myReaction?: string | null

  // --- reply (una tarjeta por HILO, no por respuesta) ---
  parent?: FeedParent

  /** respuestas colgando (ideas del feed y tarjetas de hilo) */
  replies?: FeedReply[]

  // --- post ---
  postTitle?: string | null
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
  upTo: number
  count: number
  avatars: { name: string; url?: string | null }[]
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

/** Filtro del feed: todo · mi club · mis lecturas actuales · ya leídos */
export type FeedFilter = 'all' | 'club' | 'reading' | 'finished'

export interface HomeData {
  displayName: string
  myId?: string
  myAvatar?: string | null
  /** TODAS las lecturas en curso (la primera es la más reciente) */
  readings: HomeReading[]
  /** ids de libro para los filtros del feed */
  readingBookIds: string[]
  finishedBookIds: string[]
  stats: HomeStats
  conversations: BookConvo[]
  discover: HomeDiscover[]
  feed: FeedItem[]
  openPoll?: { id: string; title: string } | null
}
