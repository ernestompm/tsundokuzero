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
  coverUrl: string | null
  currentChapter: number
  totalChapters: number
  currentLabel: string | null
  chapters: BookChapter[]
}
