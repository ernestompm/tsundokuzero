import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover } from '../../components/ui'
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
  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [openPollId, setOpenPollId] = useState<string | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Crear votación
  const [pollTitle, setPollTitle] = useState('')
  const [options, setOptions] = useState([
    { title: '', author: '' },
    { title: '', author: '' },
  ])

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

    const [{ data: memberRows }, { data: bookRows }, { data: poll }] =
      await Promise.all([
        supabase.from('club_members').select('user_id, role').eq('club_id', c.id),
        supabase.from('books').select('*').order('title'),
        supabase
          .from('polls')
          .select('id')
          .eq('club_id', c.id)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle(),
      ])
    setBooks(bookRows ?? [])
    setOpenPollId(poll?.id ?? null)

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
    setBusy(true)
    await supabase
      .from('clubs')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', club.id)
    await load()
    setBusy(false)
  }

  const setBook = async (bookId: string) => {
    setBusy(true)
    await supabase.from('clubs').update({ current_book_id: bookId }).eq('id', club.id)
    await load()
    setBusy(false)
  }

  const makeCaptain = async (userId: string, name: string) => {
    if (!window.confirm(`¿Nombrar capitán a ${name}? Dejarás de serlo tú.`)) return
    setBusy(true)
    await supabase.rpc('transfer_captaincy', { club: club.id, new_captain: userId })
    await load()
    setBusy(false)
  }

  const kick = async (userId: string, name: string) => {
    if (!window.confirm(`¿Expulsar a ${name} del club?`)) return
    setBusy(true)
    const { error } = await supabase.rpc('club_kick_member', {
      club: club.id,
      target: userId,
    })
    if (error) window.alert(error.message)
    await load()
    setBusy(false)
  }

  const createPoll = async () => {
    const title = pollTitle.trim()
    const clean = options
      .map((o) => ({ title: o.title.trim(), author: o.author.trim() }))
      .filter((o) => o.title && o.author)
    if (!title || clean.length < 2) {
      window.alert('Pon un título y al menos dos opciones (libro + autor).')
      return
    }
    setBusy(true)
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({ club_id: club.id, title, created_by: session!.user.id })
      .select()
      .single()
    if (!error && poll) {
      await supabase.from('poll_options').insert(
        clean.map((o) => ({
          poll_id: poll.id,
          book_title: o.title,
          book_author: o.author,
        })),
      )
      setPollTitle('')
      setOptions([
        { title: '', author: '' },
        { title: '', author: '' },
      ])
    } else if (error) {
      window.alert(error.message)
    }
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

      {/* Datos del club */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Datos del club</h2>
        <input
          className="profile-input body-medium"
          placeholder="Nombre del club"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="profile-input body-medium"
          rows={2}
          placeholder="Descripción"
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
        {openPollId ? (
          <p className="body-medium on-surface-variant">
            Ya hay una votación abierta. Ciérrala desde la página del club.
          </p>
        ) : (
          <>
            <input
              className="profile-input body-medium"
              placeholder="Título — p. ej. «Libro de septiembre»"
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
            />
            {options.map((o, i) => (
              <div key={i} className="poll-new-option">
                <input
                  className="profile-input body-medium"
                  placeholder={`Opción ${i + 1} · título`}
                  value={o.title}
                  onChange={(e) =>
                    setOptions((p) =>
                      p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <input
                  className="profile-input body-medium"
                  placeholder="Autor"
                  value={o.author}
                  onChange={(e) =>
                    setOptions((p) =>
                      p.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)),
                    )
                  }
                />
              </div>
            ))}
            <div className="club-poll__form-actions">
              {options.length < 5 && (
                <md-text-button
                  onClick={() => setOptions((p) => [...p, { title: '', author: '' }])}
                >
                  + Añadir opción
                </md-text-button>
              )}
              <span style={{ flex: 1 }} />
              <md-filled-button disabled={busy || undefined} onClick={() => void createPoll()}>
                Abrir votación
              </md-filled-button>
            </div>
          </>
        )}
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
                    <span className="material-symbols-rounded">person_remove</span>
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
