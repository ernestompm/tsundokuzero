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

export interface HomeConversation {
  id: string
  bookTitle: string
  author: string
  coverUrl?: string | null
  range: string
  commentCount: number
  avatars: string[]
  extra?: number
}

export interface HomeDiscover {
  id: string
  title: string
  author: string
  coverUrl?: string | null
}

export interface HomeData {
  displayName: string
  reading: HomeReading | null
  stats: { streakDays: number; booksThisYear: number }
  conversations: HomeConversation[]
  discover: HomeDiscover[]
}
