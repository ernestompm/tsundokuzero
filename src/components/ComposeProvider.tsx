import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import type { DiscussionKind } from '../lib/database.types'
import ComposeSheet from './ComposeSheet'

interface Anchor {
  bookId: string
  bookTitle: string
  clubId: string | null
  chapterNumber: number
  chapterLabel: string | null
}

interface ComposeCtx {
  openCompose: () => void
  /** Se incrementa tras cada publicación; las pantallas lo observan para recargar. */
  version: number
}

const Ctx = createContext<ComposeCtx | null>(null)

export function ComposeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const openCompose = useCallback(async () => {
    if (!session) return
    setOpen(true)
    setAnchor(null)
    setError(null)

    // Ancla = tu lectura más reciente (multi-libro). Sin filtrar por
    // status: quien TERMINÓ el libro también puede publicar (cap. final).
    const { data: prog } = await supabase
      .from('reading_progress')
      .select('book_id, current_chapter')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!prog || prog.current_chapter < 1) return

    const [{ data: book }, { data: ch }, { data: club }] = await Promise.all([
      supabase
        .from('books')
        .select('id, title')
        .eq('id', prog.book_id)
        .maybeSingle(),
      supabase
        .from('chapters')
        .select('label')
        .eq('book_id', prog.book_id)
        .eq('number', prog.current_chapter)
        .maybeSingle(),
      supabase
        .from('clubs')
        .select('id')
        .eq('current_book_id', prog.book_id)
        .limit(1)
        .maybeSingle(),
    ])
    if (!book) return

    setAnchor({
      bookId: book.id,
      bookTitle: book.title,
      clubId: club?.id ?? null,
      chapterNumber: prog.current_chapter,
      chapterLabel: ch?.label ?? null,
    })
  }, [session])

  const publish = async (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
  ) => {
    if (!session || !anchor) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('discussions').insert({
      book_id: anchor.bookId,
      chapter_number: anchor.chapterNumber,
      author_id: session.user.id,
      kind,
      body,
      club_id: toClub ? anchor.clubId : null,
    })
    setSubmitting(false)
    if (error) {
      setError(
        'No se pudo publicar. Revisa tu conexión e inténtalo de nuevo. ' +
          `(${error.message})`,
      )
    } else {
      setOpen(false)
      setVersion((v) => v + 1)
    }
  }

  return (
    <Ctx.Provider value={{ openCompose, version }}>
      {children}
      <ComposeSheet
        open={open}
        bookTitle={anchor?.bookTitle ?? null}
        chapterNumber={anchor?.chapterNumber ?? 0}
        chapterLabel={anchor?.chapterLabel ?? null}
        canWrite={(anchor?.chapterNumber ?? 0) > 0}
        clubAvailable={anchor?.clubId != null}
        submitting={submitting}
        error={error}
        onPublish={publish}
        onClose={() => setOpen(false)}
        onGoToBook={() => {
          setOpen(false)
          navigate('/book')
        }}
      />
    </Ctx.Provider>
  )
}

export function useCompose(): ComposeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCompose debe usarse dentro de <ComposeProvider>')
  return ctx
}
