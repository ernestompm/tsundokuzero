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
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session || !bookId) return

    const [{ data: book }, { data: progress }, { data: chapters }, { data: ratings }] =
      await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
        supabase
          .from('reading_progress')
          .select('current_chapter, status')
          .eq('user_id', session.user.id)
          .eq('book_id', bookId)
          .maybeSingle(),
        // Títulos = índice del libro físico: visibles siempre.
        supabase
          .from('chapters')
          .select('number, label')
          .eq('book_id', bookId)
          .order('number'),
        // Vista enmascarada: `review` llega null si no has terminado el libro
        supabase
          .from('book_reviews')
          .select('user_id, rating, review, has_review')
          .eq('book_id', bookId),
      ])
    if (!book) {
      setMissing(true)
      setData(null)
      return
    }
    setMissing(false)

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

    const ratingRows = ratings ?? []
    const avg =
      ratingRows.length > 0
        ? ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length
        : null
    const mine = ratingRows.find((r) => r.user_id === session.user.id)

    // Reseñas de otros: texto solo si la vista te lo dejó ver (terminaste).
    const others = ratingRows.filter((r) => r.user_id !== session.user.id)
    const visibleReviews = others.filter((r) => r.review)
    const hiddenReviews = others.filter(
      (r) => r.has_review && !r.review,
    ).length

    const { data: reviewers } = visibleReviews.length
      ? await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', visibleReviews.map((r) => r.user_id))
      : { data: [] }
    const nameById = new Map((reviewers ?? []).map((p) => [p.id, p.display_name]))

    setData({
      bookId,
      title: book.title,
      author: book.author,
      authorId: book.author_id,
      coverUrl: book.cover_url,
      synopsis: book.synopsis,
      buyUrl: book.buy_url,
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
      avgRating: avg,
      ratingCount: ratingRows.length,
      myRating: mine?.rating ?? null,
      myReview: mine?.review ?? null,
      canRate: progress?.status === 'finished',
      status: progress?.status ?? null,
      reviews: visibleReviews.map((r) => ({
        name: nameById.get(r.user_id) ?? 'Lector',
        rating: r.rating,
        review: r.review as string,
      })),
      hiddenReviews,
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

  if (missing) {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">Este libro ya no está en la estantería.</p>
        <p className="body-medium on-surface-variant">
          Puede que lo hayan retirado. Vuelve al inicio y sigue leyendo.
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const rate = async (n: number, review: string | null) => {
    if (!session || !data) return
    setBusy(true)
    await supabase.from('book_ratings').upsert(
      {
        book_id: data.bookId,
        user_id: session.user.id,
        rating: n,
        review: review ?? data.myReview,
      },
      { onConflict: 'book_id,user_id' },
    )
    await load()
    setBusy(false)
  }

  const addToShelf = async (status: 'want' | 'reading') => {
    if (!session || !data) return
    setBusy(true)
    await supabase.from('reading_progress').upsert(
      {
        user_id: session.user.id,
        book_id: data.bookId,
        status,
        current_chapter: status === 'reading' ? Math.max(1, data.currentChapter) : 0,
      },
      { onConflict: 'user_id,book_id' },
    )
    await load()
    setBusy(false)
  }

  return (
    <BookView
      data={data}
      busy={busy}
      onSetChapter={setChapter}
      onOpenChapter={(n) => navigate(`/book/${data.bookId}/chapter/${n}`)}
      onRate={rate}
      onAddToShelf={addToShelf}
    />
  )
}
