import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import ChapterView from './ChapterView'
import type { ChapterViewData, ThreadDiscussion } from './chapterTypes'
import type { DiscussionKind } from '../../lib/database.types'

export default function ChapterPage() {
  const { number } = useParams()
  const chapterNumber = Number(number)
  const { session } = useAuth()
  const [data, setData] = useState<ChapterViewData | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session || !Number.isFinite(chapterNumber)) return

    const { data: club } = await supabase
      .from('clubs')
      .select('id, current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    const bookId = club?.current_book_id
    const clubId = club?.id ?? null
    if (!bookId) return

    const [{ data: book }, { data: progress }, { data: chapter }] =
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
      ])

    const canWrite = (progress?.current_chapter ?? 0) >= chapterNumber

    // El spoiler gate (RLS) devuelve solo discusiones de capítulos alcanzados.
    const { data: discussions } = await supabase
      .from('discussions')
      .select('id, author_id, kind, body, club_id, created_at')
      .eq('book_id', bookId)
      .eq('chapter_number', chapterNumber)
      .order('created_at', { ascending: true })

    const list = discussions ?? []
    const discIds = list.map((d) => d.id)
    const authorIds = new Set(list.map((d) => d.author_id))

    const { data: comments } = discIds.length
      ? await supabase
          .from('discussion_comments')
          .select('id, discussion_id, author_id, body, created_at')
          .in('discussion_id', discIds)
          .order('created_at', { ascending: true })
      : { data: [] }
    for (const c of comments ?? []) authorIds.add(c.author_id)

    const { data: profiles } = authorIds.size
      ? await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', [...authorIds])
      : { data: [] }
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name]),
    )

    const threads: ThreadDiscussion[] = list.map((d) => ({
      id: d.id,
      authorId: d.author_id,
      authorName: nameById.get(d.author_id) ?? '·',
      kind: d.kind,
      body: d.body,
      isClub: d.club_id != null,
      createdAt: new Date(d.created_at).toLocaleDateString(),
      comments: (comments ?? [])
        .filter((c) => c.discussion_id === d.id)
        .map((c) => ({
          id: c.id,
          authorId: c.author_id,
          authorName: nameById.get(c.author_id) ?? '·',
          body: c.body,
          createdAt: new Date(c.created_at).toLocaleDateString(),
        })),
    }))

    setData({
      bookTitle: book?.title ?? '',
      chapterNumber,
      chapterLabel: chapter?.label ?? null,
      canWrite,
      discussions: threads,
    })

    return { bookId, clubId }
  }, [session, chapterNumber])

  useEffect(() => {
    void load()
  }, [load])

  const publish = async (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
  ) => {
    if (!session) return
    setBusy(true)
    const { data: club } = await supabase
      .from('clubs')
      .select('id, current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (club?.current_book_id) {
      await supabase.from('discussions').insert({
        book_id: club.current_book_id,
        chapter_number: chapterNumber,
        author_id: session.user.id,
        kind,
        body,
        club_id: toClub ? club.id : null,
      })
      await load()
    }
    setBusy(false)
  }

  const reply = async (discussionId: string, body: string) => {
    if (!session) return
    setBusy(true)
    await supabase.from('discussion_comments').insert({
      discussion_id: discussionId,
      author_id: session.user.id,
      body,
    })
    await load()
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
    <ChapterView data={data} busy={busy} onPublish={publish} onReply={reply} />
  )
}
