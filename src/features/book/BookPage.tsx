import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import BookView from './BookView'
import type { BookViewData } from './bookTypes'

export default function BookPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<BookViewData | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data: club } = await supabase
      .from('clubs')
      .select('current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    const bookId = club?.current_book_id
    if (!bookId) {
      setData(null)
      return
    }

    const [{ data: book }, { data: progress }, { data: chapters }] =
      await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
        supabase
          .from('reading_progress')
          .select('current_chapter')
          .eq('user_id', session.user.id)
          .eq('book_id', bookId)
          .maybeSingle(),
        supabase
          .from('chapters')
          .select('number, label')
          .eq('book_id', bookId)
          .order('number'),
      ])
    if (!book) {
      setData(null)
      return
    }

    const current = progress?.current_chapter ?? 0

    // Recuento de conversaciones por capítulo (RLS solo devuelve las visibles).
    const { data: discussions } = await supabase
      .from('discussions')
      .select('chapter_number')
      .eq('book_id', bookId)
    const counts = new Map<number, number>()
    for (const d of discussions ?? [])
      counts.set(d.chapter_number, (counts.get(d.chapter_number) ?? 0) + 1)

    setData({
      bookId,
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
      currentChapter: current,
      totalChapters: book.total_chapters,
      currentLabel:
        (chapters ?? []).find((c) => c.number === current)?.label ?? null,
      chapters: (chapters ?? []).map((c) => ({
        number: c.number,
        label: c.label,
        unlocked: c.number <= current,
        commentCount: counts.get(c.number) ?? 0,
        isCurrent: c.number === current,
      })),
    })
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  const setChapter = async (n: number) => {
    if (!session || !data) return
    if (n < data.currentChapter) {
      const ok = window.confirm(
        'Si retrocedes, volverás a bloquear las conversaciones de los capítulos por encima de tu nuevo punto. ¿Continuar?',
      )
      if (!ok) return
    }
    setBusy(true)
    const { error } = await supabase.from('reading_progress').upsert({
      user_id: session.user.id,
      book_id: data.bookId,
      current_chapter: n,
    })
    if (!error) await load()
    setBusy(false)
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return (
    <BookView
      data={data}
      busy={busy}
      onSetChapter={setChapter}
      onOpenChapter={(n) => navigate(`/chapter/${n}`)}
    />
  )
}
