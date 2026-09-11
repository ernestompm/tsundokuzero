import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { clubActual, olvidarClub } from '../../lib/clubCache'
import { useAuth } from '../../auth/AuthContext'
import { useConfirm } from '../../components/ConfirmProvider'
import { Avatar, BookCover, ProgressBar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import ReadyStrip from '../../components/ReadyStrip'
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
 * Capitanía.
 *
 * DISEÑO (reescrito otra vez, y con razón). La versión anterior seguía
 * siendo un panel: tres tarjetas con título de carpeta —«Lo que leéis
 * ahora», «Lo que viene después», «Cómo va el club»— y dentro de cada una,
 * botones. El capitán entraba y tenía que leerse la pantalla entera para
 * deducir qué le tocaba hacer.
 *
 * Un capitán no quiere un panel: quiere que le digan qué toca. Así que
 * ahora hay UNA frase arriba que dice en qué momento está el club y UN
 * botón que hace lo siguiente. Todo lo demás —los otros hilos abiertos,
 * las acciones raras— baja a una lista de líneas tranquilas que no piden
 * nada.
 *
 * El orden de urgencia, que es lo único que hay que entender aquí:
 *   1. faltan los capítulos  → sin eso el candado anti-spoiler no funciona
 *   2. estáis leyendo        → terminar cuando toque
 *   3. hay próxima elegida   → arrancarla (y ver quién tiene ya el libro)
 *   4. hay votación          → no hacer nada, se cierra sola
 *   5. no hay nada           → abrir la votación
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
  /** qué panel secundario está abierto; 'ninguno' casi siempre */
  const [panel, setPanel] = useState<
    'ninguno' | 'proxima' | 'ahora' | 'bis' | 'votar' | 'gente'
  >('ninguno')
  const [proximaFecha, setProximaFecha] = useState('')

  const load = useCallback(async () => {
    if (!session) return

    // Esta pantalla cambia el club constantemente: la caché compartida no
    // puede servir datos viejos aquí.
    olvidarClub()

    // La votación puede haber vencido mientras nadie miraba (migr. 031)
    await supabase.rpc('close_poll_if_due')

    const c = await clubActual()
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
    setPanel('ninguno')
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

  /* ============ Dónde está el club ============ */

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

  const faltanCapitulos = !!book && book.chapters_confirmed === false
  const todosTerminados = avances.length > 0 && terminados === avances.length

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

  /* ---------- El titular: una frase y un botón ---------- */

  let titular: string
  let detalle: string
  let accion: React.ReactNode = null

  if (faltanCapitulos) {
    titular = `Faltan los capítulos de «${book!.title}»`
    detalle =
      'Entró como candidato de una votación, así que su número de capítulos es provisional. El candado anti-spoiler depende de ese número: hasta que lo confirmes, nadie está protegido del todo.'
    accion = (
      <div className="capi__fila">
        <input
          className="tz-input body-medium capi__num"
          type="number"
          min={1}
          max={500}
          inputMode="numeric"
          placeholder="Nº de capítulos"
          aria-label={`Número de capítulos de ${book!.title}`}
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
    )
  } else if (book) {
    titular = todosTerminados
      ? 'Lo habéis terminado todos'
      : empezados === 0
        ? `Nadie ha abierto «${book.title}» todavía`
        : `El club va por el capítulo ${mediaGrupo} de ${total}`
    detalle = todosTerminados
      ? nextBook
        ? `Ciérralo y arranca «${nextBook.title}»: se abren las reseñas de todos a la vez.`
        : 'Ciérralo y se abren las reseñas de todos a la vez. Es el estreno.'
      : empezados === 0
        ? 'Dale unos días. Cuando alguien marque su progreso lo verás aquí.'
        : `Han terminado ${terminados} de ${avances.length}. Cuando termine el último se abren las reseñas.`
    accion = (
      <md-filled-button disabled={busy || undefined} onClick={() => void terminarLectura()}>
        {nextBook ? `Terminar y empezar «${nextBook.title}»` : 'Terminar la lectura'}
      </md-filled-button>
    )
  } else if (nextBook) {
    titular = `Toca empezar «${nextBook.title}»`
    detalle = club.next_starts_at
      ? `Estaba previsto para el ${fechaCorta(club.next_starts_at)}. Arráncalo cuando lo tengáis.`
      : 'Ya está elegido. Solo falta que le des al botón para que todos puedan marcar progreso.'
    accion = (
      <md-filled-button disabled={busy || undefined} onClick={() => void empezarProxima()}>
        Empezar «{nextBook.title}»
      </md-filled-button>
    )
  } else if (votacion) {
    titular = 'Estáis votando. No tienes que hacer nada'
    detalle = `Han votado ${votacion.votos} de ${votacion.miembros}. Se cierra sola en cuanto vote el último${
      votacion.closesAt ? `, y como muy tarde el ${fechaCorta(votacion.closesAt)}` : ''
    }.`
    accion = (
      <div className="capi__votos">
        <ProgressBar
          percent={
            votacion.miembros > 0
              ? Math.round((votacion.votos / votacion.miembros) * 100)
              : 0
          }
        />
      </div>
    )
  } else {
    titular = 'El club no está leyendo nada'
    detalle =
      'Pega los ISBN o busca los títulos y la votación se abre sola. Se cerrará cuando haya votado todo el club.'
    accion = (
      <md-filled-button disabled={busy || undefined} onClick={() => setPanel('votar')}>
        Abrir una votación
      </md-filled-button>
    )
  }

  /** Una línea tranquila de las de abajo. */
  const linea = (
    icono: string,
    texto: React.ReactNode,
    acciones: React.ReactNode,
  ) => (
    <div className="capi__linea">
      <span className="material-symbols-rounded capi__linea-icono" aria-hidden="true">
        {icono}
      </span>
      <span className="body-medium capi__linea-txt">{texto}</span>
      <span className="capi__linea-acciones">{acciones}</span>
    </div>
  )

  return (
    <section className="club-manage capitania">
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

      {/* ============ Lo que toca ahora ============ */}
      <div className={`capi__hero${faltanCapitulos ? ' capi__hero--alerta' : ''}`}>
        <span className="label-medium capi__kicker">Lo que toca ahora</span>
        <h2 className="title-large serif capi__titular">{titular}</h2>
        <p className="body-medium capi__detalle">{detalle}</p>
        <div className="capi__accion">{accion}</div>

        {/* Quién tiene ya el libro: lo que de verdad decide si se arranca */}
        {!book && nextBook && <ReadyStrip bookId={nextBook.id} />}

        {panel === 'votar' && (
          <div className="capi__panel">
            <PollComposer
              onCreated={() => {
                setBanner({ kind: 'info', text: 'Votación abierta. El club ya tiene el aviso.' })
                setPanel('ninguno')
                void load()
              }}
              onCancel={() => setPanel('ninguno')}
            />
          </div>
        )}
      </div>

      {/* ============ Lo demás, sin pedir nada ============ */}
      <div className="capi__lista">
        {/* Votación en marcha mientras se lee: es información, no tarea */}
        {votacion && (book || nextBook) &&
          linea(
            'how_to_vote',
            <>
              <b>{votacion.title}</b> · han votado {votacion.votos} de{' '}
              {votacion.miembros}. Se cierra sola.
            </>,
            <>
              <md-text-button disabled={busy || undefined} onClick={() => void cerrarVotacionYa()}>
                Cerrarla ya
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => void descartarVotacion()}>
                Descartarla
              </md-text-button>
            </>,
          )}

        {votacion && !book && !nextBook &&
          linea(
            'how_to_vote',
            <>Si tienes prisa, puedes cerrarla o tirarla.</>,
            <>
              <md-text-button disabled={busy || undefined} onClick={() => void cerrarVotacionYa()}>
                Cerrarla ya
              </md-text-button>
              <md-text-button disabled={busy || undefined} onClick={() => void descartarVotacion()}>
                Descartarla
              </md-text-button>
            </>,
          )}

        {/* La próxima lectura, cuando ya se está leyendo otra cosa */}
        {book && nextBook &&
          linea(
            'menu_book',
            <>
              Después toca <b>{nextBook.title}</b>
              {club.next_starts_at ? `, el ${fechaCorta(club.next_starts_at)}` : ''}. Ya
              sale en el Inicio de todos.
            </>,
            <>
              <md-text-button
                disabled={busy || undefined}
                onClick={() => setPanel(panel === 'proxima' ? 'ninguno' : 'proxima')}
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
            </>,
          )}

        {/* Elegir la próxima a dedo, sin pasar por votación */}
        {book && !nextBook && !votacion &&
          linea(
            'menu_book',
            <>Todavía no hay próxima lectura. Se puede votar o elegirla a dedo.</>,
            <>
              <md-text-button disabled={busy || undefined} onClick={() => setPanel('votar')}>
                Abrir votación
              </md-text-button>
              <md-text-button
                disabled={busy || undefined}
                onClick={() => setPanel(panel === 'proxima' ? 'ninguno' : 'proxima')}
              >
                Elegirla
              </md-text-button>
            </>,
          )}

        {/* El bis: la lectura extra cuando el club se ventila el libro */}
        {book &&
          linea(
            'auto_stories',
            <>
              <b>El bis</b> es la lectura extra de este mes, la que se pide cuando
              os habéis ventilado el libro antes de tiempo.
            </>,
            <md-text-button
              disabled={busy || undefined}
              onClick={() => setPanel(panel === 'bis' ? 'ninguno' : 'bis')}
            >
              Pedir el bis
            </md-text-button>,
          )}

        {/* Cosas raras, que existen pero casi nunca hacen falta */}
        {book &&
          linea(
            'lock_open',
            <>
              Abrir las reseñas sin esperar al último. El estreno deja de ser una
              sorpresa, pero a veces hace falta.
            </>,
            <md-text-button
              disabled={busy || undefined}
              onClick={() =>
                void hecho('Reseñas abiertas para todo el club.', async () =>
                  supabase.rpc('premiere_reviews'),
                )
              }
            >
              Abrir reseñas ya
            </md-text-button>,
          )}

        {linea(
          'edit',
          <>Cambiar el libro del club a dedo, sin cerrar el actual.</>,
          <md-text-button
            disabled={busy || undefined}
            onClick={() => setPanel(panel === 'ahora' ? 'ninguno' : 'ahora')}
          >
            Cambiar de libro
          </md-text-button>,
        )}

        {isSuperAdmin &&
          linea(
            'settings',
            <>Emblema, capitanía, miembros y enlaces de compra.</>,
            <md-text-button onClick={() => navigate('/club/admin')}>
              Administrar el club
            </md-text-button>,
          )}
      </div>

      {/* Paneles que abre una de las líneas de arriba */}
      {panel === 'bis' && (
        <div className="manage-card">
          <h2 className="title-small manage-card__title">Elegir el bis</h2>
          {selector((id) =>
            void hecho('¡Bis en marcha!', async () =>
              supabase.rpc('start_club_bis', { p_book: id }),
            ),
          )}
        </div>
      )}

      {panel === 'ahora' && (
        <div className="manage-card">
          <h2 className="title-small manage-card__title">
            {book ? 'Cambiar el libro del club' : 'Elegir libro'}
          </h2>
          {selector((id) =>
            void hecho('Libro del club cambiado.', async () =>
              supabase.from('clubs').update({ current_book_id: id }).eq('id', club.id),
            ),
          )}
        </div>
      )}

      {panel === 'proxima' && (
        <div className="manage-card">
          <h2 className="title-small manage-card__title">Elegir la próxima lectura</h2>
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
        </div>
      )}

      {/* ============ Cómo va cada uno ============ */}
      {book && lectores.length > 0 && (
        <div className="manage-card">
          <h2 className="title-small manage-card__title">Cómo va cada uno</h2>

          <BookMap
            totalChapters={total}
            myChapter={yo?.chapter ?? 0}
            heat={heat}
            readers={lectores}
          />

          <button
            type="button"
            className="capitan__mas label-medium"
            onClick={() => setPanel(panel === 'gente' ? 'ninguno' : 'gente')}
          >
            {panel === 'gente' ? 'Ocultar el detalle' : 'Ver capítulo por capítulo'}
          </button>

          {panel === 'gente' && (
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
          )}
        </div>
      )}
    </section>
  )
}
