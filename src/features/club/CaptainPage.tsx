import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../auth/AuthContext'
import { useConfirm } from '../../components/ConfirmProvider'
import { Avatar, BookCover, ProgressBar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import BookMap, { type MapReader } from '../book/BookMap'
import PollComposer from './PollComposer'
import NextRead from './NextRead'
import type { Book, Club } from '../../lib/database.types'
import './club.css'
import './captainpage.css'

interface Avance {
  id: string
  name: string
  username: string
  avatar: string | null
  chapter: number
  status: 'reading' | 'finished' | 'want' | null
  isMe: boolean
}

/**
 * Capitanía: el puesto de mando del capitán. Solo lo que se hace mes a
 * mes con la lectura, sin ajustes ni administración.
 *
 *   · abrir y cerrar la votación del próximo libro
 *   · el libro de este mes: cambiarlo, cerrarlo, pedir el bis
 *   · cómo va el resto del club
 *
 * La configuración del club vive aparte, en /club/admin.
 */
export default function CaptainPage() {
  const { session, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [club, setClub] = useState<Club | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [avances, setAvances] = useState<Avance[]>([])
  const [heat, setHeat] = useState<Map<number, number>>(new Map())
  const [openPoll, setOpenPoll] = useState<{ id: string; title: string } | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [chaptersDraft, setChaptersDraft] = useState('')
  const [pidiendoBis, setPidiendoBis] = useState(false)
  const [cambiandoLibro, setCambiandoLibro] = useState(false)
  // Próxima lectura (migr. 030): elegida pero todavía sin abrir
  const [eligiendoProxima, setEligiendoProxima] = useState(false)
  const [proximaFecha, setProximaFecha] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    const { data: c } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!c) {
      setAllowed(false)
      return
    }
    setClub(c)

    const [{ data: memberRows }, { data: bookRows }, { data: poll }] = await Promise.all([
      supabase.from('club_members').select('user_id, role').eq('club_id', c.id),
      supabase.from('books').select('*').order('title'),
      supabase
        .from('polls')
        .select('id, title')
        .eq('club_id', c.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle(),
    ])
    setBooks(bookRows ?? [])
    setOpenPoll(poll ?? null)
    setBook((bookRows ?? []).find((b) => b.id === c.current_book_id) ?? null)

    const roleById = new Map((memberRows ?? []).map((m) => [m.user_id, m.role]))
    setAllowed(roleById.get(session.user.id) === 'captain' || isSuperAdmin)

    // ---- Cómo va el club en el libro de este mes ----
    const ids = (memberRows ?? []).map((m) => m.user_id)
    if (ids.length > 0 && c.current_book_id) {
      const [{ data: perfiles }, { data: progresos }, { data: discusiones }] =
        await Promise.all([
          supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids),
          supabase
            .from('reading_progress')
            .select('user_id, current_chapter, status')
            .eq('book_id', c.current_book_id)
            .in('user_id', ids),
          supabase.from('discussions').select('chapter_number').eq('book_id', c.current_book_id),
        ])
      const progPorId = new Map((progresos ?? []).map((p) => [p.user_id, p]))
      setAvances(
        (perfiles ?? [])
          .map((p) => {
            const pr = progPorId.get(p.id)
            return {
              id: p.id,
              name: p.display_name,
              username: p.username,
              avatar: p.avatar_url,
              chapter: pr?.current_chapter ?? 0,
              status: (pr?.status ?? null) as Avance['status'],
              isMe: p.id === session.user.id,
            }
          })
          .sort((a, b) => b.chapter - a.chapter),
      )
      const cuenta = new Map<number, number>()
      for (const d of discusiones ?? [])
        cuenta.set(d.chapter_number, (cuenta.get(d.chapter_number) ?? 0) + 1)
      setHeat(cuenta)
    } else {
      setAvances([])
      setHeat(new Map())
    }
  }, [session, isSuperAdmin])

  useEffect(() => {
    void load()
  }, [load])

  if (allowed === false) return <Navigate to="/club" replace />
  if (!club || allowed === null) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const setBookDelMes = async (bookId: string) => {
    setBanner(null)
    setBusy(true)
    const { error } = await supabase
      .from('clubs')
      .update({ current_book_id: bookId })
      .eq('id', club.id)
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo cambiar el libro del mes.'),
      })
    else setCambiandoLibro(false)
    await load()
    setBusy(false)
  }

  const fijarProxima = async (bookId: string | null) => {
    setBusy(true)
    setBanner(null)
    const { error } = await supabase.rpc('set_next_book', {
      p_book: bookId,
      p_starts_at: proximaFecha ? new Date(proximaFecha + 'T09:00:00').toISOString() : null,
    })
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo fijar la próxima lectura.'),
      })
    else {
      setBanner({
        kind: 'info',
        text: bookId
          ? 'Próxima lectura fijada. El club ya tiene el aviso para ir consiguiéndola.'
          : 'Próxima lectura retirada.',
      })
      setEligiendoProxima(false)
    }
    setBusy(false)
    await load()
  }

  const empezarProxima = async () => {
    const ok = await confirm({
      title: '¿Empezar ya la próxima lectura?',
      message:
        'Pasa a ser el libro del club. Si hay una lectura abierta, se cierra y se abren sus reseñas.',
      confirmLabel: 'Empezar',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.rpc('start_next_reading')
    setBanner(
      error
        ? { kind: 'error', text: friendlyError(error, 'No se pudo empezar la lectura.') }
        : { kind: 'info', text: '¡En marcha! Ya es el libro del club.' },
    )
    setBusy(false)
    await load()
  }

  const cerrarLectura = async () => {
    const ok = await confirm({
      title: '¿Cerrar la lectura del club?',
      message:
        'Se abren las reseñas de todos, el libro pasa al historial y deja de aparecer como conversación activa. Lo hablado se conserva.',
      confirmLabel: 'Cerrar lectura',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.rpc('close_club_reading')
    setBanner(
      error
        ? { kind: 'error', text: friendlyError(error, 'No se pudo cerrar la lectura.') }
        : { kind: 'info', text: 'Lectura cerrada y reseñas estrenadas.' },
    )
    setBusy(false)
    await load()
  }

  const estrenar = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('premiere_reviews')
    setBanner(
      error
        ? { kind: 'error', text: friendlyError(error, 'No se pudo estrenar las reseñas.') }
        : { kind: 'info', text: 'Reseñas abiertas para todo el club.' },
    )
    setBusy(false)
    await load()
  }

  const pedirBis = async (bookId: string) => {
    setBusy(true)
    const { error } = await supabase.rpc('start_club_bis', { p_book: bookId })
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo abrir el bis.') })
    else {
      setBanner({ kind: 'info', text: '¡Bis en marcha! Es la lectura extra de este mes.' })
      setPidiendoBis(false)
    }
    setBusy(false)
    await load()
  }

  const confirmarCapitulos = async () => {
    if (!book) return
    const n = parseInt(chaptersDraft, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setBanner({ kind: 'info', text: 'Escribe cuántos capítulos tiene, entre 1 y 500.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('set_book_chapters', { p_book: book.id, p_total: n })
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo guardar el número de capítulos.'),
      })
    else {
      setBanner({ kind: 'info', text: 'Capítulos confirmados.' })
      setChaptersDraft('')
    }
    setBusy(false)
    await load()
  }

  const descartarVotacion = async () => {
    if (!openPoll) return
    const ok = await confirm({
      title: 'Descartar votación',
      message: `«${openPoll.title}» se borra sin aplicar ninguna ganadora. Podrás crear otra.`,
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.from('polls').delete().eq('id', openPoll.id)
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo descartar la votación.') })
    await load()
    setBusy(false)
  }

  const cerrarVotacion = async () => {
    if (!openPoll) return
    const ok = await confirm({
      title: 'Cerrar votación',
      message: 'La opción más votada quedará como libro del club. ¿Continuar?',
      confirmLabel: 'Cerrar votación',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase
      .from('polls')
      .update({ status: 'closed' })
      .eq('id', openPoll.id)
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo cerrar la votación.') })
    await load()
    setBusy(false)
  }

  const total = book?.total_chapters ?? 0
  const terminados = avances.filter((a) => a.status === 'finished').length
  const empezados = avances.filter((a) => a.chapter > 0).length
  const mediaGrupo =
    avances.length > 0
      ? Math.round(avances.reduce((s, a) => s + a.chapter, 0) / avances.length)
      : 0
  const yo = avances.find((a) => a.isMe)
  const lectores: MapReader[] = avances
    .filter((a) => a.chapter > 0)
    .map((a) => ({ id: a.id, name: a.name, avatar: a.avatar, chapter: a.chapter, isMe: a.isMe }))

  return (
    <section className="club-manage">
      <PageHeader
        title="Capitanía"
        sub={club.name}
        action={<md-text-button onClick={() => navigate('/club')}>Volver</md-text-button>}
      />

      {banner && (
        <p
          className={`club-banner body-medium${banner.kind === 'error' ? ' club-banner--error' : ''}`}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </p>
      )}

      {/* ============ 1 · La votación ============ */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">La votación del próximo libro</h2>
        {openPoll ? (
          <>
            <p className="body-medium">
              Hay una votación abierta: <b>{openPoll.title}</b>.
            </p>
            <p className="body-small on-surface-variant">
              Cuando la cierres, la más votada pasa a ser el libro del club.
            </p>
            <div className="club-poll__form-actions">
              <md-outlined-button disabled={busy || undefined} onClick={() => void descartarVotacion()}>
                <span slot="icon" className="material-symbols-rounded" aria-hidden="true">delete</span>
                Descartar
              </md-outlined-button>
              <md-filled-button disabled={busy || undefined} onClick={() => void cerrarVotacion()}>
                Cerrar y aplicar ganadora
              </md-filled-button>
            </div>
          </>
        ) : (
          <>
            <p className="body-small on-surface-variant">
              Pega los ISBN o los títulos y la votación se abre sola. Los libros que no
              estén en el catálogo se crean por el camino.
            </p>
            <PollComposer
              onCreated={() => {
                setBanner({ kind: 'info', text: 'Votación abierta. El club ya tiene el aviso.' })
                void load()
              }}
              onCancel={() => setBanner(null)}
            />
          </>
        )}
      </div>

      {/* ============ 2 · El libro de este mes ============ */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">El libro de este mes</h2>

        {book ? (
          <>
            <div className="manage-current-book">
              <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} size="md" />
              <span className="body-medium">
                <b>{book.title}</b>
                <br />
                <span className="on-surface-variant">
                  {book.author} · {book.total_chapters} capítulos
                </span>
              </span>
            </div>

            {book.chapters_confirmed === false && (
              <div className="manage-chapters-warn">
                <p className="body-medium">
                  Los capítulos de <b>{book.title}</b> son provisionales, porque entró
                  como candidato de una votación. Confírmalos: el candado anti-spoiler
                  depende de ese número.
                </p>
                <div className="manage-chapters-warn__row">
                  <input
                    className="tz-input body-medium"
                    type="number"
                    min={1}
                    max={500}
                    inputMode="numeric"
                    placeholder="Nº de capítulos"
                    aria-label={`Número de capítulos de ${book.title}`}
                    value={chaptersDraft}
                    onChange={(e) => setChaptersDraft(e.target.value)}
                  />
                  <md-filled-button
                    disabled={busy || !chaptersDraft.trim() || undefined}
                    onClick={() => void confirmarCapitulos()}
                  >
                    Confirmar
                  </md-filled-button>
                </div>
              </div>
            )}

            <div className="manage-reading-actions">
              <md-outlined-button disabled={busy || undefined} onClick={() => void cerrarLectura()}>
                Cerrar la lectura
              </md-outlined-button>
              <md-text-button disabled={busy || undefined} onClick={() => void estrenar()}>
                Abrir las reseñas ya
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => setPidiendoBis((v) => !v)}>
                {pidiendoBis ? 'Cancelar el bis' : 'Pedir el bis'}
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => setCambiandoLibro((v) => !v)}>
                {cambiandoLibro ? 'Cancelar' : 'Cambiar de libro'}
              </md-text-button>
            </div>
          </>
        ) : (
          <p className="body-medium on-surface-variant">
            El club no tiene libro ahora mismo. Elige uno abajo o abre una votación.
          </p>
        )}

        {pidiendoBis && (
          <div className="manage-bis">
            <p className="body-medium">
              <b>El bis</b> es la lectura extra de este mes, la que se pide cuando el club
              se ha ventilado el libro antes de tiempo. Queda marcada como tal en el
              historial.
            </p>
            <div className="manage-book-picker">
              {books
                .filter((b) => b.id !== club.current_book_id)
                .map((b) => (
                  <button
                    key={b.id}
                    className="manage-book"
                    disabled={busy || undefined}
                    onClick={() => void pedirBis(b.id)}
                  >
                    <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="sm" />
                    <span className="label-small manage-book__title">{b.title}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {(cambiandoLibro || !book) && (
          <div className="manage-book-picker">
            {books
              .filter((b) => b.id !== club.current_book_id)
              .map((b) => (
                <button
                  key={b.id}
                  className="manage-book"
                  disabled={busy || undefined}
                  onClick={() => void setBookDelMes(b.id)}
                >
                  <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="sm" />
                  <span className="label-small manage-book__title">{b.title}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* ============ 3 · La próxima lectura ============ */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">La próxima lectura</h2>
        <p className="body-small on-surface-variant">
          El libro ya elegido que todavía no habéis abierto. Se enseña en el Inicio de
          todos para que les dé tiempo a conseguirlo.
        </p>

        {club.next_book_id ? (
          <>
            <NextRead compacta />
            <div className="manage-reading-actions">
              <md-filled-button disabled={busy || undefined} onClick={() => void empezarProxima()}>
                Empezar ya esta lectura
              </md-filled-button>
              <md-text-button
                disabled={busy || undefined}
                onClick={() => setEligiendoProxima((v) => !v)}
              >
                {eligiendoProxima ? 'Cancelar' : 'Cambiarla'}
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => void fijarProxima(null)}>
                Quitarla
              </md-text-button>
            </div>
          </>
        ) : (
          <div className="manage-reading-actions">
            <md-outlined-button
              disabled={busy || undefined}
              onClick={() => setEligiendoProxima((v) => !v)}
            >
              {eligiendoProxima ? 'Cancelar' : 'Elegir la próxima lectura'}
            </md-outlined-button>
          </div>
        )}

        {eligiendoProxima && (
          <div className="manage-bis">
            <label className="label-medium" style={{ display: 'block', marginBottom: 10 }}>
              ¿Cuándo se empieza? Opcional
              <input
                className="tz-input body-medium"
                type="date"
                style={{ display: 'block', marginTop: 4, maxWidth: 200, fontSize: 16 }}
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
              />
            </label>
            <div className="manage-book-picker">
              {books
                .filter((b) => b.id !== club.current_book_id)
                .map((b) => (
                  <button
                    key={b.id}
                    className={`manage-book${b.id === club.next_book_id ? ' active' : ''}`}
                    disabled={busy || undefined}
                    onClick={() => void fijarProxima(b.id)}
                  >
                    <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="sm" />
                    <span className="label-small manage-book__title">{b.title}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ 4 · Cómo va el club ============ */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Cómo va el club</h2>

        {!book ? (
          <p className="body-medium on-surface-variant">
            Cuando el club tenga libro, aquí verás por dónde va cada uno.
          </p>
        ) : (
          <>
            <p className="body-medium capitan__resumen">
              {terminados > 0 && `${terminados} de ${avances.length} han terminado. `}
              {empezados === 0
                ? 'Todavía no ha empezado nadie.'
                : `El grupo va por el capítulo ${mediaGrupo} de media.`}
            </p>

            {lectores.length > 0 && (
              <BookMap
                totalChapters={total}
                myChapter={yo?.chapter ?? 0}
                heat={heat}
                readers={lectores}
              />
            )}

            <div className="capitan__avances">
              {avances.map((a) => {
                const pct = total > 0 ? Math.round((a.chapter / total) * 100) : 0
                return (
                  <div key={a.id} className="capitan__avance">
                    <Avatar name={a.name} url={a.avatar} size={36} />
                    <div className="capitan__avance-main">
                      <span className="title-small">
                        {a.name}
                        {a.isMe && (
                          <span className="body-small on-surface-variant"> · tú</span>
                        )}
                      </span>
                      <div className="capitan__avance-barra">
                        <ProgressBar percent={pct} />
                        <span className="label-medium on-surface-variant capitan__avance-cap">
                          {a.status === 'finished'
                            ? 'Terminado'
                            : a.chapter > 0
                              ? `Cap. ${a.chapter}`
                              : 'Sin empezar'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {isSuperAdmin && (
        <div className="manage-card capitan__admin">
          <p className="body-medium">
            Los ajustes del club, la capitanía y los miembros están en la{' '}
            <button
              type="button"
              className="capitan__enlace"
              onClick={() => navigate('/club/admin')}
            >
              administración del club
            </button>
            .
          </p>
        </div>
      )}
    </section>
  )
}
