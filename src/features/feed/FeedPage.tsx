import { useEffect, useState } from 'react'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import HomeView from './HomeView'
import type {
  HomeConversation,
  HomeData,
  HomeDiscover,
  HomeReading,
} from './homeTypes'

export default function FeedPage() {
  const { session, profile } = useAuth()
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    if (!session || !profile) return
    let cancelled = false

    async function load() {
      const displayName = profile!.display_name

      // Libro del club actual
      const { data: club } = await supabase
        .from('clubs')
        .select('current_book_id')
        .order('created_at')
        .limit(1)
        .maybeSingle()

      let reading: HomeReading | null = null
      const conversations: HomeConversation[] = []

      const bookId = club?.current_book_id ?? null
      if (bookId) {
        const [{ data: book }, { data: progress }] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
          supabase
            .from('reading_progress')
            .select('current_chapter')
            .eq('user_id', session!.user.id)
            .eq('book_id', bookId)
            .maybeSingle(),
        ])

        if (book) {
          const current = progress?.current_chapter ?? 0
          let chapterLabel: string | null = null
          if (current > 0) {
            const { data: ch } = await supabase
              .from('chapters')
              .select('label')
              .eq('book_id', bookId)
              .eq('number', current)
              .maybeSingle()
            chapterLabel = ch?.label ?? null
          }
          reading = {
            bookId,
            title: book.title,
            author: book.author,
            coverUrl: book.cover_url,
            chapterNumber: current,
            chapterLabel,
            totalChapters: book.total_chapters,
            percent: Math.round((current / book.total_chapters) * 100),
          }

          // Conversaciones visibles (el spoiler gate las filtra en servidor)
          const { data: discussions } = await supabase
            .from('discussions')
            .select('id, chapter_number, author_id')
            .eq('book_id', bookId)
            .order('created_at', { ascending: false })
            .limit(40)

          if (discussions && discussions.length > 0) {
            const authorIds = [...new Set(discussions.map((d) => d.author_id))]
            const { data: authors } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', authorIds)
            const nameById = new Map(
              (authors ?? []).map((a) => [a.id, a.display_name]),
            )
            const maxCh = Math.max(...discussions.map((d) => d.chapter_number))
            conversations.push({
              id: bookId,
              bookTitle: book.title,
              author: book.author,
              coverUrl: book.cover_url,
              range: `Hasta el capítulo ${maxCh}`,
              commentCount: discussions.length,
              avatars: authorIds
                .slice(0, 3)
                .map((id) => nameById.get(id) ?? '·'),
              extra: Math.max(0, authorIds.length - 3),
            })
          }
        }
      }

      // Descubre: propuestas de la votación abierta
      const { data: pollOptions } = await supabase
        .from('poll_options')
        .select('id, book_title, book_author')
        .limit(8)
      const discover: HomeDiscover[] = (pollOptions ?? []).map((o) => ({
        id: o.id,
        title: o.book_title,
        author: o.book_author,
      }))

      // Stats
      const { count: finished } = await supabase
        .from('reading_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session!.user.id)
        .eq('status', 'finished')

      if (!cancelled) {
        setData({
          displayName,
          reading,
          stats: { streakDays: 0, booksThisYear: finished ?? 0 },
          conversations,
          discover,
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session, profile])

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return <HomeView data={data} />
}
