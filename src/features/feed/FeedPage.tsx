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

    // ---- Lote 1: lectura, stats, seguidos, poll, descubre ----
    const [
      { data: prog },
      { count: myIdeas },
      { count: myReplies },
      { count: finished },
      { data: pollOptions },
      { data: myFollows },
      { data: openPoll },
    ] = await Promise.all([
      supabase
        .from('reading_progress')
        .select('book_id, current_chapter, updated_at')
        .eq('user_id', myId)
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
      supabase.from('follows').select('followed_id').eq('follower_id', myId),
      supabase
        .from('polls')
        .select('id, title')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle(),
    ])

    // Feed social = yo + gente a la que sigo, más todo lo del club.
    const authorSet = [myId, ...(myFollows ?? []).map((f) => f.followed_id)]
    const authorsCsv = authorSet.join(',')
    const feedFilter = `author_id.in.(${authorsCsv}),club_id.not.is.null`

    // ---- Lote 2: discusiones (vista con teaser) + posts ----
    const [{ data: discussions }, { data: posts }] = await Promise.all([
      supabase
        .from('feed_discussions')
        .select('id, author_id, book_id, chapter_number, kind, body, club_id, created_at, unlocked')
        .or(feedFilter)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('posts')
        .select('id, author_id, title, body, club_id, created_at')
        .or(feedFilter)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    // Respuestas ligadas a cada publicación (vista con teaser)
    const discIds = (discussions ?? []).map((d) => d.id)
    const { data: replyRows } = discIds.length
      ? await supabase
          .from('thread_comments')
          .select('id, discussion_id, author_id, body, created_at, author_chapter, unlocked')
          .in('discussion_id', discIds)
          .order('created_at', { ascending: false })
          .limit(120)
      : { data: [] }

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

    // ---- Mezclar feed + conversaciones por libro ----
    const discList = discussions ?? []
    const postList = posts ?? []
    const conversations: BookConvo[] = []
    let feed: FeedItem[] = []

    const replies = replyRows ?? []
    const authorIds = [
      ...new Set([
        ...discList.map((d) => d.author_id),
        ...postList.map((p) => p.author_id),
        ...replies.map((r) => r.author_id),
      ]),
    ]
    const bookIds = [...new Set(discList.map((d) => d.book_id))]

    if (authorIds.length > 0) {
      const [{ data: authors }, { data: books }, { data: chapters }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', authorIds),
          bookIds.length
            ? supabase
                .from('books')
                .select('id, title, author, cover_url')
                .in('id', bookIds)
            : Promise.resolve({ data: [] }),
          bookIds.length
            ? supabase
                .from('chapters')
                .select('book_id, number, label')
                .in('book_id', bookIds)
            : Promise.resolve({ data: [] }),
        ])

      const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]))
      const usernameById = new Map((authors ?? []).map((a) => [a.id, a.username]))
      const bookById = new Map((books ?? []).map((b) => [b.id, b]))
      const labelByKey = new Map(
        (chapters ?? []).map((c) => [`${c.book_id}/${c.number}`, c.label]),
      )
      const countById = new Map<string, number>()
      const repliesById = new Map<string, typeof replies>()
      for (const r of replies) {
        countById.set(r.discussion_id, (countById.get(r.discussion_id) ?? 0) + 1)
        const arr = repliesById.get(r.discussion_id) ?? []
        arr.push(r)
        repliesById.set(r.discussion_id, arr)
      }

      const ideaItems = discList.map((d) => ({
        ts: d.created_at,
        item: {
          id: d.id,
          type: 'idea',
          authorId: d.author_id,
          authorName: nameById.get(d.author_id) ?? '·',
          authorUsername: usernameById.get(d.author_id),
          bookId: d.book_id,
          bookTitle: bookById.get(d.book_id)?.title ?? '',
          chapterNumber: d.chapter_number,
          chapterLabel: labelByKey.get(`${d.book_id}/${d.chapter_number}`) ?? null,
          kind: d.kind,
          body: d.unlocked ? d.body : null,
          isClub: d.club_id != null,
          createdAt: timeAgo(d.created_at),
          commentCount: countById.get(d.id) ?? 0,
          // últimas 2, en orden cronológico, colgando de la publicación
          replies: (repliesById.get(d.id) ?? [])
            .slice(0, 2)
            .reverse()
            .map((r) => ({
              id: r.id,
              authorId: r.author_id,
              authorName: nameById.get(r.author_id) ?? '·',
              authorUsername: usernameById.get(r.author_id),
              body: r.unlocked ? r.body : null,
              unlockChapter: r.author_chapter,
              createdAt: timeAgo(r.created_at),
            })),
        } satisfies FeedItem,
      }))

      const postItems = postList.map((p) => ({
        ts: p.created_at,
        item: {
          id: p.id,
          type: 'post',
          authorId: p.author_id,
          authorName: nameById.get(p.author_id) ?? '·',
          authorUsername: usernameById.get(p.author_id),
          kind: null,
          postTitle: p.title,
          body: p.body,
          isClub: p.club_id != null,
          createdAt: timeAgo(p.created_at),
          commentCount: 0,
          replies: [],
        } satisfies FeedItem,
      }))

      feed = [...ideaItems, ...postItems]
        .sort((a, b) => (a.ts < b.ts ? 1 : -1))
        .slice(0, 40)
        .map((x) => x.item)

      // Conversaciones activas agrupadas por libro
      const byBook = new Map<string, typeof discList>()
      for (const d of discList) {
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

  const deleteItem = async (id: string, type: 'idea' | 'post') => {
    await supabase
      .from(type === 'idea' ? 'discussions' : 'posts')
      .delete()
      .eq('id', id)
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
