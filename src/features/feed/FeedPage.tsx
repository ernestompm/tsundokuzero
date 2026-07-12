import { useCallback, useEffect, useState } from 'react'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { useCompose } from '../../components/ComposeProvider'
import { timeAgo } from '../../lib/time'
import HomeView from './HomeView'
import type { FeedItem, HomeData, HomeReading } from './homeTypes'

export default function FeedPage() {
  const { session, profile } = useAuth()
  const { version } = useCompose()
  const [data, setData] = useState<HomeData | null>(null)

  const load = useCallback(async () => {
    if (!session || !profile) return

    // ---- Tu lectura más reciente (para la barra de progreso) ----
    let reading: HomeReading | null = null
    const { data: prog } = await supabase
      .from('reading_progress')
      .select('book_id, current_chapter, updated_at')
      .eq('user_id', session.user.id)
      .eq('status', 'reading')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prog) {
      const [{ data: book }, { data: ch }] = await Promise.all([
        supabase.from('books').select('*').eq('id', prog.book_id).maybeSingle(),
        prog.current_chapter > 0
          ? supabase
              .from('chapters')
              .select('label')
              .eq('book_id', prog.book_id)
              .eq('number', prog.current_chapter)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (book) {
        reading = {
          bookId: book.id,
          title: book.title,
          author: book.author,
          coverUrl: book.cover_url,
          chapterNumber: prog.current_chapter,
          chapterLabel: ch?.label ?? null,
          totalChapters: book.total_chapters,
          percent: Math.round(
            (prog.current_chapter / book.total_chapters) * 100,
          ),
        }
      }
    }

    // ---- Feed global: TODOS los libros (el gate RLS filtra por libro) ----
    const { data: discussions } = await supabase
      .from('discussions')
      .select('id, author_id, book_id, chapter_number, kind, body, club_id, created_at')
      .order('created_at', { ascending: false })
      .limit(40)

    let feed: FeedItem[] = []
    const list = discussions ?? []
    if (list.length > 0) {
      const authorIds = [...new Set(list.map((d) => d.author_id))]
      const bookIds = [...new Set(list.map((d) => d.book_id))]

      const [{ data: authors }, { data: books }, { data: chapters }, { data: comments }] =
        await Promise.all([
          supabase.from('profiles').select('id, display_name').in('id', authorIds),
          supabase.from('books').select('id, title').in('id', bookIds),
          supabase
            .from('chapters')
            .select('book_id, number, label')
            .in('book_id', bookIds),
          supabase
            .from('discussion_comments')
            .select('discussion_id')
            .in('discussion_id', list.map((d) => d.id)),
        ])

      const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]))
      const titleById = new Map((books ?? []).map((b) => [b.id, b.title]))
      const labelByKey = new Map(
        (chapters ?? []).map((c) => [`${c.book_id}/${c.number}`, c.label]),
      )
      const countById = new Map<string, number>()
      for (const c of comments ?? [])
        countById.set(c.discussion_id, (countById.get(c.discussion_id) ?? 0) + 1)

      feed = list.map((d) => ({
        id: d.id,
        authorId: d.author_id,
        authorName: nameById.get(d.author_id) ?? '·',
        bookId: d.book_id,
        bookTitle: titleById.get(d.book_id) ?? '',
        chapterNumber: d.chapter_number,
        chapterLabel: labelByKey.get(`${d.book_id}/${d.chapter_number}`) ?? null,
        kind: d.kind,
        body: d.body,
        isClub: d.club_id != null,
        createdAt: timeAgo(d.created_at),
        commentCount: countById.get(d.id) ?? 0,
      }))
    }

    setData({
      displayName: profile.display_name,
      myId: session.user.id,
      reading,
      feed,
    })
  }, [session, profile])

  useEffect(() => {
    void load()
  }, [load, version])

  const deleteItem = async (id: string) => {
    await supabase.from('discussions').delete().eq('id', id)
    await load()
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return <HomeView data={data} onDeleteItem={deleteItem} />
}
