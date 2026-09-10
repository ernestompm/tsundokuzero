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
import type { Book, Club } from '../../lib/database.types'
import './club.css'
import './captainpage.css'

interface Avance {
  id: string
  name: string
  avatar: string | null
  chapter: number
  status: 'reading' | 'finished' | 'want' | null
  isMe: boolean
}

interface Votacion {
  id: string
  title: string
  votos: number
  miembros: number
  closesAt: string | null
}

function fechaCorta(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Capitanía: el puesto de mando del capitán.
 *
 * DISEÑO. Antes era un panel de control con diez botones sueltos y había
 * que saberse el orden de las cosas. El ciclo del club es en realidad muy
 * simple y siempre está en uno de cuatro momentos:
 *
 *   sin nada  →  votando  →  elegido, sin empezar  →  leyendo  →  ...
 *
 * Así que la pantalla enseña en qué momento estás y CUÁL ES EL PASO
 * SIGUIENTE, uno solo y destacado. El resto de acciones existen, pero
 * viven detrás de «Más opciones» porque casi nunca hacen falta.
 *
 * La votación además ya no depende de que el capitán se acuerde: se cierra
 * sola cuando vota el último o cuando llega su fecha (migr. 031).
 */
export default function CaptainPage() {
  const { session, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [club, setClub] = useState<Club | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [nextBook, setNextBook] = useState<Book | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [avances, setAvances] = useState<Avance[]>([])
  const [heat, setHeat] = useState<Map<number, number>>(new Map())
  const [votacion, setVotacion] = useState<Votacion | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [chaptersDraft, setChaptersDraft] = useState('')
  const [masOpciones, setMasOpciones] = useState(false)
  const [eligiendo, setEligiendo] = useState<'ninguno' | 'proxima' | 'ahora' | 'bis'>('ninguno')
  const [proximaFecha, setProximaFecha] = useState('')

  const load = useCallback(async () => {
    if (!session) return

    // La votación puede haber vencido mientras nadie miraba (migr. 031)
    await supabase.rpc('close_poll_if_due')

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
        .from('poll_progress')
        .select('poll_id, title, votos, miembros, closes_at')
        .eq('club_id', c.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle(),
    ])
    setBooks(bookRows ?? [])
    setBook((bookRows ?? []).find((b) => b.id === c.current_book_id) ?? null)
    setNextBook((bookRows ?? []).find((b) => b.id === c.next_book_id) ?? null)
    setVotacion(
      poll
        ? {
            id: poll.poll_id,
            title: poll.title,
            votos: poll.votos,
            miembros: poll.miembros,
            closesAt: poll.closes_at,
          }
        : null,
    )

    const roleById = new Map((memberRows ?? []).map((m) => [m.user_id, m.role]))
    setAllowed(roleById.get(session.user.id) === 'captain' || isSuperAdmin)

    const ids = (memberRows ?? []).map((m) => m.user_id)
    if (ids.length > 0 && c.current_book_id) {
      const [{ data: perfiles }, { data: progresos }, { data: discusiones }] =
        await Promise.all([
          supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids),
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

  const hecho = async (texto: string, fn: () => Promise<{ error: unknown }>) => {
    setBusy(true)
    setBanner(null)
    const { error } = await fn()
    setBanner(
      error
        ? { kind: 'error', text: friendlyError(error, 'No se pudo completar la acción.') }
        : { kind: 'info', text: texto },
    )
    setBusy(false)
    setEligiendo('ninguno')
    await load()
  }

  const terminarLectura = async () => {
    const conSiguiente = !!nextBook
    const ok = await confirm({
      title: conSiguiente ? `¿Terminar y empezar «${nextBook!.title}»?` : '¿Terminar la lectura?',
      message: conSiguiente
        ? 'Se abren las reseñas del libro actual, pasa al historial y el club arranca el siguiente.'
        : 'Se abren las reseñas de todos y el libro pasa al historial. Lo hablado se conserva.',
      confirmLabel: conSiguiente ? 'Terminar y empezar' : 'Terminar',
    })
    if (!ok) return
    await hecho(
      conSiguiente ? `¡En marcha «${nextBook!.title}»!` : 'Lectura cerrada y reseñas abiertas.',
      async () =>
        conSiguiente
          ? await supabase.rpc('finish_and_start_next')
          : await supabase.rpc('close_club_reading'),
    )
  }

  const empezarProxima = async () => {
    const ok = await confirm({
      title: `¿Empezar «${nextBook?.title}»?`,
      message: 'Pasa a ser el libro del club y todos podrán marcar su progreso.',
      confirmLabel: 'Empezar',
    })
    if (!ok) return
    await hecho('¡En marcha! Ya es el libro del club.', async () =>
      supabase.rpc('start_next_reading'),
    )
  }

  const confirmarCapitulos = async () => {
    if (!book) return
    const n = parseInt(chaptersDraft, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setBanner({ kind: 'info', text: 'Escribe cuántos capítulos tiene, entre 1 y 500.' })
      return
    }
    setChaptersDraft('')
    await hecho('Capítulos confirmados.', async () =>
      supabase.rpc('set_book_chapters', { p_book: book.id, p_total: n }),
    )
  }

  const cerrarVotacionYa = async () => {
    if (!votacion) return
    const ok = await confirm({
      title: 'Cerrar la votación ahora',
      message:
        'Se cerraría sola al votar todos o al llegar su fecha. Si la cierras ya, gana la más votada hasta este momento.',
      confirmLabel: 'Cerrar ahora',
    })
    if (!ok) return
    await hecho('Votación cerrada. La ganadora es ya la próxima lectura.', async () =>
      supabase.from('polls').update({ status: 'closed' }).eq('id', votacion.id),
    )
  }

  const descartarVotacion = async () => {
    if (!votacion) return
    const ok = await confirm({
      title: 'Descartar la votación',
      message: `«${votacion.title}» se borra sin elegir ninguna ganadora. Podrás abrir otra.`,
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (!ok) return
    await hecho('Votación descartada.', async () =>
      supabase.from('polls').delete().eq('id', votacion.id),
    )
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

  const elegibles = books.filter(
    (b) => b.id !== club.current_book_id && b.id !== club.next_book_id,
  )

  /** Rejilla de portadas para elegir libro, compartida por los tres casos. */
  const selector = (onPick: (id: string) => void) => (
    <div className="manage-book-picker">
      {elegibles.map((b) => (
        <button
          key={b.id}
          className="manage-book"
          disabled={busy || undefined}
          onClick={() => onPick(b.id)}
        >
          <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="sm" />
          <span className="label-small manage-book__title">{b.title}</span>
        </button>
      ))}
      {elegibles.length === 0 && (
        <p className="body-small on-surface-variant">
          No hay más libros en el catálogo. Añade uno desde tu biblioteca.
        </p>
      )}
    </div>
  )

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

      {/* ================= 1 · Lo que el club lee ahora ================= */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Lo que leéis ahora</h2>

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
                <br />
                <span className="body-small on-surface-variant">
                  {empezados === 0
                    ? 'Todavía no ha empezado nadie'
                    : terminados === avances.length
                      ? 'Lo habéis terminado todos'
                      : `${terminados} de ${avances.length} terminados · el grupo va por el ${mediaGrupo}`}
                </span>
              </span>
            </div>

            {book.chapters_confirmed === false && (
              <div className="manage-chapters-warn">
                <p className="body-medium">
                  Los capítulos son provisionales, porque el libro entró como candidato de
                  una votación. Confírmalos: el candado anti-spoiler depende de ese número.
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

            {/* El paso siguiente, uno solo y destacado */}
            <div className="capitan__paso">
              <md-filled-button disabled={busy || undefined} onClick={() => void terminarLectura()}>
                {nextBook ? `Terminar y empezar «${nextBook.title}»` : 'Terminar la lectura'}
              </md-filled-button>
              <span className="body-small on-surface-variant">
                {nextBook
                  ? 'Se abren las reseñas de este y arranca el siguiente.'
                  : 'Se abren las reseñas de todos y pasa al historial.'}
              </span>
            </div>

            <button
              type="button"
              className="capitan__mas label-medium"
              onClick={() => setMasOpciones((v) => !v)}
            >
              {masOpciones ? 'Menos opciones' : 'Más opciones'}
            </button>

            {masOpciones && (
              <div className="capitan__extras">
                <md-text-button
                  disabled={busy || undefined}
                  onClick={() =>
                    void hecho('Reseñas abiertas para todo el club.', async () =>
                      supabase.rpc('premiere_reviews'),
                    )
                  }
                >
                  Abrir las reseñas ya
                </md-text-button>
                <md-text-button
                  disabled={busy || undefined}
                  onClick={() => setEligiendo(eligiendo === 'bis' ? 'ninguno' : 'bis')}
                >
                  Pedir el bis
                </md-text-button>
                <md-text-button
                  disabled={busy || undefined}
                  onClick={() => setEligiendo(eligiendo === 'ahora' ? 'ninguno' : 'ahora')}
                >
                  Cambiar de libro
                </md-text-button>
              </div>
            )}

            {eligiendo === 'bis' && (
              <div className="manage-bis">
                <p className="body-medium">
                  <b>El bis</b> es la lectura extra de este mes, la que se pide cuando el
                  club se ha ventilado el libro antes de tiempo.
                </p>
                {selector((id) =>
                  void hecho('¡Bis en marcha!', async () =>
                    supabase.rpc('start_club_bis', { p_book: id }),
                  ),
                )}
              </div>
            )}

            {eligiendo === 'ahora' &&
              selector((id) =>
                void hecho('Libro del club cambiado.', async () =>
                  supabase.from('clubs').update({ current_book_id: id }).eq('id', club.id),
                ),
              )}
          </>
        ) : (
          <>
            <p className="body-medium on-surface-variant">
              El club no está leyendo nada ahora mismo.
            </p>
            {nextBook ? (
              <div className="capitan__paso">
                <md-filled-button disabled={busy || undefined} onClick={() => void empezarProxima()}>
                  Empezar «{nextBook.title}»
                </md-filled-button>
                <span className="body-small on-surface-variant">
                  Ya lo habéis elegido. Solo falta arrancarlo.
                </span>
              </div>
            ) : (
              <div className="capitan__paso">
                <md-outlined-button
                  disabled={busy || undefined}
                  onClick={() => setEligiendo(eligiendo === 'ahora' ? 'ninguno' : 'ahora')}
                >
                  Elegir un libro directamente
                </md-outlined-button>
                <span className="body-small on-surface-variant">
                  O abre una votación abajo y que lo decida el club.
                </span>
              </div>
            )}
            {eligiendo === 'ahora' &&
              selector((id) =>
                void hecho('Ya tenéis libro.', async () =>
                  supabase.from('clubs').update({ current_book_id: id }).eq('id', club.id),
                ),
              )}
          </>
        )}
      </div>

      {/* ================= 2 · Lo que viene después ================= */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Lo que viene después</h2>

        {votacion ? (
          /* --- Votando --- */
          <>
            <div className="capitan__votacion">
              <span className="title-small">{votacion.title}</span>
              <div className="capitan__votos">
                <ProgressBar
                  percent={
                    votacion.miembros > 0
                      ? Math.round((votacion.votos / votacion.miembros) * 100)
                      : 0
                  }
                />
                <span className="label-medium on-surface-variant">
                  {votacion.votos} de {votacion.miembros}
                </span>
              </div>
              <p className="body-small on-surface-variant">
                Se cierra sola en cuanto vote todo el mundo
                {votacion.closesAt ? `, y como muy tarde el ${fechaCorta(votacion.closesAt)}` : ''}.
                No tienes que hacer nada.
              </p>
            </div>
            <div className="capitan__extras">
              <md-text-button disabled={busy || undefined} onClick={() => void cerrarVotacionYa()}>
                Cerrarla ya
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => void descartarVotacion()}>
                Descartarla
              </md-text-button>
            </div>
          </>
        ) : nextBook ? (
          /* --- Ya elegido, esperando a empezar --- */
          <>
            <div className="manage-current-book">
              <BookCover
                title={nextBook.title}
                author={nextBook.author}
                coverUrl={nextBook.cover_url}
                size="md"
              />
              <span className="body-medium">
                <b>{nextBook.title}</b>
                <br />
                <span className="on-surface-variant">{nextBook.author}</span>
                <br />
                <span className="body-small on-surface-variant">
                  {club.next_starts_at
                    ? `Se empieza el ${fechaCorta(club.next_starts_at)}`
                    : 'Sin fecha de comienzo'}
                </span>
              </span>
            </div>
            <p className="body-small on-surface-variant">
              Ya sale en el Inicio de todos para que les dé tiempo a conseguirlo.
              {book ? ' Se arranca al terminar la lectura de ahora.' : ''}
            </p>
            <div className="capitan__extras">
              <md-text-button
                disabled={busy || undefined}
                onClick={() => setEligiendo(eligiendo === 'proxima' ? 'ninguno' : 'proxima')}
              >
                Cambiarla
              </md-text-button>
              <md-text-button
                disabled={busy || undefined}
                onClick={() =>
                  void hecho('Próxima lectura retirada.', async () =>
                    supabase.rpc('set_next_book', { p_book: null }),
                  )
                }
              >
                Quitarla
              </md-text-button>
            </div>
            {eligiendo === 'proxima' &&
              selector((id) =>
                void hecho('Próxima lectura cambiada.', async () =>
                  supabase.rpc('set_next_book', { p_book: id, p_starts_at: null }),
                ),
              )}
          </>
        ) : (
          /* --- Nada decidido: abrir votación o elegir a dedo --- */
          <>
            <p className="body-small on-surface-variant">
              Pega los ISBN o busca los títulos y la votación se abre sola. Se cerrará
              cuando haya votado todo el club o al llegar su fecha.
            </p>
            <PollComposer
              onCreated={() => {
                setBanner({ kind: 'info', text: 'Votación abierta. El club ya tiene el aviso.' })
                void load()
              }}
              onCancel={() => setBanner(null)}
            />
            <div className="capitan__extras">
              <md-text-button
                disabled={busy || undefined}
                onClick={() => setEligiendo(eligiendo === 'proxima' ? 'ninguno' : 'proxima')}
              >
                O elegir la próxima sin votación
              </md-text-button>
            </div>
            {eligiendo === 'proxima' && (
              <>
                <label className="label-medium capitan__fecha">
                  ¿Cuándo se empieza? Opcional
                  <input
                    className="tz-input body-medium"
                    type="date"
                    value={proximaFecha}
                    onChange={(e) => setProximaFecha(e.target.value)}
                  />
                </label>
                {selector((id) =>
                  void hecho('Próxima lectura fijada.', async () =>
                    supabase.rpc('set_next_book', {
                      p_book: id,
                      p_starts_at: proximaFecha
                        ? new Date(proximaFecha + 'T09:00:00').toISOString()
                        : null,
                    }),
                  ),
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ================= 3 · Cómo va el club ================= */}
      {book && (
        <div className="manage-card">
          <h2 className="title-small manage-card__title">Cómo va el club</h2>

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
                      {a.isMe && <span className="body-small on-surface-variant"> · tú</span>}
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
        </div>
      )}

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
