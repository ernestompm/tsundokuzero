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
  /** ajuste: ver respuestas de gente que va por delante (migr. 017) */
  show_ahead_replies: boolean
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
  author_id: string | null
  synopsis: string | null
  buy_url: string | null
  created_at: string
  created_by: string | null
  /** procedencia de la portada/sinopsis (LPI, migr. 018) */
  cover_source: string | null
  synopsis_source: string | null
}

export type Author = {
  id: string
  name: string
  bio: string | null
  birth_year: number | null
  nationality: string | null
  website: string | null
  photo_url: string | null
  created_at: string
  /** crédito y licencia de la foto (LPI, migr. 018) */
  photo_credit: string | null
  photo_license: string | null
}

export type BookRating = {
  book_id: string
  user_id: string
  rating: number
  review: string | null
  created_at: string
}

export type Reaction = {
  discussion_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type NotificationType =
  | 'reply'
  | 'follow'
  | 'poll'
  | 'unlock'
  | 'book_done'
  | 'moderation'

/** Preferencias del centro de avisos (migr. 018) */
export type NotificationPrefsRow = {
  user_id: string
  reply: boolean
  follow: boolean
  poll: boolean
  unlock: boolean
  book_done: boolean
}

export type Notification = {
  id: string
  user_id: string
  actor_id: string | null
  type: NotificationType
  discussion_id: string | null
  poll_id: string | null
  book_id: string | null
  read: boolean
  created_at: string
  /** motivo de una decisión de moderación (DSA art. 17, migr. 018) */
  note: string | null
}

/** Registro inmutable de aceptación de términos (RGPD art. 7, migr. 018) */
export type Consent = {
  user_id: string
  doc: 'terms'
  doc_version: number
  accepted_at: string
}

/** Ajustes públicos de la app: datos del titular para los textos legales
 *  (migr. 019). Lectura anónima — jamás guardar secretos aquí. */
export type AppSetting = {
  key: string
  value: string
  updated_at: string
}

/** Bloqueo entre usuarios (P2-13, migr. 020) */
export type Block = {
  blocker_id: string
  blocked_id: string
  created_at: string
}

export type ReportTargetType =
  | 'discussion'
  | 'comment'
  | 'post'
  | 'review'
  | 'profile'
export type ReportReason =
  | 'illegal'
  | 'harassment'
  | 'spoiler'
  | 'spam'
  | 'ip'
  | 'other'
export type ReportStatus = 'open' | 'actioned' | 'dismissed'

/** Denuncia de contenido (DSA art. 16, migr. 018) */
export type Report = {
  id: string
  reporter_id: string | null
  reported_user_id: string | null
  target_type: ReportTargetType
  target_id: string
  excerpt: string | null
  reason: ReportReason
  details: string | null
  status: ReportStatus
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
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
  /** capítulo por el que iba el autor al responder (lo fija un trigger) */
  author_chapter: number | null
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
  /** libro del catálogo (las votaciones se componen de libros creados) */
  book_id: string | null
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
      books: TableDef<
        Book,
        'title' | 'author' | 'total_chapters',
        'id' | 'created_at' | 'created_by'
      >
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
      authors: TableDef<Author, 'name', 'id' | 'created_at'>
      book_ratings: TableDef<BookRating, 'book_id' | 'user_id' | 'rating', 'created_at'>
      reactions: TableDef<Reaction, 'discussion_id' | 'user_id' | 'emoji', 'created_at'>
      notifications: TableDef<
        Notification,
        'user_id' | 'type',
        'id' | 'created_at'
      >
      notification_prefs: TableDef<NotificationPrefsRow, 'user_id', never>
      consents: TableDef<Consent, 'user_id' | 'doc' | 'doc_version', 'accepted_at'>
      reports: TableDef<
        Report,
        'target_type' | 'target_id' | 'reason',
        'id' | 'created_at' | 'status' | 'resolved_at' | 'resolution_note'
      >
      app_settings: TableDef<AppSetting, 'key' | 'value', 'updated_at'>
      blocks: TableDef<Block, 'blocker_id' | 'blocked_id', 'created_at'>
    }
    Views: {
      /** reseñas: review=null hasta que TERMINAS el libro (o es tuya) */
      book_reviews: {
        Row: {
          book_id: string
          user_id: string
          rating: number
          created_at: string
          has_review: boolean
          review: string | null
        }
        Relationships: []
      }
      /** discusiones con teaser: body=null cuando está bloqueada para ti */
      feed_discussions: {
        Row: {
          id: string
          book_id: string
          chapter_number: number
          author_id: string
          kind: DiscussionKind
          club_id: string | null
          created_at: string
          unlocked: boolean
          body: string | null
        }
        Relationships: []
      }
      /** respuestas con teaser: body=null hasta llegar a author_chapter */
      thread_comments: {
        Row: {
          id: string
          discussion_id: string
          author_id: string
          created_at: string
          author_chapter: number
          book_id: string
          unlocked: boolean
          body: string | null
        }
        Relationships: []
      }
    }
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
      transfer_captaincy: {
        Args: { club: string; new_captain: string }
        Returns: undefined
      }
      club_kick_member: {
        Args: { club: string; target: string }
        Returns: undefined
      }
      captain_books_left: {
        Args: Record<string, never>
        Returns: number
      }
      admin_create_club: {
        Args: { club_name: string; club_slug: string; book: string }
        Returns: string
      }
      admin_list_discussions: {
        Args: Record<string, never>
        Returns: {
          id: string
          body: string
          kind: DiscussionKind
          chapter_number: number
          created_at: string
          is_club: boolean
          book_title: string
          author_name: string
          author_id: string
          comment_count: number
        }[]
      }
      admin_update_discussion: {
        Args: { target: string; new_body: string }
        Returns: undefined
      }
      admin_delete_discussion: {
        Args: { target: string }
        Returns: undefined
      }
      admin_delete_user: {
        Args: { target: string }
        Returns: undefined
      }
      admin_stats: {
        Args: Record<string, never>
        Returns: {
          users: number
          ideas: number
          replies: number
          books: number
          ideas_week: number
          new_users_week: number
        }[]
      }
      delete_own_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      export_my_data: {
        Args: Record<string, never>
        Returns: unknown
      }
      admin_resolve_report: {
        Args: { report: string; new_status: string; note?: string | null }
        Returns: undefined
      }
      admin_delete_comment: {
        Args: { target: string }
        Returns: undefined
      }
      admin_delete_post: {
        Args: { target: string }
        Returns: undefined
      }
      admin_delete_review: {
        Args: { book: string; target_user: string }
        Returns: undefined
      }
      complete_onboarding: {
        Args: {
          invite: string
          new_username: string
          new_display_name: string
          accepted_terms_version: number
        }
        Returns: undefined
      }
      admin_set_invite_code: {
        Args: { code: string }
        Returns: undefined
      }
      admin_get_invite_code: {
        Args: Record<string, never>
        Returns: string
      }
      block_user: {
        Args: { target: string }
        Returns: undefined
      }
      unblock_user: {
        Args: { target: string }
        Returns: undefined
      }
      moderation_stats: {
        Args: Record<string, never>
        Returns: { open: number; actioned: number; dismissed: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
