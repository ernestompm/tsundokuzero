import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, AvatarStack, BookCover } from '../../components/ui'
import type { Book, Club, Poll, PollOption } from '../../lib/database.types'
import './club.css'

interface Member {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  role: string
  /** capítulo actual en el libro del club (para insights) */
  chapter: number
}

interface PollState {
  poll: Poll
  options: (PollOption & {
    votes: number
    /** quién ha votado esta opción (voto público dentro del club) */
    voters: { name: string; url?: string | null }[]
  })[]
  totalVotes: number
  myVote: string | null
}

/** «Marina, Carlos y 2 más» a partir de los nombres de pila. */
function voterNames(voters: { name: string }[]): string {
  const names = voters.map((v) => v.name.split(/\s+/)[0])
  if (names.length <= 2) return names.join(' y ')
  return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`
}

export default function ClubPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [club, setClub] = useState<Club | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [pollState, setPollState] = useState<PollState | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!clubData) return
    setClub(clubData)

    const [{ data: bookData }, { data: memberRows }, { data: poll }] =
      await Promise.all([
        clubData.current_book_id
          ? supabase
              .from('books')
              .select('*')
              .eq('id', clubData.current_book_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('club_members')
          .select('user_id, role')
          .eq('club_id', clubData.id),
        supabase
          .from('polls')
          .select('*')
          .eq('club_id', clubData.id)
          .order('status', { ascending: false }) // open antes que closed
          .limit(1)
          .maybeSingle(),
      ])
    setBook(bookData)

    const memberIds = (memberRows ?? []).map((m) => m.user_id)
    const roleById = new Map((memberRows ?? []).map((m) => [m.user_id, m.role]))
    const [{ data: profiles }, { data: progressRows }] = await Promise.all([
      memberIds.length
        ? supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', memberIds)
        : Promise.resolve({ data: [] }),
      memberIds.length && clubData.current_book_id
        ? supabase
            .from('reading_progress')
            .select('user_id, current_chapter')
            .eq('book_id', clubData.current_book_id)
            .in('user_id', memberIds)
        : Promise.resolve({ data: [] }),
    ])
    const chapterByUser = new Map(
      (progressRows ?? []).map((p) => [p.user_id, p.current_chapter]),
    )
    setMembers(
      (profiles ?? [])
        .map((p) => ({
          ...p,
          role: roleById.get(p.id) ?? 'member',
          chapter: chapterByUser.get(p.id) ?? 0,
        }))
        .sort((a, b) =>
          a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : b.chapter - a.chapter,
        ),
    )

    if (poll) {
      const [{ data: options }, { data: votes }] = await Promise.all([
        supabase.from('poll_options').select('*').eq('poll_id', poll.id),
        supabase.from('poll_votes').select('option_id, user_id').eq('poll_id', poll.id),
      ])
      const voteRows = votes ?? []
      const countByOption = new Map<string, number>()
      for (const v of voteRows)
        countByOption.set(v.option_id, (countByOption.get(v.option_id) ?? 0) + 1)
      // Voto público dentro del club: quién ha votado cada opción
      const profById = new Map((profiles ?? []).map((p) => [p.id, p]))
      setPollState({
        poll,
        options: (options ?? []).map((o) => ({
          ...o,
          votes: countByOption.get(o.id) ?? 0,
          voters: voteRows
            .filter((v) => v.option_id === o.id)
            .map((v) => {
              const p = profById.get(v.user_id)
              return { name: p?.display_name ?? 'Alguien', url: p?.avatar_url }
            }),
        })),
        totalVotes: voteRows.length,
        myVote:
          voteRows.find((v) => v.user_id === session.user.id)?.option_id ?? null,
      })
    } else {
      setPollState(null)
    }
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (!club) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const iAmCaptain =
    members.find((m) => m.id === session?.user.id)?.role === 'captain'

  const vote = async (optionId: string) => {
    if (!session || !pollState) return
    setBusy(true)
    await supabase.from('poll_votes').upsert(
      {
        poll_id: pollState.poll.id,
        option_id: optionId,
        user_id: session.user.id,
      },
      { onConflict: 'poll_id,user_id' },
    )
    await load()
    setBusy(false)
  }

  const closePoll = async () => {
    if (!pollState) return
    if (
      !window.confirm(
        'Cerrar la votación: la opción más votada quedará como ganadora. ¿Continuar?',
      )
    )
      return
    setBusy(true)
    await supabase
      .from('polls')
      .update({ status: 'closed' })
      .eq('id', pollState.poll.id)
    await load()
    setBusy(false)
  }

  const winner =
    pollState?.poll.status === 'closed'
      ? pollState.options.find((o) => o.id === pollState.poll.winner_option_id)
      : null

  // Insights: tu avance frente al grupo
  const me = members.find((m) => m.id === session?.user.id)
  const myChapter = me?.chapter ?? 0
  const chapters = members.map((m) => m.chapter)
  const groupAvg =
    chapters.length > 0
      ? Math.round(chapters.reduce((s, c) => s + c, 0) / chapters.length)
      : 0
  const aheadOf = members.filter(
    (m) => m.id !== me?.id && m.chapter < myChapter,
  ).length
  const others = members.length - 1

  return (
    <section className="club">
      <div className="club-head">
        <h1 className="headline-small serif">{club.name}</h1>
        {club.description && (
          <p className="body-medium on-surface-variant">{club.description}</p>
        )}
        <p className="body-small on-surface-variant">
          {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
        </p>
        {iAmCaptain && (
          <md-outlined-button
            className="club-manage-btn"
            onClick={() => navigate('/club/manage')}
          >
            <span slot="icon" className="material-symbols-rounded">settings</span>
            Gestionar club
          </md-outlined-button>
        )}
      </div>

      {book && (
        <button className="club-book" onClick={() => navigate(`/book/${book.id}`)}>
          <BookCover
            title={book.title}
            author={book.author}
            coverUrl={book.cover_url}
            size="md"
          />
          <span className="club-book__info">
            <span className="label-small club-kicker">Libro del mes</span>
            <span className="title-medium serif">{book.title}</span>
            <span className="body-small on-surface-variant">{book.author}</span>
          </span>
          <span className="material-symbols-rounded on-surface-variant">
            chevron_right
          </span>
        </button>
      )}

      {/* Insights: tu avance frente al grupo */}
      {book && members.length > 1 && (
        <div className="club-insights">
          <span className="material-symbols-rounded club-insights__icon">
            trending_up
          </span>
          <div>
            <p className="body-medium">
              {myChapter === 0 ? (
                <>
                  El grupo va por el capítulo <b>{groupAvg}</b> de media.
                  ¡Empieza para unirte a la conversación!
                </>
              ) : aheadOf === 0 ? (
                <>
                  Vas por el capítulo <b>{myChapter}</b>. El grupo va por el{' '}
                  <b>{groupAvg}</b> de media — acelera para alcanzarlos.
                </>
              ) : (
                <>
                  Vas por el capítulo <b>{myChapter}</b>, por delante de{' '}
                  <b>{aheadOf}</b> de {others}. Media del grupo: cap. {groupAvg}.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {pollState && (
        <div className="club-poll">
          <div className="club-poll__head">
            <span className="title-medium serif">{pollState.poll.title}</span>
            <span className="body-small on-surface-variant">
              {pollState.poll.status === 'open'
                ? `Votación abierta · 1 voto por persona${
                    pollState.poll.closes_at
                      ? ` · cierra el ${new Date(pollState.poll.closes_at).toLocaleDateString()}`
                      : ''
                  }`
                : 'Votación cerrada'}
            </span>
          </div>

          {winner && (
            <p className="club-poll__winner body-medium">
              🏆 Ganadora: <b>{winner.book_title}</b> de {winner.book_author}
            </p>
          )}

          <div className="club-poll__options">
            {pollState.options.map((o) => {
              const pct =
                pollState.totalVotes > 0
                  ? Math.round((o.votes / pollState.totalVotes) * 100)
                  : 0
              const mine = pollState.myVote === o.id
              return (
                <div key={o.id} className={`poll-option${mine ? ' mine' : ''}`}>
                  <button
                    className="poll-option__vote"
                    disabled={pollState.poll.status !== 'open' || busy}
                    onClick={() => void vote(o.id)}
                  >
                    <span className="poll-option__row">
                      <span className="title-small">
                        {mine ? '◉ ' : '○ '}
                        {o.book_title}
                      </span>
                      <span className="label-medium on-surface-variant">
                        {o.votes} {o.votes === 1 ? 'voto' : 'votos'}
                      </span>
                    </span>
                    <span className="body-small on-surface-variant">
                      {o.book_author}
                    </span>
                    <span className="poll-option__bar">
                      <span
                        className="poll-option__fill"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    {/* Quién ha votado (el voto es visible dentro del club) */}
                    {o.voters.length > 0 && (
                      <span className="poll-option__voters">
                        <AvatarStack
                          people={o.voters.slice(0, 4)}
                          extra={Math.max(0, o.voters.length - 4)}
                        />
                        <span className="body-small on-surface-variant">
                          {voterNames(o.voters)}
                        </span>
                      </span>
                    )}
                    {o.note && (
                      <span className="body-small poll-option__note serif">
                        «{o.note}»
                      </span>
                    )}
                  </button>
                  {/* Los candidatos son libros del catálogo: su ficha, a un toque */}
                  {o.book_id && (
                    <button
                      className="poll-option__ficha label-medium"
                      onClick={() => navigate(`/book/${o.book_id}`)}
                    >
                      Ver sinopsis y ficha
                      <span className="material-symbols-rounded">
                        chevron_right
                      </span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {iAmCaptain && pollState.poll.status === 'open' && (
            <md-text-button disabled={busy || undefined} onClick={() => void closePoll()}>
              Cerrar votación (capitán)
            </md-text-button>
          )}
        </div>
      )}

      {iAmCaptain && !pollState && (
        <md-outlined-button
          className="club-manage-btn"
          onClick={() => navigate('/club/manage')}
        >
          <span slot="icon" className="material-symbols-rounded">how_to_vote</span>
          Proponer nueva votación
        </md-outlined-button>
      )}

      <h2 className="title-small club-sec">
        Miembros
        {book ? ' · avance' : ''}
      </h2>
      <div className="club-members">
        {members.map((m) => (
          <div key={m.id} className="club-member">
            <Link to={`/u/${m.username}`} className="club-member__id">
              <Avatar name={m.display_name} url={m.avatar_url} size={40} />
              <span className="club-member__names">
                <span className="title-small">
                  {m.display_name}
                  {m.role === 'captain' && (
                    <span
                      className="label-small"
                      style={{ color: 'var(--md-sys-color-primary)' }}
                    >
                      {' '}
                      ★ capitán
                    </span>
                  )}
                </span>
                <span className="body-small on-surface-variant">
                  @{m.username}
                  {book && m.chapter > 0 ? ` · cap. ${m.chapter}` : ''}
                </span>
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
