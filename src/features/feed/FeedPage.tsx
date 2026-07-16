import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { useCompose } from '../../components/ComposeProvider'
import { timeAgo } from '../../lib/time'
import HomeView, { HomeSkeleton } from './HomeView'
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

    // ---- Lote 1: lecturas, stats, seguidos, poll, descubre ----
    const [
      { data: progRows },
      { count: myIdeas },
      { count: myReplies },
      { data: pollOptions },
      { data: myFollows },
      { data: openPoll },
    ] = await Promise.all([
      supabase
        .from('reading_progress')
        .select('book_id, current_chapter, status, updated_at')
        .eq('user_id', myId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('discussions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', myId),
      supabase
        .from('discussion_comments')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', myId),
      supabase.from('poll_options').select('id, book_title, book_author').limit(8),
      supabase.from('follows').select('followed_id').eq('follower_id', myId),
      supabase
        .from('polls')
        .select('id, title')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle(),
    ])

    // Estanterías: en curso (para tarjetas y filtro) y terminados (filtro)
    const progressList = progRows ?? []
    const readingRows = progressList.filter((p) => p.status === 'reading')
    const finishedBookIds = progressList
      .filter((p) => p.status === 'finished')
      .map((p) => p.book_id)

    // Feed social = yo + gente a la que sigo, más todo lo del club.
    const authorSet = [myId, ...(myFollows ?? []).map((f) => f.followed_id)]
    const authorsCsv = authorSet.join(',')
    const feedFilter = `author_id.in.(${authorsCsv}),club_id.not.is.null`

    // ---- Lote 2: ideas + posts + respuestas (mías y de mis seguidos) ----
    const [{ data: discussions }, { data: posts }, { data: myReplyRows }] =
      await Promise.all([
        supabase
          .from('feed_discussions')
          .select('id, author_id, book_id, chapter_number, kind, body, club_id, created_at, unlocked')
          .or(feedFilter)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('posts')
          .select('id, author_id, title, body, book_id, club_id, created_at')
          .or(feedFilter)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('thread_comments')
          .select('id, discussion_id, author_id, body, created_at, unlocked, author_chapter')
          .in('author_id', authorSet)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

    const discList0 = discussions ?? []
    const replyList = myReplyRows ?? []
    const discIds = discList0.map((d) => d.id)

    // Padres de esas respuestas que aún no están entre las ideas del feed
    const parentIds = [...new Set(replyList.map((r) => r.discussion_id))].filter(
      (id) => !discIds.includes(id),
    )

    const [{ data: parentDiscs }, { data: reactionRows }, { data: commentRows }] =
      await Promise.all([
        parentIds.length
          ? supabase
              .from('feed_discussions')
              .select('id, author_id, book_id, chapter_number, body, club_id, created_at, unlocked')
              .in('id', parentIds)
          : Promise.resolve({ data: [] }),
        discIds.length
          ? supabase
              .from('reactions')
              .select('discussion_id, emoji, user_id')
              .in('discussion_id', discIds)
          : Promise.resolve({ data: [] }),
        discIds.length
          ? supabase
              .from('thread_comments')
              .select('discussion_id')
              .in('discussion_id', discIds)
          : Promise.resolve({ data: [] }),
      ])

    const reactByDisc = new Map<string, Record<string, number>>()
    const myReactByDisc = new Map<string, string>()
    for (const r of reactionRows ?? []) {
      const m = reactByDisc.get(r.discussion_id) ?? {}
      m[r.emoji] = (m[r.emoji] ?? 0) + 1
      reactByDisc.set(r.discussion_id, m)
      if (r.user_id === myId) myReactByDisc.set(r.discussion_id, r.emoji)
    }

    const countById = new Map<string, number>()
    for (const c of commentRows ?? [])
      countById.set(c.discussion_id, (countById.get(c.discussion_id) ?? 0) + 1)

    // ---- Lecturas en curso (todas: la del club y las personales) ----
    let readings: HomeReading[] = []
    if (readingRows.length > 0) {
      const ids = readingRows.map((p) => p.book_id)
      const [{ data: readingBooks }, { data: readingChapters }] =
        await Promise.all([
          supabase.from('books').select('*').in('id', ids),
          supabase
            .from('chapters')
            .select('book_id, number, label')
            .in('book_id', ids),
        ])
      const bookById = new Map((readingBooks ?? []).map((b) => [b.id, b]))
      const chLabel = new Map(
        (readingChapters ?? []).map((c) => [`${c.book_id}/${c.number}`, c.label]),
      )
      readings = readingRows.flatMap((p) => {
        const book = bookById.get(p.book_id)
        if (!book) return []
        return [
          {
            bookId: book.id,
            title: book.title,
            author: book.author,
            coverUrl: book.cover_url,
            chapterNumber: p.current_chapter,
            chapterLabel:
              chLabel.get(`${p.book_id}/${p.current_chapter}`) ?? null,
            totalChapters: book.total_chapters,
            percent: Math.round(
              (p.current_chapter / book.total_chapters) * 100,
            ),
          },
        ]
      })
    }

    // ---- Mezclar feed + conversaciones por libro ----
    const discList = discList0
    const postList = posts ?? []
    const parentList = parentDiscs ?? []
    const conversations: BookConvo[] = []
    let feed: FeedItem[] = []

    const authorIds = [
      ...new Set([
        ...discList.map((d) => d.author_id),
        ...postList.map((p) => p.author_id),
        ...replyList.map((r) => r.author_id),
        ...parentList.map((p) => p.author_id),
      ]),
    ]
    const bookIds = [
      ...new Set([
        ...discList.map((d) => d.book_id),
        ...parentList.map((p) => p.book_id),
      ]),
    ]

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

      // Origen del mensaje padre citado: ideas del feed + padres cargados aparte
      type ParentSrc = {
        id: string
        author_id: string
        book_id: string
        chapter_number: number
        body: string | null
        unlocked: boolean
      }
      const parentSourceById = new Map<string, ParentSrc>()
      for (const d of discList) parentSourceById.set(d.id, d)
      for (const d of parentList) parentSourceById.set(d.id, d)

      // Respuestas agrupadas por hilo padre: una tarjeta por HILO, jamás
      // el mismo mensaje citado N veces (eso parecía "duplicado").
      const repliesByParent = new Map<string, typeof replyList>()
      for (const r of replyList) {
        const arr = repliesByParent.get(r.discussion_id) ?? []
        arr.push(r)
        repliesByParent.set(r.discussion_id, arr)
      }
      const inFeed = new Set(discIds)
      const toFeedReply = (r: (typeof replyList)[number]) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: nameById.get(r.author_id) ?? '·',
        authorUsername: usernameById.get(r.author_id),
        body: r.unlocked ? r.body : null,
        unlockChapter: r.author_chapter,
        createdAt: timeAgo(r.created_at),
      })

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
          reactions: reactByDisc.get(d.id) ?? {},
          myReaction: myReactByDisc.get(d.id) ?? null,
          // si la idea está en el feed, sus respuestas cuelgan de ELLA
          replies: (repliesByParent.get(d.id) ?? [])
            .slice(0, 3)
            .reverse()
            .map(toFeedReply),
        } satisfies FeedItem,
      }))

      // Solo hilos cuyo padre NO está a la vista: cita + sus respuestas.
      const replyItems = [...repliesByParent.entries()]
        .filter(([parentId]) => !inFeed.has(parentId))
        .flatMap(([parentId, group]) => {
          const p = parentSourceById.get(parentId)
          if (!p) return []
          const latest = group[0]
          return [
            {
              ts: latest.created_at,
              item: {
                id: `thread-${parentId}`,
                type: 'reply',
                authorId: latest.author_id,
                authorName: nameById.get(latest.author_id) ?? '·',
                authorUsername: usernameById.get(latest.author_id),
                body: null,
                isClub: false,
                createdAt: timeAgo(latest.created_at),
                parent: {
                  discussionId: p.id,
                  authorName: nameById.get(p.author_id) ?? '·',
                  authorUsername: usernameById.get(p.author_id),
                  body: p.unlocked ? p.body : null,
                  chapterNumber: p.chapter_number,
                  chapterLabel:
                    labelByKey.get(`${p.book_id}/${p.chapter_number}`) ?? null,
                  bookTitle: bookById.get(p.book_id)?.title ?? '',
                  bookId: p.book_id,
                },
                replies: group.slice(0, 3).reverse().map(toFeedReply),
              } satisfies FeedItem,
            },
          ]
        })

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
          bookId: p.book_id,
          isClub: p.club_id != null,
          createdAt: timeAgo(p.created_at),
        } satisfies FeedItem,
      }))

      feed = [...ideaItems, ...replyItems, ...postItems]
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
      readings,
      readingBookIds: readingRows.map((p) => p.book_id),
      finishedBookIds,
      stats: {
        ideas: myIdeas ?? 0,
        replies: myReplies ?? 0,
        finished: finishedBookIds.length,
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

  const react = async (discussionId: string, emoji: string | null) => {
    if (!session) return
    if (emoji === null) {
      await supabase
        .from('reactions')
        .delete()
        .eq('discussion_id', discussionId)
        .eq('user_id', session.user.id)
    } else {
      await supabase
        .from('reactions')
        .upsert(
          { discussion_id: discussionId, user_id: session.user.id, emoji },
          { onConflict: 'discussion_id,user_id' },
        )
    }
    await load()
  }

  const reply = async (discussionId: string, body: string) => {
    if (!session) return
    await supabase
      .from('discussion_comments')
      .insert({ discussion_id: discussionId, author_id: session.user.id, body })
    await load()
  }

  if (!data) return <HomeSkeleton />

  return (
    <HomeView
      data={data}
      onDeleteItem={deleteItem}
      onReact={react}
      onReply={reply}
    />
  )
}
