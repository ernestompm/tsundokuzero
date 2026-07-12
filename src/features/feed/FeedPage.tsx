import { useCallback, useEffect, useState } from 'react'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { useCompose } from '../../components/ComposeProvider'
import { timeAgo } from '../../lib/time'
import HomeView from './HomeView'
import type {
  BookConvo,
  FeedItem,
  HomeData,
  HomeReading,
} from './homeTypes'

export default function FeedPage() {
  const { session, profile } = useAuth()
  const { version } = useCompose()
  const [data, setData] = useState<HomeData | null>(null)

  const load = useCallback(async () => {
    if (!session || !profile) return
    const myId = session.user.id

    // ---- Lectura más reciente + stats personales + descubre (en paralelo) ----
    const [
      { data: prog },
      { count: myIdeas },
      { count: myReplies },
      { count: finished },
      { data: pollOptions },
      { data: discussions },
      { data: openPoll },
    ] = await Promise.all([
      supabase
        .from('reading_progress')
        .select('book_id, current_chapter, updated_at')
        .eq('user_id', myId)
        .eq('status', 'reading')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('discussions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', myId),
      supabase
        .from('discussion_comments')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', myId),
      supabase
        .from('reading_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', myId)
        .eq('status', 'finished'),
      supabase.from('poll_options').select('id, book_title, book_author').limit(8),
      // Feed global: TODOS los libros (el gate RLS filtra por libro)
      supabase
        .from('discussions')
        .select('id, author_id, book_id, chapter_number, kind, body, club_id, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('polls')
        .select('id, title')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle(),
    ])

    // ---- Lectura actual ----
    let reading: HomeReading | null = null
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

    // ---- Feed + conversaciones por libro ----
    let feed: FeedItem[] = []
    const conversations: BookConvo[] = []
    const list = discussions ?? []

    if (list.length > 0) {
      const authorIds = [...new Set(list.map((d) => d.author_id))]
      const bookIds = [...new Set(list.map((d) => d.book_id))]

      const [{ data: authors }, { data: books }, { data: chapters }, { data: comments }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', authorIds),
          supabase
            .from('books')
            .select('id, title, author, cover_url')
            .in('id', bookIds),
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
      const usernameById = new Map((authors ?? []).map((a) => [a.id, a.username]))
      const bookById = new Map((books ?? []).map((b) => [b.id, b]))
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
        authorUsername: usernameById.get(d.author_id),
        bookId: d.book_id,
        bookTitle: bookById.get(d.book_id)?.title ?? '',
        chapterNumber: d.chapter_number,
        chapterLabel: labelByKey.get(`${d.book_id}/${d.chapter_number}`) ?? null,
        kind: d.kind,
        body: d.body,
        isClub: d.club_id != null,
        createdAt: timeAgo(d.created_at),
        commentCount: countById.get(d.id) ?? 0,
      }))

      // Agrupar por libro para «Conversaciones activas»
      const byBook = new Map<string, typeof list>()
      for (const d of list) {
        const arr = byBook.get(d.book_id) ?? []
        arr.push(d)
        byBook.set(d.book_id, arr)
      }
      for (const [bookId, items] of byBook) {
        const book = bookById.get(bookId)
        if (!book) continue
        const names = [
          ...new Set(items.map((d) => nameById.get(d.author_id) ?? '·')),
        ]
        conversations.push({
          bookId,
          bookTitle: book.title,
          author: book.author,
          coverUrl: book.cover_url,
          upTo: Math.max(...items.map((d) => d.chapter_number)),
          count: items.length,
          avatars: names.slice(0, 3),
          extra: Math.max(0, names.length - 3),
        })
      }
      conversations.sort((a, b) => b.count - a.count)
    }

    setData({
      displayName: profile.display_name,
      myId,
      reading,
      stats: {
        ideas: myIdeas ?? 0,
        replies: myReplies ?? 0,
        finished: finished ?? 0,
      },
      conversations: conversations.slice(0, 6),
      discover: (pollOptions ?? []).map((o) => ({
        id: o.id,
        title: o.book_title,
        author: o.book_author,
      })),
      feed,
      openPoll: openPoll ?? null,
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
