import { useCallback, useEffect, useState } from 'react'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { useCompose } from '../../components/ComposeProvider'
import HomeView from './HomeView'
import type { FeedItem, HomeData, HomeReading } from './homeTypes'

export default function FeedPage() {
  const { session, profile } = useAuth()
  const { version } = useCompose()
  const [data, setData] = useState<HomeData | null>(null)

  const load = useCallback(async () => {
    if (!session || !profile) return

    const { data: club } = await supabase
      .from('clubs')
      .select('current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    const bookId = club?.current_book_id ?? null

    let reading: HomeReading | null = null
    let feed: FeedItem[] = []

    if (bookId) {
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

      const labelByNumber = new Map(
        (chapters ?? []).map((c) => [c.number, c.label]),
      )

      if (book) {
        const current = progress?.current_chapter ?? 0
        reading = {
          bookId,
          title: book.title,
          author: book.author,
          coverUrl: book.cover_url,
          chapterNumber: current,
          chapterLabel: labelByNumber.get(current) ?? null,
          totalChapters: book.total_chapters,
          percent: Math.round((current / book.total_chapters) * 100),
        }
      }

      // Feed: discusiones visibles (RLS filtra por progreso), recientes primero.
      const { data: discussions } = await supabase
        .from('discussions')
        .select('id, author_id, chapter_number, kind, body, club_id, created_at')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
        .limit(30)

      const list = discussions ?? []
      if (list.length > 0) {
        const authorIds = [...new Set(list.map((d) => d.author_id))]
        const { data: authors } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', authorIds)
        const nameById = new Map(
          (authors ?? []).map((a) => [a.id, a.display_name]),
        )

        const { data: comments } = await supabase
          .from('discussion_comments')
          .select('discussion_id')
          .in(
            'discussion_id',
            list.map((d) => d.id),
          )
        const countById = new Map<string, number>()
        for (const c of comments ?? [])
          countById.set(
            c.discussion_id,
            (countById.get(c.discussion_id) ?? 0) + 1,
          )

        feed = list.map((d) => ({
          id: d.id,
          authorId: d.author_id,
          authorName: nameById.get(d.author_id) ?? '·',
          chapterNumber: d.chapter_number,
          chapterLabel: labelByNumber.get(d.chapter_number) ?? null,
          kind: d.kind,
          body: d.body,
          isClub: d.club_id != null,
          createdAt: new Date(d.created_at).toLocaleDateString(),
          commentCount: countById.get(d.id) ?? 0,
        }))
      }
    }

    setData({ displayName: profile.display_name, reading, feed })
  }, [session, profile])

  useEffect(() => {
    void load()
  }, [load, version])

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return <HomeView data={data} />
}
