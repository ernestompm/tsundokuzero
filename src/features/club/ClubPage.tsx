import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../auth/AuthContext'
import { useConfirm } from '../../components/ConfirmProvider'
import NextRead from './NextRead'
import { BadgeDots } from '../../components/Badges'
import { badgesDe, type MemberStats } from '../../lib/badges'
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

/** Una lectura pasada del club (migr. 028) */
interface Lectura {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  kind: 'main' | 'bis'
  closedAt: string | null
  media: number | null
}

/** Hoja de capitanía: qué propuso cada uno y cómo le fue */
interface Capitania {
  userId: string
  name: string
  avatar: string | null
  libros: number
  bises: number
  media: number | null
  terminadas: number
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
  const { session, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [club, setClub] = useState<Club | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [pollState, setPollState] = useState<PollState | null>(null)
  const [historial, setHistorial] = useState<Lectura[]>([])
  const [capitanias, setCapitanias] = useState<Capitania[]>([])
  // Insignias por miembro (migr. 030), derivadas de la vista
  const [stats, setStats] = useState<Map<string, MemberStats>>(new Map())
  const [busy, setBusy] = useState(false)
  // Estado de carga explícito (auditoría C-03): sin él, «no hay club»
  // dejaba el spinner girando para siempre.
  const [loading, setLoading] = useState(true)
  // Error de la última acción (votar, cerrar votación…): antes solo cubría
  // el voto (voteError); se generaliza para no silenciar ningún fallo.
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!clubData) {
      // Sin club: se sale del estado de carga para mostrar el aviso (C-03)
      setLoading(false)
      return
    }
    setClub(clubData)

    // Relevo de capitanía vencido (migr. 029): se comprueba al abrir el
    // club, sin planificador. Si cambia el capitán, se recarga.
    const { data: nuevoCapitan } = await supabase.rpc('rotate_captain_if_due')
    if (nuevoCapitan) {
      void load()
      return
    }

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
          // Solo la ABIERTA. Antes se pedía cualquiera ordenando por estado,
          // así que al cerrarse una se quedaba clavada en el club para
          // siempre, y encima tapaba el botón de proponer la siguiente.
          // El resultado de la votación ya se ve como «Próxima lectura».
          .eq('status', 'open')
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

    // ---- Historial de lecturas y hoja de capitanía (migr. 028) ----
    const { data: lecturas } = await supabase
      .from('club_readings')
      .select('book_id, kind, closed_at, started_at')
      .eq('club_id', clubData.id)
      .order('started_at', { ascending: false })
      .limit(24)

    const idsLibros = [...new Set((lecturas ?? []).map((l) => l.book_id))]
    if (idsLibros.length > 0) {
      const [{ data: libros }, { data: notas }] = await Promise.all([
        supabase.from('books').select('id, title, author, cover_url').in('id', idsLibros),
        supabase.from('book_reviews').select('book_id, rating').in('book_id', idsLibros),
      ])
      const libroPorId = new Map((libros ?? []).map((b) => [b.id, b]))
      const notasPorLibro = new Map<string, number[]>()
      for (const n of notas ?? []) {
        const arr = notasPorLibro.get(n.book_id) ?? []
        arr.push(n.rating)
        notasPorLibro.set(n.book_id, arr)
      }
      setHistorial(
        (lecturas ?? []).flatMap((l) => {
          const b = libroPorId.get(l.book_id)
          if (!b) return []
          const ns = notasPorLibro.get(l.book_id) ?? []
          return [
            {
              bookId: l.book_id,
              title: b.title,
              author: b.author,
              coverUrl: b.cover_url,
              kind: l.kind,
              closedAt: l.closed_at,
              media: ns.length ? ns.reduce((a, c) => a + c, 0) / ns.length : null,
            },
          ]
        }),
      )
    } else {
      setHistorial([])
    }

