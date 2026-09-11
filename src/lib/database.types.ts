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
  /** última vez que miró la actividad del club (migr. 032) */
  club_seen_at: string | null
  /** marcas por tipo de aviso (migr. 033) */
  ideas_seen_at: string | null
  replies_seen_at: string | null
  reactions_seen_at: string | null
  ahead_seen_at: string | null
  /** puede dejar notas de desarrollo desde dentro (migr. 038) */
  beta_tester: boolean
  /** permiso de un solo uso para fundar un club (migr. 038) */
  can_create_club: boolean
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
  /** ISBN normalizado (migr. 026): clave de deduplicado del catálogo */
  isbn: string | null
  /** false = capítulos provisionales (candidato de votación, migr. 027) */
  chapters_confirmed: boolean
}

/** Una recomendación de una persona a otra (migr. 034) */
export type Recommendation = {
  id: string
  from_user: string
  to_user: string
  book_id: string
  note: string | null
  created_at: string
  acted_at: string | null
}

/** Historial de lecturas del club (migr. 028) */
export type ClubReading = {
  id: string
  club_id: string
  book_id: string
  /** 'main' = lectura del mes; 'bis' = la extra cuando el club va sobrado */
  kind: 'main' | 'bis'
  proposed_by: string | null
  started_at: string
  closed_at: string | null
  /** cuándo se abrieron las reseñas del club (migr. 029) */
  premiered_at: string | null
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
  | 'reaction'
  | 'new_idea'
  | 'captain'
  | 'next_book'
  | 'recommendation'
  | 'mention'
  | 'mention_wait'
  /** te han respondido desde más adelante, bajo juramento (migr. 037) */
  | 'reply_sworn'
  /** todo el club tiene ya el libro de la próxima lectura (migr. 038) */
  | 'all_ready'

/** Dispositivo suscrito a Web Push (migr. 023) */
export type PushSubscriptionRow = {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  created_at: string
}

/** Preferencias del centro de avisos (migr. 018 y 024) */
export type NotificationPrefsRow = {
  user_id: string
  reply: boolean
  follow: boolean
  poll: boolean
  unlock: boolean
  book_done: boolean
  reaction: boolean
  new_idea: boolean
  /** relevo de capitanía (migr. 029) */
  captain: boolean
  /** próxima lectura elegida (migr. 030) */
  next_book: boolean
  /** alguien te recomienda un libro (migr. 034) */
  recommendation: boolean
  /** te mencionan en una idea o respuesta (migr. 035) */
  mention: boolean
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
  /** capítulo al que se refiere el aviso, si viene a cuento (migr. 036) */
  chapter_number: number | null
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
  /** su autor juró que no destripa nada por delante del hilo (migr. 037) */
  sworn_safe: boolean
}

/** nota de desarrollo dejada por un probador (migr. 038) */
export type DevNote = {
  id: string
  author_id: string
  kind: 'fallo' | 'idea' | 'texto'
  body: string
  /** la pantalla desde la que se escribió, sin la cual no hay quien lo sitúe */
  path: string | null
  status: 'open' | 'doing' | 'done' | 'wontfix'
  reply: string | null
  created_at: string
  resolved_at: string | null
}

/** «ya lo tengo»: quien tiene ya el libro de la próxima lectura (migr. 038) */
export type BookReady = {
  book_id: string
  user_id: string
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
  /** emblema y afiliados (migr. 032) */
  emblem: string | null
  emblem_color: string | null
  /** imagen del escudo, si la hay (migr. 033) */
  emblem_url: string | null
  affiliate_tag: string | null
  /** próxima lectura ya elegida, aún sin empezar (migr. 030) */
  next_book_id: string | null
  next_starts_at: string | null
  /** política de capitanía (migr. 029) */
  captain_mode: 'manual' | 'random' | 'rotation'
  captain_term: 'time' | 'book'
  captain_term_unit: 'day' | 'month' | 'year'
  captain_term_count: number
  captain_max_days: number | null
  captain_term_ends_at: string | null
  /** código con el que se entra en ESTE club (migr. 038) */
  invite_code: string | null
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
      club_readings: TableDef<ClubReading, 'club_id' | 'book_id', 'id' | 'started_at'>
      recommendations: TableDef<
        Recommendation,
        'from_user' | 'to_user' | 'book_id',
        'id' | 'created_at'
      >
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
      push_subscriptions: TableDef<
        PushSubscriptionRow,
        'endpoint' | 'user_id' | 'p256dh' | 'auth',
        'created_at'
      >
      consents: TableDef<Consent, 'user_id' | 'doc' | 'doc_version', 'accepted_at'>
      reports: TableDef<
        Report,
        'target_type' | 'target_id' | 'reason',
        'id' | 'created_at' | 'status' | 'resolved_at' | 'resolution_note'
      >
      app_settings: TableDef<AppSetting, 'key' | 'value', 'updated_at'>
      blocks: TableDef<Block, 'blocker_id' | 'blocked_id', 'created_at'>
      dev_notes: TableDef<
        DevNote,
        'author_id' | 'body',
        'id' | 'created_at'
      >
      book_ready: TableDef<BookReady, 'book_id' | 'user_id', 'created_at'>
    }
    Views: {
      /** cuánta gente ha votado ya en cada votación (migr. 031) */
      poll_progress: {
        Row: {
          poll_id: string
          club_id: string
          title: string
          status: string
          closes_at: string | null
          miembros: number
          votos: number
        }
        Relationships: []
      }
      /** resumen del club para la tira de pertenencia (migr. 030) */
      club_summary: {
        Row: {
          club_id: string
          name: string
          created_at: string
          miembros: number
          libros_leidos: number
        }
        Relationships: []
      }
      /** estadísticas por miembro, base de las insignias (migr. 030) */
      club_member_stats: {
        Row: {
          club_id: string
          user_id: string
          joined_at: string
          role: string
          last_captain_at: string | null
          orden_llegada: number
          libros_terminados: number
          veces_primero: number
          libros_propuestos: number
          ideas: number
          resenas: number
          respuestas: number
          reacciones: number
          votaciones: number
          libros_en_estanteria: number
          perfil_completo: boolean
          en_la_app_desde: string
        }
        Relationships: []
      }
      /** hoja de capitanía (migr. 028) */
      club_captain_record: {
        Row: {
          club_id: string
          user_id: string
          libros: number
          bises: number
          media_estrellas: number | null
          lecturas_terminadas: number
        }
        Relationships: []
      }
      /** reseñas: review=null hasta que TERMINAS el libro (o es tuya) */
      book_reviews: {
        Row: {
          book_id: string
          user_id: string
          rating: number
          /** dimensiones (migr. 028): no son spoiler, se leen siempre */
          d_think: number | null
          d_flow: number | null
          d_feel: number | null
          d_recommend: number | null
          created_at: string
          has_review: boolean
          /** false = el club aún no ha estrenado las reseñas (migr. 029) */
          premiered: boolean
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
          /** su autor juró que no hay spoiler (migr. 037) */
          sworn_safe: boolean
          /** cerrada, pero jurada: puedes abrirla tú (migr. 037) */
          can_reveal: boolean
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
          /** probador: puede dejar notas de desarrollo (migr. 038) */
          beta_tester: boolean
          /** permiso pendiente de gastar para fundar un club (migr. 038) */
          can_create_club: boolean
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
      rate_book: {
        Args: {
          p_book: string
          p_rating: number
          p_review?: string | null
          p_think?: number | null
          p_flow?: number | null
          p_feel?: number | null
          p_recommend?: number | null
        }
        Returns: {
          rating: number
          review: string | null
          d_think: number | null
          d_flow: number | null
          d_feel: number | null
          d_recommend: number | null
        }[]
      }
      close_club_reading: { Args: Record<string, never>; Returns: undefined }
      premiere_reviews: { Args: Record<string, never>; Returns: undefined }
      start_next_reading: { Args: Record<string, never>; Returns: string }
      finish_and_start_next: { Args: Record<string, never>; Returns: string | null }
      close_poll_if_due: { Args: Record<string, never>; Returns: string | null }
      mark_club_seen: { Args: Record<string, never>; Returns: undefined }
      mark_seen: {
        Args: { p_kind?: 'all' | 'ideas' | 'replies' | 'reactions' | 'ahead' }
        Returns: undefined
      }
      club_news: { Args: Record<string, never>; Returns: Record<string, unknown> }
      recommend_book: {
        Args: { p_book: string; p_to: string; p_note?: string | null }
        Returns: string
      }
      reading_affinity: { Args: { p_user: string }; Returns: Record<string, unknown> }
      mentionables: {
        Args: Record<string, never>
        Returns: {
          id: string
          username: string
          display_name: string
          avatar_url: string | null
        }[]
      }
      pending_mentions: {
        Args: Record<string, never>
        Returns: {
          book_id: string
          book_title: string
          chapter_number: number
          my_chapter: number
          total_chapters: number
          cuantas: number
          quien: string | null
        }[]
      }
      /* ---------- migr. 037: la respuesta jurada ---------- */
      reveal_comment: { Args: { p_comment: string }; Returns: string }
      quien_espera: {
        Args: { p_discussion: string }
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string | null
          chapter: number
        }[]
      }
      record_jurado: {
        Args: { p_user: string }
        Returns: { jurados: number; fallos: number }[]
      }
      /* ---------- migr. 038: probadores, clubes y «ya lo tengo» ---------- */
      is_beta: { Args: Record<string, never>; Returns: boolean }
      admin_set_flag: {
        Args: { target: string; flag: 'beta_tester' | 'can_create_club'; value: boolean }
        Returns: undefined
      }
      create_club: {
        Args: { p_name: string; p_description?: string | null }
        Returns: string
      }
      join_club: { Args: { p_code: string }; Returns: string }
      my_club: { Args: Record<string, never>; Returns: Club[] }
      club_invite_code: { Args: Record<string, never>; Returns: string | null }
      club_ready: {
        Args: { p_book: string }
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string | null
          listo: boolean
          soy_yo: boolean
        }[]
      }
      club_activity: {
        Args: Record<string, never>
        Returns: {
          ideas_nuevas: number
          respuestas_nuevas: number
          reacciones_nuevas: number
          adelantos: { name: string; chapter: number }[]
          desde: string
        }[]
      }
      set_next_book: {
        Args: { p_book: string | null; p_starts_at?: string | null }
        Returns: undefined
      }
      rotate_captain_if_due: { Args: Record<string, never>; Returns: string | null }
      set_captain: { Args: { p_user: string }; Returns: undefined }
      next_captain_id: { Args: { p_club: string }; Returns: string | null }
      set_captain_policy: {
        Args: {
          p_mode: 'manual' | 'random' | 'rotation'
          p_term: 'time' | 'book'
          p_unit?: 'day' | 'month' | 'year'
          p_count?: number
          p_max_days?: number | null
        }
        Returns: undefined
      }
      start_club_bis: { Args: { p_book: string }; Returns: string }
      create_poll_with_books: {
        Args: { p_title: string; p_books: unknown; p_closes_at?: string | null }
        Returns: string
      }
      set_book_chapters: {
        Args: { p_book: string; p_total: number }
        Returns: number
      }
      add_book_smart: {
        Args: {
          p_title: string
          p_author: string
          p_isbn?: string | null
          p_cover_url?: string | null
          p_cover_source?: string | null
          p_synopsis?: string | null
          p_synopsis_source?: string | null
          p_buy_url?: string | null
          p_total_chapters?: number | null
          p_chapter_labels?: string[] | null
          p_status?: 'want' | 'reading' | null
        }
        Returns: { book_id: string; created: boolean }[]
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
