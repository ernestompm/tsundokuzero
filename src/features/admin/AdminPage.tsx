import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/switch/switch.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { KIND_LABEL } from '../book/chapterTypes'
import type { Book, DiscussionKind } from '../../lib/database.types'
import './admin.css'

type Tab = 'summary' | 'users' | 'content' | 'books'

export default function AdminPage() {
  const { isSuperAdmin, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('summary')

  if (loading) return null
  if (!isSuperAdmin) return <Navigate to="/" replace />

  return (
    <section className="admin">
      <h1 className="headline-medium serif">Administración</h1>
      <div className="admin-tabs">
        {(
          [
            ['summary', 'Resumen'],
            ['users', 'Usuarios'],
            ['content', 'Moderación'],
            ['books', 'Libros'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab label-large${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'content' && <ContentTab />}
      {tab === 'books' && <BooksTab />}
    </section>
  )
}

/* ===================== Resumen ===================== */

interface AdminStats {
  users: number
  ideas: number
  replies: number
  books: number
  ideas_week: number
  new_users_week: number
}

function SummaryTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error }) => {
      if (error) setError(error.message)
      else setStats(((data as AdminStats[] | null) ?? [])[0] ?? null)
    })
  }, [])

  if (!stats) return <Spinner error={error} />

  const tiles = [
    { icon: 'group', value: stats.users, label: 'usuarios', sub: `+${stats.new_users_week} esta semana` },
    { icon: 'forum', value: stats.ideas, label: 'ideas', sub: `+${stats.ideas_week} esta semana` },
    { icon: 'chat_bubble', value: stats.replies, label: 'respuestas', sub: '' },
    { icon: 'menu_book', value: stats.books, label: 'libros', sub: '' },
  ]

  return (
    <div className="admin-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="admin-tile">
          <span className="material-symbols-rounded admin-tile__icon">
            {t.icon}
          </span>
          <span className="headline-medium admin-tile__value">{t.value}</span>
          <span className="body-small on-surface-variant">{t.label}</span>
          {t.sub && (
            <span className="label-small admin-tile__sub">{t.sub}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Usuarios ===================== */

interface AdminUser {
  id: string
  username: string
  display_name: string
  email: string
  is_super_admin: boolean
  club_role: string | null
  created_at: string
}

function UsersTab() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    else setUsers((data as AdminUser[] | null) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleAdmin = async (u: AdminUser) => {
    setSavingId(u.id)
    const { error } = await supabase.rpc('admin_set_super_admin', {
      target: u.id,
      value: !u.is_super_admin,
    })
    if (error) setError(error.message)
    else await load()
    setSavingId(null)
  }

  const expel = async (u: AdminUser) => {
    if (
      !window.confirm(
        `¿Expulsar a ${u.display_name} (@${u.username})? Se borra su cuenta y TODO su contenido. No se puede deshacer.`,
      )
    )
      return
    setSavingId(u.id)
    const { error } = await supabase.rpc('admin_delete_user', { target: u.id })
    if (error) setError(error.message)
    else await load()
    setSavingId(null)
  }

  if (users === null) return <Spinner error={error} />

  const q = search.trim().toLowerCase()
  const visible = q
    ? users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    : users

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}
      <input
        className="admin-search body-medium"
        placeholder="Buscar por nombre, @usuario o email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visible.length === 0 && (
        <p className="body-medium on-surface-variant">Sin resultados.</p>
      )}
      {visible.map((u) => (
        <div key={u.id} className="admin-row">
          <Avatar name={u.display_name} size={40} />
          <div className="admin-row__main">
            <span className="title-small">
              {u.display_name}{' '}
              {u.club_role === 'captain' && (
                <span className="label-small" style={{ color: 'var(--md-sys-color-primary)' }}>
                  ★ capitán
                </span>
              )}
            </span>
            <span className="body-small on-surface-variant admin-ellipsis">
              @{u.username} · {u.email} · {timeAgo(u.created_at)}
            </span>
          </div>
          <label className="admin-switch label-small">
            <md-switch
              aria-label={`Admin: ${u.display_name}`}
              selected={u.is_super_admin || undefined}
              disabled={savingId === u.id || u.id === session?.user.id || undefined}
              onChange={() => void toggleAdmin(u)}
            />
            admin
          </label>
          {u.id !== session?.user.id && (
            <button
              className="admin-danger"
              disabled={savingId === u.id}
              onClick={() => void expel(u)}
            >
              <span className="material-symbols-rounded">person_remove</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Moderación ===================== */

interface ModItem {
  id: string
  body: string
  kind: DiscussionKind
  chapter_number: number
  created_at: string
  is_club: boolean
  book_title: string
  author_name: string
  author_id: string
  comment_count: number
}

function ContentTab() {
  const [items, setItems] = useState<ModItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_discussions')
    if (error) setError(error.message)
    else setItems((data as ModItem[] | null) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveEdit = async (id: string) => {
    const { error } = await supabase.rpc('admin_update_discussion', {
      target: id,
      new_body: draft.trim(),
    })
    if (error) setError(error.message)
    setEditingId(null)
    await load()
  }

  const remove = async (item: ModItem) => {
    if (
      !window.confirm(
        `¿Eliminar esta publicación de ${item.author_name} y sus ${item.comment_count} respuestas?`,
      )
    )
      return
    const { error } = await supabase.rpc('admin_delete_discussion', {
      target: item.id,
    })
    if (error) setError(error.message)
    await load()
  }

  if (items === null) return <Spinner error={error} />

  const q = search.trim().toLowerCase()
  const visible = q
    ? items.filter(
        (i) =>
          i.body.toLowerCase().includes(q) ||
          i.author_name.toLowerCase().includes(q) ||
          i.book_title.toLowerCase().includes(q),
      )
    : items

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}
      <p className="body-small on-surface-variant">
        Ves TODO el contenido (sin spoiler gate): esta vista es solo para
        moderar. {items.length} publicaciones.
      </p>
      <input
        className="admin-search body-medium"
        placeholder="Buscar por texto, autor o libro…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visible.map((i) => (
        <div key={i.id} className="admin-card">
          <div className="admin-card__meta body-small on-surface-variant">
            <b>{i.author_name}</b> · {i.book_title} · Cap. {i.chapter_number} ·{' '}
            {KIND_LABEL[i.kind]}
            {i.is_club ? ' · Club' : ''} · {timeAgo(i.created_at)} ·{' '}
            {i.comment_count} respuestas
          </div>
          {editingId === i.id ? (
            <>
              <textarea
                className="admin-edit body-medium"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="admin-card__actions">
                <md-text-button onClick={() => setEditingId(null)}>
                  Cancelar
                </md-text-button>
                <md-filled-button
                  disabled={!draft.trim() || undefined}
                  onClick={() => void saveEdit(i.id)}
                >
                  Guardar
                </md-filled-button>
              </div>
            </>
          ) : (
            <>
              <p className="body-medium admin-card__body">{i.body}</p>
              <div className="admin-card__actions">
                <md-text-button
                  onClick={() => {
                    setEditingId(i.id)
                    setDraft(i.body)
                  }}
                >
                  Editar
                </md-text-button>
                <md-text-button onClick={() => void remove(i)}>
                  Eliminar
                </md-text-button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Libros ===================== */

function BooksTab() {
  const [books, setBooks] = useState<Book[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newCover, setNewCover] = useState('')
  const [newChapters, setNewChapters] = useState('')
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('books').select('*').order('title')
    if (error) setError(error.message)
    setBooks(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createBook = async () => {
    const title = newTitle.trim()
    const author = newAuthor.trim()
    const chapterTitles = newChapters
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!title || !author || chapterTitles.length === 0) {
      setError('Título, autor y al menos un capítulo (uno por línea).')
      return
    }
    setBusy(true)
    setError(null)
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        title,
        author,
        cover_url: newCover.trim() || null,
        total_chapters: chapterTitles.length,
      })
      .select()
      .single()
    if (bookError || !book) {
      setError(bookError?.message ?? 'No se pudo crear el libro')
      setBusy(false)
      return
    }
    const { error: chError } = await supabase.from('chapters').insert(
      chapterTitles.map((label, i) => ({
        book_id: book.id,
        number: i + 1,
        label,
      })),
    )
    if (chError) setError(chError.message)
    setNewTitle('')
    setNewAuthor('')
    setNewCover('')
    setNewChapters('')
    setBusy(false)
    await load()
  }

  const addChapter = async (bookId: string) => {
    const title = (chapterDrafts[bookId] ?? '').trim()
    if (!title) return
    setBusy(true)
    const { error } = await supabase.rpc('add_book_chapter', {
      book: bookId,
      title,
    })
    if (error) setError(error.message)
    setChapterDrafts((d) => ({ ...d, [bookId]: '' }))
    setBusy(false)
    await load()
  }

  const setClubBook = async (bookId: string) => {
    setBusy(true)
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (club) {
      const { error } = await supabase
        .from('clubs')
        .update({ current_book_id: bookId })
        .eq('id', club.id)
      if (error) setError(error.message)
    }
    setBusy(false)
    await load()
  }

  const saveCover = async (bookId: string, cover: string) => {
    setBusy(true)
    const { error } = await supabase
      .from('books')
      .update({ cover_url: cover.trim() || null })
      .eq('id', bookId)
    if (error) setError(error.message)
    setBusy(false)
    await load()
  }

  if (books === null) return <Spinner error={error} />

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}

      {books.map((b) => (
        <div key={b.id} className="admin-card admin-book">
          <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="md" />
          <div className="admin-book__main">
            <span className="title-small serif">{b.title}</span>
            <span className="body-small on-surface-variant">
              {b.author} · {b.total_chapters} capítulos
            </span>
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="URL de portada (https://…)"
                defaultValue={b.cover_url ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (b.cover_url ?? ''))
                    void saveCover(b.id, e.target.value)
                }}
              />
            </div>
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="Añadir capítulo por título…"
                value={chapterDrafts[b.id] ?? ''}
                onChange={(e) =>
                  setChapterDrafts((d) => ({ ...d, [b.id]: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && void addChapter(b.id)}
              />
              <md-outlined-button
                disabled={busy || undefined}
                onClick={() => void addChapter(b.id)}
              >
                Añadir
              </md-outlined-button>
            </div>
            <div className="admin-book__row">
              <md-text-button disabled={busy || undefined} onClick={() => void setClubBook(b.id)}>
                Hacer libro del club
              </md-text-button>
            </div>
          </div>
        </div>
      ))}

      <div className="admin-card">
        <h2 className="title-medium serif" style={{ marginBottom: 10 }}>
          Nuevo libro
        </h2>
        <div className="admin-new-book">
          <input
            className="admin-input body-medium"
            placeholder="Título"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            className="admin-input body-medium"
            placeholder="Autor"
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
          />
          <input
            className="admin-input body-medium"
            placeholder="URL de portada (opcional)"
            value={newCover}
            onChange={(e) => setNewCover(e.target.value)}
          />
          <textarea
            className="admin-edit body-medium"
            rows={6}
            placeholder={'Capítulos: un título por línea, en orden\nCapítulo uno\nCapítulo dos…'}
            value={newChapters}
            onChange={(e) => setNewChapters(e.target.value)}
          />
          <md-filled-button disabled={busy || undefined} onClick={() => void createBook()}>
            Crear libro
          </md-filled-button>
        </div>
      </div>
    </div>
  )
}

function Spinner({ error }: { error: string | null }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
      {error ? (
        <p className="admin-error body-medium">{error}</p>
      ) : (
        <md-circular-progress indeterminate />
      )}
    </div>
  )
}