    const { data: filas } = await supabase
      .from('club_member_stats')
      .select('*')
      .eq('club_id', clubData.id)
    setStats(new Map((filas ?? []).map((f) => [f.user_id, f as MemberStats])))

    const { data: hojas } = await supabase
      .from('club_captain_record')
      .select('user_id, libros, bises, media_estrellas, lecturas_terminadas')
      .eq('club_id', clubData.id)
    if (hojas && hojas.length > 0) {
      const perfiles = new Map(
        ((
          await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', hojas.map((h) => h.user_id))
        ).data ?? []).map((p) => [p.id, p]),
      )
      setCapitanias(
        hojas
          .map((h) => ({
            userId: h.user_id,
            name: perfiles.get(h.user_id)?.display_name ?? 'Capitán',
            avatar: perfiles.get(h.user_id)?.avatar_url ?? null,
            libros: h.libros,
            bises: h.bises,
            media: h.media_estrellas,
            terminadas: h.lecturas_terminadas,
          }))
          .sort((a, b) => (b.media ?? 0) - (a.media ?? 0)),
      )
    } else {
      setCapitanias([])
    }

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
    setLoading(false)
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  // Sin club activo (auditoría C-03): mensaje amable + vuelta al inicio
  if (!club) {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">Todavía no hay ningún club activo.</p>
        <p className="body-medium on-surface-variant">
          Cuando se cree el club de lectura, aparecerá aquí.
        </p>
        <md-filled-button
          style={{ marginTop: 16 }}
          onClick={() => navigate('/')}
        >
          Volver al inicio
        </md-filled-button>
      </section>
    )
  }

  const iAmCaptain =
    members.find((m) => m.id === session?.user.id)?.role === 'captain'

  const vote = async (optionId: string) => {
    if (!session || !pollState) return
    setBusy(true)
    setActionError(null)
    // Auditoría A-01: el voto puede fallar (red, RLS…) y hay que decirlo
    const { error } = await supabase.from('poll_votes').upsert(
      {
        poll_id: pollState.poll.id,
        option_id: optionId,
        user_id: session.user.id,
      },
      { onConflict: 'poll_id,user_id' },
    )
    if (error) {
      setActionError(
        friendlyError(error, 'No se pudo registrar tu voto. Inténtalo de nuevo.'),
      )
    } else {
      await load()
    }
    setBusy(false)
  }

  const closePoll = async () => {
    if (!pollState) return
    // Auditoría M-04: diálogo propio en lugar de window.confirm
    if (
      !(await confirm({
        title: 'Cerrar votación',
        message:
          'La opción más votada quedará como ganadora. ¿Continuar?',
        confirmLabel: 'Cerrar votación',
      }))
    )
      return
    setBusy(true)
    setActionError(null)
    // Auditoría: cerrar la votación también puede fallar y hay que decirlo
    const { error } = await supabase
      .from('polls')
      .update({ status: 'closed' })
      .eq('id', pollState.poll.id)
    if (error)
      setActionError(
        friendlyError(error, 'No se pudo cerrar la votación. Inténtalo de nuevo.'),
      )
    await load()
    setBusy(false)
  }

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
        {/* Dos puertas distintas: el capitán gobierna la lectura, el
            administrador configura el club. */}
        <div className="club-head__acciones">
          {(iAmCaptain || isSuperAdmin) && (
            <md-outlined-button
              className="club-manage-btn"
              onClick={() => navigate('/club/capitania')}
            >
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">how_to_vote</span>
              Capitanía
            </md-outlined-button>
          )}
          {isSuperAdmin && (
            <md-outlined-button
              className="club-manage-btn"
              onClick={() => navigate('/club/admin')}
            >
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">settings</span>
              Administrar
            </md-outlined-button>
          )}
        </div>
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
          <span className="material-symbols-rounded on-surface-variant" aria-hidden="true">
            chevron_right
          </span>
        </button>
      )}

      {/* Lo que viene después, para ir consiguiéndolo */}
      <NextRead />

      {/* Insights: tu avance frente al grupo */}
      {book && members.length > 1 && (
        <div className="club-insights">
          <span className="material-symbols-rounded club-insights__icon" aria-hidden="true">
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
              {`Votación abierta · 1 voto por persona${
                pollState.poll.closes_at
                  ? ` · se cierra sola el ${new Date(
                      pollState.poll.closes_at,
                    ).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
                  : ''
              }`}
            </span>
          </div>

          {/* Auditoría A-01: aviso inline si la acción no se pudo completar */}
          {actionError && (
            <p className="club-banner club-banner--error body-small" role="alert">
              {actionError}
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
                    disabled={busy}
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
                      <span className="material-symbols-rounded" aria-hidden="true">
                        chevron_right
                      </span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {iAmCaptain && (
            <md-text-button disabled={busy || undefined} onClick={() => void closePoll()}>
              Cerrar votación (capitán)
            </md-text-button>
          )}
        </div>
      )}

      {(iAmCaptain || isSuperAdmin) && !pollState && (
        <md-outlined-button
          className="club-manage-btn"
          onClick={() => navigate('/club/capitania')}
        >
          <span slot="icon" className="material-symbols-rounded" aria-hidden="true">how_to_vote</span>
          Proponer nueva votación
        </md-outlined-button>
      )}

      <h2 className="title-small club-sec">
        Miembros
        {book ? ' · avance' : ''}
      </h2>
      {/* Lo que hemos leído: el club tiene memoria (migr. 028) */}
      {historial.length > 0 && (
        <>
          <h2 className="title-small club-sec">Lo que hemos leído</h2>
          <div className="club-history">
            {historial.map((l) => (
              <Link
                key={`${l.bookId}-${l.closedAt ?? 'abierta'}`}
                to={`/book/${l.bookId}/opinions`}
                className="club-read"
              >
                <BookCover
                  title={l.title}
                  author={l.author}
                  coverUrl={l.coverUrl}
                  size="sm"
                />
                <span className="club-read__main">
                  <span className="title-small serif club-read__title">{l.title}</span>
                  <span className="body-small on-surface-variant">
                    {l.author}
                    {l.media != null ? ` · ${l.media.toFixed(1)} ★` : ' · sin valorar'}
                  </span>
                </span>
                {l.kind === 'bis' && (
                  <span className="label-small club-read__bis" title="Lectura extra del mes">
                    el bis
                  </span>
                )}
                {l.closedAt === null && (
                  <span className="label-small club-read__now">leyendo</span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Hoja de capitanía: qué propuso cada uno y cómo le fue */}
      {capitanias.length > 0 && (
        <>
          <h2 className="title-small club-sec">Hoja de capitanía</h2>
          <p className="body-small on-surface-variant club-sec__sub">
            Se cuentan las estrellas, pero también cuánta gente terminó el libro:
            acertar no es solo gustar.
          </p>
          <div className="club-captains">
            {capitanias.map((c) => (
              <div key={c.userId} className="club-captain">
                <Avatar name={c.name} url={c.avatar} size={38} />
                <span className="club-captain__main">
                  <span className="title-small">{c.name}</span>
                  <span className="body-small on-surface-variant">
                    {c.libros} {c.libros === 1 ? 'libro' : 'libros'}
                    {c.bises > 0 ? ` · ${c.bises} bis` : ''}
                    {` · ${c.terminadas} ${c.terminadas === 1 ? 'lectura terminada' : 'lecturas terminadas'}`}
                  </span>
                </span>
                <span className="club-captain__nota serif">
                  {c.media != null ? c.media.toFixed(1) : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="title-small club-sec">Miembros</h2>
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
                {stats.get(m.id) && (
                  <BadgeDots badges={badgesDe(stats.get(m.id)!)} max={4} />
                )}
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
