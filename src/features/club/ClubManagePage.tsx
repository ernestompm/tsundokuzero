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
import { Avatar, BookCover } from '../../components/ui'
import BookForm from '../../components/BookForm'
import PollComposer from './PollComposer'
import PageHeader from '../../components/PageHeader'
import type { Book, Club } from '../../lib/database.types'
import './club.css'

interface Member {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  role: string
}

export default function ClubManagePage() {
  const { session, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [openPoll, setOpenPoll] = useState<{ id: string; title: string } | null>(
    null,
  )
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  // Aviso inline en lugar de window.alert (auditoría M-04)
  const [banner, setBanner] = useState<{
    kind: 'error' | 'info'
    text: string
  } | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Crear votación: se eligen LIBROS DEL CATÁLOGO (2–5)

  // Cuota de la capitanía (3 libros por mandato)
  const [booksLeft, setBooksLeft] = useState<number | null>(null)
  // Capítulos provisionales (migr. 027): un libro creado como candidato de
  // una votación entra con un número estimado que hay que confirmar antes
  // de leerlo, o el candado anti-spoiler trabaja con datos falsos.
  const [chaptersDraft, setChaptersDraft] = useState('')
  // «El bis» (migr. 028): la lectura extra que se pide cuando el club se
  // ventila el libro del mes antes de tiempo.
  const [pidiendoBis, setPidiendoBis] = useState(false)
  const [addingBook, setAddingBook] = useState(false)

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
    setName(c.name)
    setDescription(c.description ?? '')

    const [{ data: memberRows }, { data: bookRows }, { data: poll }, { data: left }] =
      await Promise.all([
        supabase.from('club_members').select('user_id, role').eq('club_id', c.id),
        supabase.from('books').select('*').order('title'),
        supabase
          .from('polls')
          .select('id, title')
          .eq('club_id', c.id)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle(),
        supabase.rpc('captain_books_left'),
      ])
    setBooks(bookRows ?? [])
    setOpenPoll(poll ?? null)
    setBooksLeft(typeof left === 'number' ? left : 0)

    const roleById = new Map((memberRows ?? []).map((m) => [m.user_id, m.role]))
    const ids = (memberRows ?? []).map((m) => m.user_id)
    const { data: profiles } = ids.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', ids)
      : { data: [] }
    setMembers(
      (profiles ?? [])
        .map((p) => ({ ...p, role: roleById.get(p.id) ?? 'member' }))
        .sort((a) => (a.role === 'captain' ? -1 : 1)),
    )

    const iAmCaptain = roleById.get(session.user.id) === 'captain'
    setAllowed(iAmCaptain || isSuperAdmin)
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

  const saveInfo = async () => {
    setBanner(null)
    setBusy(true)
    const { error } = await supabase
      .from('clubs')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', club.id)
    // Auditoría A-04: guardar también puede fallar y hay que decirlo
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudieron guardar los datos del club. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }

  const setBook = async (bookId: string) => {
    setBanner(null)
    setBusy(true)
    const { error } = await supabase
      .from('clubs')
      .update({ current_book_id: bookId })
      .eq('id', club.id)
    // Auditoría A-04
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo cambiar el libro del mes. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }

  const makeCaptain = async (userId: string, name: string) => {
    // Auditoría M-04: diálogo propio en lugar de window.confirm
    if (
      !(await confirm({
        title: 'Transferir capitanía',
        message: `¿Nombrar capitán a ${name}? Dejarás de serlo tú.`,
        confirmLabel: 'Nombrar capitán',
      }))
    )
      return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.rpc('transfer_captaincy', {
      club: club.id,
      new_captain: userId,
    })
    // Auditoría A-04: si la RPC falla, el capitán seguía creyéndose relevado
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo transferir la capitanía. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }

  const kick = async (userId: string, name: string) => {
    // Auditoría M-04: diálogo propio en lugar de window.confirm
    if (
      !(await confirm({
        title: 'Expulsar del club',
        message: `¿Expulsar a ${name} del club?`,
        confirmLabel: 'Expulsar',
        danger: true,
      }))
    )
      return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.rpc('club_kick_member', {
      club: club.id,
      target: userId,
    })
    // Auditoría A-04: nada de error.message crudo al usuario
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo expulsar al miembro. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }

  const cerrarLectura = async () => {
    const ok = await confirm({
      title: '¿Cerrar la lectura del club?',
      message:
        'El libro pasa al historial y deja de aparecer como conversación activa. Lo leído y lo hablado se conserva.',
      confirmLabel: 'Cerrar lectura',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.rpc('close_club_reading')
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo cerrar la lectura.') })
    else setBanner({ kind: 'info', text: 'Lectura cerrada. Ya está en el historial del club.' })
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

  const confirmChapters = async () => {
    if (!currentBook) return
    const n = parseInt(chaptersDraft, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setBanner({ kind: 'info', text: 'Escribe cuántos capítulos tiene, entre 1 y 500.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('set_book_chapters', {
      p_book: currentBook.id,
      p_total: n,
    })
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo guardar el número de capítulos.') })
    else {
      setBanner({ kind: 'info', text: 'Capítulos confirmados. Ya se puede leer con el candado bien puesto.' })
      setChaptersDraft('')
    }
    setBusy(false)
    await load()
  }

  const discardPoll = async () => {
    if (!openPoll) return
    // Auditoría M-04: diálogo propio en lugar de window.confirm
    if (
      !(await confirm({
        title: 'Descartar votación',
        message: `«${openPoll.title}» se borra sin aplicar ninguna ganadora ni cambiar el libro. Podrás crear una nueva.`,
        confirmLabel: 'Descartar',
        danger: true,
      }))
    )
      return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.from('polls').delete().eq('id', openPoll.id)
    // Auditoría A-04
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo descartar la votación. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }

  const closePollWithWinner = async () => {
    if (!openPoll) return
    // Auditoría M-04: diálogo propio en lugar de window.confirm
    if (
      !(await confirm({
        title: 'Cerrar votación',
        message: 'La opción más votada quedará como ganadora. ¿Continuar?',
        confirmLabel: 'Cerrar votación',
      }))
    )
      return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase
      .from('polls')
      .update({ status: 'closed' })
      .eq('id', openPoll.id)
    // Auditoría A-04
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudo cerrar la votación. Inténtalo de nuevo.'),
      })
    await load()
    setBusy(false)
  }


  const currentBook = books.find((b) => b.id === club.current_book_id)

  return (
    <section className="club-manage">
      <PageHeader
        title="Gestión del club"
        sub={club.name}
        action={
          <md-text-button onClick={() => navigate('/club')}>Volver</md-text-button>
        }
      />

      {/* Aviso inline (auditoría M-04): sustituye a window.alert */}
      {banner && (
        <p
          className={`club-banner body-medium${
            banner.kind === 'error' ? ' club-banner--error' : ''
          }`}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </p>
      )}

      {/* Datos del club */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Datos del club</h2>
        {/* Auditoría A-08: inputs con etiqueta accesible */}
        <input
          className="tz-input body-medium"
          placeholder="Nombre del club"
          aria-label="Nombre del club"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="tz-input manage-textarea body-medium"
          rows={2}
          placeholder="Descripción"
          aria-label="Descripción del club"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <md-filled-button disabled={busy || undefined} onClick={() => void saveInfo()}>
          Guardar
        </md-filled-button>
      </div>

      {/* Libro del mes */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Libro del mes</h2>
        {currentBook && (
          <div className="manage-current-book">
            <BookCover
              title={currentBook.title}
              author={currentBook.author}
              coverUrl={currentBook.cover_url}
              size="sm"
            />
            <span className="body-medium">
              <b>{currentBook.title}</b>
              <br />
              <span className="on-surface-variant">{currentBook.author}</span>
            </span>
          </div>
        )}
        {currentBook && currentBook.chapters_confirmed === false && (
          <div className="manage-chapters-warn">
            <p className="body-medium">
              <b>{currentBook.title}</b> entró como candidato de una votación, así que
              sus capítulos son provisionales. Confírmalos antes de que el club empiece:
              el candado anti-spoiler depende de ese número.
            </p>
            <div className="manage-chapters-warn__row">
              <input
                className="tz-input body-medium"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                placeholder="Nº de capítulos"
                aria-label={`Número de capítulos de ${currentBook.title}`}
                value={chaptersDraft}
                onChange={(e) => setChaptersDraft(e.target.value)}
              />
              <md-filled-button
                disabled={busy || !chaptersDraft.trim() || undefined}
                onClick={() => void confirmChapters()}
              >
                Confirmar
              </md-filled-button>
            </div>
          </div>
        )}

        {currentBook && (
          <div className="manage-reading-actions">
            <md-outlined-button disabled={busy || undefined} onClick={() => void cerrarLectura()}>
              Cerrar la lectura
            </md-outlined-button>
            <md-text-button
              disabled={busy || undefined}
              onClick={() => setPidiendoBis((v) => !v)}
            >
              {pidiendoBis ? 'Cancelar el bis' : 'Pedir el bis'}
            </md-text-button>
          </div>
        )}

        {pidiendoBis && (
          <div className="manage-bis">
            <p className="body-medium">
              <b>El bis</b> es la lectura extra de este mes, la que se pide cuando el
              club se ha ventilado el libro antes de tiempo. Elige cuál y queda
              registrado como tal en el historial.
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

        <p className="body-small on-surface-variant">Cambiar por:</p>
        <div className="manage-book-picker">
          {books.map((b) => (
            <button
              key={b.id}
              className={`manage-book${b.id === club.current_book_id ? ' active' : ''}`}
              disabled={busy || undefined}
              onClick={() => void setBook(b.id)}
            >
              <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="sm" />
              <span className="label-small manage-book__title">{b.title}</span>
            </button>
          ))}
        </div>
        {books.length === 0 && (
          <p className="body-small on-surface-variant">
            No hay libros en el catálogo. Añádelos desde Administración → Libros.
          </p>
        )}
      </div>

      {/* Votación */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Votación del próximo libro</h2>
        {openPoll ? (
          <>
            <p className="body-medium">
              Hay una votación abierta: <b>{openPoll.title}</b>.
            </p>
            <p className="body-small on-surface-variant">
              Para crear una nueva, primero cierra o descarta la actual.
            </p>
            <div className="club-poll__form-actions">
              <md-outlined-button
                disabled={busy || undefined}
                onClick={() => void discardPoll()}
              >
                <span slot="icon" className="material-symbols-rounded" aria-hidden="true">delete</span>
                Descartar (sin efecto)
              </md-outlined-button>
              <md-filled-button
                disabled={busy || undefined}
                onClick={() => void closePollWithWinner()}
              >
                Cerrar y aplicar ganadora
              </md-filled-button>
            </div>
          </>
        ) : (
          <>
            <p className="body-small on-surface-variant">
              Pega los ISBN o los títulos y la votación se abre sola. Los libros
              que no estén en el catálogo se crean por el camino.
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

      {/* Libros de tu capitanía (3 por mandato) */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">
          Libros de tu capitanía
        </h2>
        <p className="body-medium">
          {booksLeft === null
            ? '…'
            : booksLeft > 0
              ? `Puedes añadir ${booksLeft} de 3 libros en este mandato.`
              : 'Has agotado los 3 libros de este mandato. Si vuelves a ser capitán más adelante, tendrás 3 nuevos.'}
        </p>
        {(booksLeft ?? 0) > 0 &&
          (addingBook ? (
            <BookForm
              onCreated={() => {
                setAddingBook(false)
                void load()
              }}
              onCancel={() => setAddingBook(false)}
            />
          ) : (
            <md-outlined-button onClick={() => setAddingBook(true)}>
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">add</span>
              Añadir un libro ({booksLeft}/3 disponibles)
            </md-outlined-button>
          ))}
      </div>

      {/* Miembros */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Miembros ({members.length})</h2>
        <div className="club-members">
          {members.map((m) => (
            <div key={m.id} className="club-member">
              <span className="club-member__id">
                <Avatar name={m.display_name} url={m.avatar_url} size={38} />
                <span className="club-member__names">
                  <span className="title-small">
                    {m.display_name}
                    {m.role === 'captain' && (
                      <span
                        className="label-small"
                        style={{ color: 'var(--md-sys-color-primary)' }}
                      >
                        {' '}★ capitán
                      </span>
                    )}
                  </span>
                  <span className="body-small on-surface-variant">@{m.username}</span>
                </span>
              </span>
              {m.role !== 'captain' && (
                <div className="manage-member-actions">
                  <md-text-button
                    disabled={busy || undefined}
                    onClick={() => void makeCaptain(m.id, m.display_name)}
                  >
                    Capitán
                  </md-text-button>
                  <button
                    className="manage-kick"
                    aria-label={`Expulsar a ${m.display_name}`}
                    disabled={busy}
                    onClick={() => void kick(m.id, m.display_name)}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">person_remove</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invitar */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Invitar</h2>
        <p className="body-medium">
          Comparte la web y el código de invitación con tus amigos. Al
          registrarse y entrar, se unirán al club automáticamente.
        </p>
      </div>
    </section>
  )
}
