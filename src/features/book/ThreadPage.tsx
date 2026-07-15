import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { timeAgo } from '../../lib/time'
import ThreadView from './ThreadView'
import type { ThreadViewData } from './chapterTypes'

export default function ThreadPage() {
  const { discussionId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ThreadViewData | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session || !discussionId) return

    // Vista con teaser: body=null si el hilo está por delante de ti
    const { data: disc } = await supabase
      .from('feed_discussions')
      .select('id, book_id, chapter_number, author_id, kind, club_id, created_at, unlocked, body')
      .eq('id', discussionId)
      .maybeSingle()
    if (!disc) {
      setMissing(true)
      return
    }

    const [
      { data: book },
      { data: chapter },
      { data: progress },
      { data: comments },
      { data: reactions },
    ] = await Promise.all([
      supabase.from('books').select('title').eq('id', disc.book_id).maybeSingle(),
      supabase
        .from('chapters')
        .select('label')
        .eq('book_id', disc.book_id)
        .eq('number', disc.chapter_number)
        .maybeSingle(),
      supabase
        .from('reading_progress')
        .select('current_chapter')
        .eq('user_id', session.user.id)
        .eq('book_id', disc.book_id)
        .maybeSingle(),
      supabase
        .from('thread_comments')
        .select('id, author_id, body, created_at, author_chapter, unlocked')
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('reactions')
        .select('emoji, user_id')
        .eq('discussion_id', discussionId),
    ])

    const commentList = comments ?? []
    const authorIds = [
      ...new Set([disc.author_id, ...commentList.map((c) => c.author_id)]),
    ]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .in('id', authorIds)
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    const counts: Record<string, number> = {}
    let myReaction: string | null = null
    for (const r of reactions ?? []) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
      if (r.user_id === session.user.id) myReaction = r.emoji
    }

    const myChapter = progress?.current_chapter ?? 0

    setData({
      discussionId: disc.id,
      bookId: disc.book_id,
      bookTitle: book?.title ?? '',
      chapterNumber: disc.chapter_number,
      chapterLabel: chapter?.label ?? null,
      authorId: disc.author_id,
      authorName: byId.get(disc.author_id)?.display_name ?? '·',
      authorUsername: byId.get(disc.author_id)?.username,
      kind: disc.kind,
      body: disc.unlocked ? disc.body : null,
      isClub: disc.club_id != null,
      createdAt: timeAgo(disc.created_at),
      reactions: counts,
      myReaction,
      canWrite: myChapter >= disc.chapter_number,
      myChapter,
      comments: commentList.map((c) => ({
        id: c.id,
        authorId: c.author_id,
        authorName: byId.get(c.author_id)?.display_name ?? '·',
        body: c.unlocked ? c.body : null,
        unlockChapter: c.author_chapter,
        createdAt: timeAgo(c.created_at),
      })),
    })
  }, [session, discussionId])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (op: PromiseLike<unknown>) => {
    setBusy(true)
    await op
    await load()
    setBusy(false)
  }

  if (missing) {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">Este hilo ya no existe.</p>
        <p className="body-medium on-surface-variant">
          Puede que su autor lo haya borrado.
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

  return (
    <ThreadView
      data={data}
      busy={busy}
      currentUserId={session?.user.id}
      onReply={(body) =>
        session &&
        void run(
          supabase.from('discussion_comments').insert({
            discussion_id: data.discussionId,
            author_id: session.user.id,
            body,
          }),
        )
      }
      onReact={(emoji) =>
        session &&
        void run(
          emoji === null
            ? supabase
                .from('reactions')
                .delete()
                .eq('discussion_id', data.discussionId)
                .eq('user_id', session.user.id)
            : supabase.from('reactions').upsert(
                {
                  discussion_id: data.discussionId,
                  user_id: session.user.id,
                  emoji,
                },
                { onConflict: 'discussion_id,user_id' },
              ),
        )
      }
      onDeleteComment={(id) =>
        void run(supabase.from('discussion_comments').delete().eq('id', id))
      }
      onDeleteDiscussion={() =>
        void (async () => {
          await supabase.from('discussions').delete().eq('id', data.discussionId)
          navigate(`/book/${data.bookId}/chapter/${data.chapterNumber}`, {
            replace: true,
          })
        })()
      }
    />
  )
}
