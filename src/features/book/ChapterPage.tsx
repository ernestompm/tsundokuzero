import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { fetchBlockedIds } from '../../lib/blocks'
import { timeAgo } from '../../lib/time'
import ChapterView from './ChapterView'
import type { ChapterViewData, ThreadDiscussion } from './chapterTypes'
import type { DiscussionKind } from '../../lib/database.types'

export default function ChapterPage() {
  const { bookId, number } = useParams()
  const chapterNumber = Number(number)
  const { session } = useAuth()
  const [data, setData] = useState<ChapterViewData | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session || !bookId || !Number.isFinite(chapterNumber)) return

    const [{ data: book }, { data: progress }, { data: chapter }, { data: club }] =
      await Promise.all([
        supabase.from('books').select('title').eq('id', bookId).maybeSingle(),
        supabase
          .from('reading_progress')
          .select('current_chapter')
          .eq('user_id', session.user.id)
          .eq('book_id', bookId)
          .maybeSingle(),
        supabase
          .from('chapters')
          .select('label')
          .eq('book_id', bookId)
          .eq('number', chapterNumber)
          .maybeSingle(),
        // Si este libro es el libro actual de un club, se puede etiquetar.
        supabase
          .from('clubs')
          .select('id')
          .eq('current_book_id', bookId)
          .limit(1)
          .maybeSingle(),
      ])

    setClubId(club?.id ?? null)
    const canWrite = (progress?.current_chapter ?? 0) >= chapterNumber

    // El spoiler gate (RLS) filtra en servidor lo que no debe verse.
    const [{ data: discussions }, blocked] = await Promise.all([
      supabase
        .from('discussions')
        .select('id, author_id, kind, body, club_id, created_at')
        .eq('book_id', bookId)
        .eq('chapter_number', chapterNumber)
        .order('created_at', { ascending: true }),
      fetchBlockedIds(session.user.id),
    ])

    // Bloqueos (P2-13): sus hilos y respuestas no se muestran
    const list = (discussions ?? []).filter((d) => !blocked.has(d.author_id))
    const discIds = list.map((d) => d.id)
    const authorIds = new Set(list.map((d) => d.author_id))

    // Vista enmascarada: body=null si el autor iba por delante de ti
    const { data: rawComments } = discIds.length
      ? await supabase
          .from('thread_comments')
          .select('id, discussion_id, author_id, body, created_at, author_chapter, unlocked')
          .in('discussion_id', discIds)
          .order('created_at', { ascending: true })
      : { data: [] }
    const comments = (rawComments ?? []).filter(
      (c) => !blocked.has(c.author_id),
    )
    for (const c of comments ?? []) authorIds.add(c.author_id)

    const { data: reactionRows } = discIds.length
      ? await supabase
          .from('reactions')
          .select('discussion_id, emoji, user_id')
          .in('discussion_id', discIds)
      : { data: [] }
    const reactByDisc = new Map<string, Record<string, number>>()
    const myReactByDisc = new Map<string, string>()
    for (const r of reactionRows ?? []) {
      const m = reactByDisc.get(r.discussion_id) ?? {}
      m[r.emoji] = (m[r.emoji] ?? 0) + 1
      reactByDisc.set(r.discussion_id, m)
      if (r.user_id === session.user.id) myReactByDisc.set(r.discussion_id, r.emoji)
    }

    const { data: profiles } = authorIds.size
      ? await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', [...authorIds])
      : { data: [] }
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name]),
    )
    const usernameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.username]),
    )
    const avatarById = new Map(
      (profiles ?? []).map((p) => [p.id, p.avatar_url]),
    )

    const threads: ThreadDiscussion[] = list.map((d) => ({
      id: d.id,
      authorId: d.author_id,
      authorName: nameById.get(d.author_id) ?? '·',
      authorAvatar: avatarById.get(d.author_id),
      authorUsername: usernameById.get(d.author_id),
      kind: d.kind,
      body: d.body,
      isClub: d.club_id != null,
      createdAt: timeAgo(d.created_at),
      reactions: reactByDisc.get(d.id) ?? {},
      myReaction: myReactByDisc.get(d.id) ?? null,
      comments: (comments ?? [])
        .filter((c) => c.discussion_id === d.id)
        .map((c) => ({
          id: c.id,
          authorId: c.author_id,
          authorName: nameById.get(c.author_id) ?? '·',
          authorAvatar: avatarById.get(c.author_id),
          body: c.unlocked ? c.body : null,
          unlockChapter: c.author_chapter,
          createdAt: timeAgo(c.created_at),
        })),
    }))

    setData({
      bookId,
      bookTitle: book?.title ?? '',
      chapterNumber,
      chapterLabel: chapter?.label ?? null,
      canWrite,
      myChapter: progress?.current_chapter ?? 0,
      discussions: threads,
    })
  }, [session, bookId, chapterNumber])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (op: PromiseLike<unknown>) => {
    setBusy(true)
    await op
    await load()
    setBusy(false)
  }

  const publish = (kind: DiscussionKind, body: string, toClub: boolean) => {
    if (!session || !bookId) return
    void run(
      supabase.from('discussions').insert({
        book_id: bookId,
        chapter_number: chapterNumber,
        author_id: session.user.id,
        kind,
        body,
        club_id: toClub ? clubId : null,
      }),
    )
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return (
    <ChapterView
      data={data}
      busy={busy}
      currentUserId={session?.user.id}
      clubAvailable={clubId != null}
      onPublish={publish}
      onReply={(discussionId, body) =>
        session &&
        void run(
          supabase.from('discussion_comments').insert({
            discussion_id: discussionId,
            author_id: session.user.id,
            body,
          }),
        )
      }
      onEditDiscussion={(id, body) =>
        void run(supabase.from('discussions').update({ body }).eq('id', id))
      }
      onDeleteDiscussion={(id) =>
        void run(supabase.from('discussions').delete().eq('id', id))
      }
      onDeleteComment={(id) =>
        void run(supabase.from('discussion_comments').delete().eq('id', id))
      }
      onReact={(discussionId, emoji) =>
        session &&
        void run(
          emoji === null
            ? supabase
                .from('reactions')
                .delete()
                .eq('discussion_id', discussionId)
                .eq('user_id', session.user.id)
            : supabase.from('reactions').upsert(
                {
                  discussion_id: discussionId,
                  user_id: session.user.id,
                  emoji,
                },
                { onConflict: 'discussion_id,user_id' },
              ),
        )
      }
    />
  )
}
