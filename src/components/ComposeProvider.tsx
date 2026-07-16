import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../auth/AuthContext'
import type { DiscussionKind } from '../lib/database.types'
import ComposeSheet, { type ComposeTarget } from './ComposeSheet'

interface ComposeCtx {
  openCompose: () => void
  version: number
}

const Ctx = createContext<ComposeCtx | null>(null)

export function ComposeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<ComposeTarget[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const openCompose = useCallback(async () => {
    if (!session) return
    setOpen(true)
    setError(null)
    setTargets([])

    // Libros que estás leyendo (capítulo >= 1) = destinos posibles del anclaje.
    const { data: progress } = await supabase
      .from('reading_progress')
      .select('book_id, current_chapter')
      .eq('user_id', session.user.id)
      .gte('current_chapter', 1)
      .order('updated_at', { ascending: false })
    const rows = progress ?? []
    if (rows.length === 0) {
      setTargets([])
      return
    }
    const bookIds = rows.map((r) => r.book_id)
    const [{ data: books }, { data: clubs }, { data: chapters }] =
      await Promise.all([
        supabase.from('books').select('id, title').in('id', bookIds),
        supabase.from('clubs').select('id, current_book_id').in('current_book_id', bookIds),
        supabase.from('chapters').select('book_id, number, label').in('book_id', bookIds),
      ])
    const titleById = new Map((books ?? []).map((b) => [b.id, b.title]))
    const clubByBook = new Map((clubs ?? []).map((c) => [c.current_book_id, c.id]))
    const labelByKey = new Map(
      (chapters ?? []).map((c) => [`${c.book_id}/${c.number}`, c.label]),
    )
    setTargets(
      rows.map((r) => ({
        bookId: r.book_id,
        bookTitle: titleById.get(r.book_id) ?? '',
        chapterNumber: r.current_chapter,
        chapterLabel: labelByKey.get(`${r.book_id}/${r.current_chapter}`) ?? null,
        clubId: clubByBook.get(r.book_id) ?? null,
      })),
    )
  }, [session])

  const publish = async (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
    target: ComposeTarget | null,
  ) => {
    if (!session) return
    setSubmitting(true)
    setError(null)
    let err
    if (target) {
      // Idea anclada a un libro/capítulo
      const { error } = await supabase.from('discussions').insert({
        book_id: target.bookId,
        chapter_number: target.chapterNumber,
        author_id: session.user.id,
        kind,
        body,
        club_id: toClub ? target.clubId : null,
      })
      err = error
    } else {
      // Entrada general → muro
      const { error } = await supabase.from('posts').insert({
        author_id: session.user.id,
        body,
        visibility: 'followers',
      })
      err = error
    }
    setSubmitting(false)
    if (err) {
      setError(friendlyError(err, 'No se pudo publicar. Inténtalo de nuevo.'))
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
        targets={targets}
        submitting={submitting}
        error={error}
        resetToken={version}
        onPublish={publish}
        onClose={() => setOpen(false)}
        onGoToBook={() => {
          setOpen(false)
          navigate('/library')
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
