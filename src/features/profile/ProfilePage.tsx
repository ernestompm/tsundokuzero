import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import './profile.css'

interface IdeaRow {
  id: string
  bookId: string
  bookTitle: string
  chapterNumber: number
  body: string
  createdAt: string
}

export default function ProfilePage() {
  const { session, profile, isSuperAdmin, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [bioDraft, setBioDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const [
      { count: followersCount },
      { count: followingCount },
      { data: discussions },
    ] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', session.user.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', session.user.id),
      supabase
        .from('discussions')
        .select('id, book_id, chapter_number, body, created_at')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setFollowers(followersCount ?? 0)
    setFollowing(followingCount ?? 0)

    const list = discussions ?? []
    const bookIds = [...new Set(list.map((d) => d.book_id))]
    const { data: books } = bookIds.length
      ? await supabase.from('books').select('id, title').in('id', bookIds)
      : { data: [] }
    const titleById = new Map((books ?? []).map((b) => [b.id, b.title]))
    setIdeas(
      list.map((d) => ({
        id: d.id,
        bookId: d.book_id,
        bookTitle: titleById.get(d.book_id) ?? '',
        chapterNumber: d.chapter_number,
        body: d.body,
        createdAt: timeAgo(d.created_at),
      })),
    )
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = () => {
    setNameDraft(profile?.display_name ?? '')
    setBioDraft(profile?.bio ?? '')
    setError(null)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!session) return
    const display_name = nameDraft.trim()
    if (!display_name) {
      setError('El nombre no puede estar vacío.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name, bio: bioDraft.trim() || null })
      .eq('id', session.user.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refreshProfile()
    setEditing(false)
  }

  return (
    <section className="profile">
      <div className="profile-head">
        <Avatar
          name={profile?.display_name ?? '·'}
          url={profile?.avatar_url}
          size={72}
        />
        {editing ? (
          <div className="profile-edit">
            {error && <p className="profile-error body-medium">{error}</p>}
            <input
              className="profile-input body-large"
              placeholder="Nombre visible"
              value={nameDraft}
              maxLength={50}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <textarea
              className="profile-input body-medium"
              placeholder="Bio: cuéntanos qué clase de lector eres…"
              rows={2}
              maxLength={200}
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
            />
            <div className="profile-edit__actions">
              <md-text-button onClick={() => setEditing(false)}>
                Cancelar
              </md-text-button>
              <md-filled-button disabled={busy || undefined} onClick={() => void saveEdit()}>
                Guardar
              </md-filled-button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="headline-small serif">{profile?.display_name}</h1>
            <p className="body-medium on-surface-variant">
              @{profile?.username}
            </p>
            {profile?.bio && (
              <p className="body-medium profile-bio">{profile.bio}</p>
            )}
            <div className="profile-counts label-large">
              <span>
                <b>{following}</b>{' '}
                <span className="on-surface-variant">siguiendo</span>
              </span>
              <span>
                <b>{followers}</b>{' '}
                <span className="on-surface-variant">seguidores</span>
              </span>
              <span>
                <b>{ideas.length}</b>{' '}
                <span className="on-surface-variant">ideas</span>
              </span>
            </div>
            <md-outlined-button onClick={startEdit}>
              Editar perfil
            </md-outlined-button>
          </>
        )}
      </div>

      <h2 className="title-small profile-sec">Mis últimas ideas</h2>
      {ideas.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Todavía no has compartido ninguna idea. Toca el + y estrena tu voz.
        </p>
      ) : (
        <div className="profile-ideas">
          {ideas.map((i) => (
            <button
              key={i.id}
              className="idea-row"
              onClick={() =>
                navigate(`/book/${i.bookId}/chapter/${i.chapterNumber}`)
              }
            >
              <span className="body-medium idea-row__body">{i.body}</span>
              <span className="body-small on-surface-variant">
                {i.bookTitle} · Cap. {i.chapterNumber} · {i.createdAt}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="profile-actions">
        <Link to="/club" style={{ display: 'block' }}>
          <md-filled-tonal-button style={{ width: '100%' }}>
            <span slot="icon" className="material-symbols-rounded">group</span>
            Mi club
          </md-filled-tonal-button>
        </Link>
        {isSuperAdmin && (
          <Link to="/admin" style={{ display: 'block' }}>
            <md-filled-tonal-button style={{ width: '100%' }}>
              <span slot="icon" className="material-symbols-rounded">
                admin_panel_settings
              </span>
              Administración
            </md-filled-tonal-button>
          </Link>
        )}
        <md-outlined-button onClick={() => void signOut()}>
          Cerrar sesión
        </md-outlined-button>
      </div>
    </section>
  )
}
