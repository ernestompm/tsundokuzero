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
  const [version, setVersion] = useState(0)

  const openCompose = useCallback(async () => {
    if (!session) return
    setOpen(true)
    const { data: club } = await supabase
      .from('clubs')
      .select('id, current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!club?.current_book_id) {
      setAnchor(null)
      return
    }
    const { data: progress } = await supabase
      .from('reading_progress')
      .select('current_chapter')
      .eq('user_id', session.user.id)
      .eq('book_id', club.current_book_id)
      .maybeSingle()
    const current = progress?.current_chapter ?? 0
    let label: string | null = null
    if (current > 0) {
      const { data: ch } = await supabase
        .from('chapters')
        .select('label')
        .eq('book_id', club.current_book_id)
        .eq('number', current)
        .maybeSingle()
      label = ch?.label ?? null
    }
    setAnchor({
      bookId: club.current_book_id,
      clubId: club.id,
      chapterNumber: current,
      chapterLabel: label,
    })
  }, [session])

  const publish = async (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
  ) => {
    if (!session || !anchor) return
    setSubmitting(true)
    const { error } = await supabase.from('discussions').insert({
      book_id: anchor.bookId,
      chapter_number: anchor.chapterNumber,
      author_id: session.user.id,
      kind,
      body,
      club_id: toClub ? anchor.clubId : null,
    })
    setSubmitting(false)
    if (!error) {
      setOpen(false)
      setVersion((v) => v + 1)
    }
  }

  return (
    <Ctx.Provider value={{ openCompose, version }}>
      {children}
      <ComposeSheet
        open={open}
        chapterNumber={anchor?.chapterNumber ?? 0}
        chapterLabel={anchor?.chapterLabel ?? null}
        canWrite={(anchor?.chapterNumber ?? 0) > 0}
        submitting={submitting}
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
