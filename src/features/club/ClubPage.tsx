import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover } from '../../components/ui'
import type { Book, Club, Poll, PollOption } from '../../lib/database.types'
import './club.css'

interface Member {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  role: string
}

interface PollState {
  poll: Poll
  options: (PollOption & { votes: number })[]
  totalVotes: number
  myVote: string | null
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
    const { data: profiles } = memberIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', memberIds)
      : { data: [] }
    setMembers(
      (profiles ?? [])
        .map((p) => ({ ...p, role: roleById.get(p.id) ?? 'member' }))
        .sort((a) => (a.role === 'captain' ? -1 : 1)),
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
      setPollState({
        poll,
        options: (options ?? []).map((o) => ({
          ...o,
          votes: countByOption.get(o.id) ?? 0,
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
                <button
                  key={o.id}
                  className={`poll-option${mine ? ' mine' : ''}`}
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
                  {o.note && (
                    <span className="body-small poll-option__note serif">
                      «{o.note}»
                    </span>
                  )}
                </button>
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

      <h2 className="title-small club-sec">Miembros</h2>
      <div className="club-members">
        {members.map((m) => (
          <Link key={m.id} to={`/u/${m.username}`} className="club-member">
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
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
