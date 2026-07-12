/**
 * Tipos de la base de datos (esquema del Plan MVP-0 §3).
 * Escritos a mano por ahora; cuando el proyecto Supabase exista se pueden
 * regenerar con: npx supabase gen types typescript --project-id <id>
 */

export type DiscussionKind = 'comment' | 'theory' | 'question' | 'reaction'
export type ReadingStatus = 'reading' | 'finished' | 'want'
export type PostVisibility = 'followers' | 'club' | 'private'
export type ClubRole = 'member' | 'captain'
export type PollStatus = 'open' | 'closed'

export type Profile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export type Follow = {
  follower_id: string
  followed_id: string
  created_at: string
}

export type Book = {
  id: string
  title: string
  author: string
  cover_url: string | null
  total_chapters: number
}

export type Chapter = {
  id: string
  book_id: string
  number: number
  label: string | null
}

export type ReadingProgress = {
  user_id: string
  book_id: string
  current_chapter: number
  status: ReadingStatus
  updated_at: string
}

export type Discussion = {
  id: string
  book_id: string
  chapter_number: number
  author_id: string
  kind: DiscussionKind
  body: string
  club_id: string | null
  created_at: string
}

export type DiscussionComment = {
  id: string
  discussion_id: string
  author_id: string
  body: string
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  title: string | null
  body: string
  book_id: string | null
  club_id: string | null
  visibility: PostVisibility
  created_at: string
}

export type Club = {
  id: string
  name: string
  slug: string
  description: string | null
  current_book_id: string | null
  created_at: string
}

export type ClubMember = {
  club_id: string
  user_id: string
  role: ClubRole
  joined_at: string
}

export type Poll = {
  id: string
  club_id: string
  title: string
  status: PollStatus
  closes_at: string | null
  created_by: string
  winner_option_id: string | null
}

export type PollOption = {
  id: string
  poll_id: string
  book_title: string
  book_author: string
  note: string | null
}

export type PollVote = {
  poll_id: string
  option_id: string
  user_id: string
  created_at: string
}

type TableDef<Row, Required extends keyof Row, Generated extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>
  Update: Partial<Omit<Row, Generated>>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, 'id' | 'username' | 'display_name', 'created_at'>
      follows: TableDef<Follow, 'follower_id' | 'followed_id', 'created_at'>
      books: TableDef<Book, 'title' | 'author' | 'total_chapters', 'id'>
      chapters: TableDef<Chapter, 'book_id' | 'number', 'id'>
      reading_progress: TableDef<ReadingProgress, 'user_id' | 'book_id', 'updated_at'>
      discussions: TableDef<
        Discussion,
        'book_id' | 'chapter_number' | 'author_id' | 'body',
        'id' | 'created_at'
      >
      discussion_comments: TableDef<
        DiscussionComment,
        'discussion_id' | 'author_id' | 'body',
        'id' | 'created_at'
      >
      posts: TableDef<Post, 'author_id' | 'body', 'id' | 'created_at'>
      clubs: TableDef<Club, 'name' | 'slug', 'id' | 'created_at'>
      club_members: TableDef<ClubMember, 'club_id' | 'user_id', 'joined_at'>
      polls: TableDef<Poll, 'club_id' | 'title' | 'created_by', 'id'>
      poll_options: TableDef<PollOption, 'poll_id' | 'book_title' | 'book_author', 'id'>
      poll_votes: TableDef<PollVote, 'poll_id' | 'option_id' | 'user_id', 'created_at'>
    }
    Views: Record<string, never>
    Functions: {
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          username: string
          display_name: string
          email: string
          is_super_admin: boolean
          club_role: ClubRole | null
          created_at: string
        }[]
      }
      admin_set_super_admin: {
        Args: { target: string; value: boolean }
        Returns: undefined
      }
      add_book_chapter: {
        Args: { book: string; title: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
