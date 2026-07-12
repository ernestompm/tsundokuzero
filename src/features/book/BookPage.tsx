import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import BookView from './BookView'
import type { BookViewData } from './bookTypes'

export default function BookPage() {
  const { bookId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<BookViewData | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session || !bookId) return

    const [{ data: book }, { data: progress }, { data: chapters }] =
      await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
        supabase
          .from('reading_progress')
          .select('current_chapter')
          .eq('user_id', session.user.id)
          .eq('book_id', bookId)
          .maybeSingle(),
        // La API solo devuelve capítulos <= progreso (RLS): los títulos
        // de capítulos no alcanzados nunca viajan al cliente.
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
    const labelByNumber = new Map(
      (chapters ?? []).map((c) => [c.number, c.label]),
    )

    // Recuento de conversaciones por capítulo (RLS devuelve solo visibles).
    const { data: discussions } = await supabase
      .from('discussions')
      .select('chapter_number')
      .eq('book_id', bookId)
    const counts = new Map<number, number>()
    for (const d of discussions ?? [])
      counts.set(d.chapter_number, (counts.get(d.chapter_number) ?? 0) + 1)

    // Lista completa 1..N sintetizada: los bloqueados no tienen título.
    setData({
      bookId,
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
      currentChapter: current,
      totalChapters: book.total_chapters,
      currentLabel: labelByNumber.get(current) ?? null,
      chapters: Array.from({ length: book.total_chapters }, (_, i) => {
        const number = i + 1
        return {
          number,
          label: labelByNumber.get(number) ?? null,
          unlocked: number <= current,
          commentCount: counts.get(number) ?? 0,
          isCurrent: number === current,
        }
      }),
    })
  }, [session, bookId])

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
      // Al llegar al último capítulo el libro pasa a «Leídos» solo.
      status: n >= data.totalChapters ? 'finished' : 'reading',
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
      onOpenChapter={(n) => navigate(`/book/${data.bookId}/chapter/${n}`)}
    />
  )
}
