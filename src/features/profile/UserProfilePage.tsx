import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/ui'
import ReportButton from '../../components/ReportButton'
import { timeAgo } from '../../lib/time'
import type { Profile } from '../../lib/database.types'
import './profile.css'

interface IdeaRow {
  id: string
  bookId: string
  bookTitle: string
  chapterNumber: number
  body: string
  createdAt: string
}

interface PostRow {
  id: string
  title: string | null
  body: string
  createdAt: string
}

export default function UserProfilePage() {
  const { username } = useParams()
  const { session, profile: me } = useAuth()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Profile | null | 'missing'>(null)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [amFollowing, setAmFollowing] = useState(false)
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])

  const load = useCallback(async () => {
    if (!username || !session) return
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle()
    if (!p) {
      setPerson('missing')
      return
    }
    setPerson(p)

    const [
      { count: followersCount },
      { count: followingCount },
      { data: myFollow },
      { data: discussions },
      { data: theirPosts },
    ] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', p.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', p.id),
      supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', session.user.id)
        .eq('followed_id', p.id)
        .maybeSingle(),
      // Solo las ideas que TU progreso te deja ver (RLS)
      supabase
        .from('discussions')
        .select('id, book_id, chapter_number, body, created_at')
        .eq('author_id', p.id)
        .order('created_at', { ascending: false })
        .limit(20),
      // Su muro: RLS lo muestra si le sigues o si es del club
      supabase
        .from('posts')
        .select('id, title, body, created_at')
        .eq('author_id', p.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setFollowers(followersCount ?? 0)
    setFollowing(followingCount ?? 0)
    setAmFollowing(myFollow != null)
    setPosts(
      (theirPosts ?? []).map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        createdAt: timeAgo(post.created_at),
      })),
    )

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
  }, [username, session])

  useEffect(() => {
    void load()
  }, [load])

  // Tu propio perfil vive en /me
  if (me && username === me.username) return <Navigate to="/me" replace />

  if (person === 'missing') {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">No existe nadie con el usuario @{username}.</p>
      </section>
    )
  }

  if (!person) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const toggleFollow = async () => {
    if (!session) return
    setAmFollowing((v) => !v)
    setFollowers((n) => n + (amFollowing ? -1 : 1))
    if (amFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('followed_id', person.id)
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: session.user.id, followed_id: person.id })
    }
  }

  return (
    <section className="profile">
      <div className="profile-head">
        <Avatar name={person.display_name} url={person.avatar_url} size={72} />
        <h1 className="headline-small serif">{person.display_name}</h1>
        <p className="body-medium on-surface-variant">@{person.username}</p>
        {person.bio && <p className="body-medium profile-bio">{person.bio}</p>}
        <div className="profile-counts label-large">
          <span>
            <b>{following}</b>{' '}
            <span className="on-surface-variant">siguiendo</span>
          </span>
          <span>
            <b>{followers}</b>{' '}
            <span className="on-surface-variant">seguidores</span>
          </span>
        </div>
        {amFollowing ? (
          <md-outlined-button onClick={() => void toggleFollow()}>
            Siguiendo
          </md-outlined-button>
        ) : (
          <md-filled-button onClick={() => void toggleFollow()}>
            Seguir
          </md-filled-button>
        )}
        <span className="profile-report label-small">
          <ReportButton
            targetType="profile"
            targetId={person.id}
            reportedUserId={person.id}
            excerpt={person.bio}
          />
        </span>
      </div>

      {posts.length > 0 && (
        <>
          <h2 className="title-small profile-sec">Su muro</h2>
          <div className="profile-ideas">
            {posts.map((p) => (
              <div key={p.id} className="idea-row" style={{ cursor: 'default' }}>
                {p.title && <span className="title-small serif">{p.title}</span>}
                <span className="body-medium idea-row__body">{p.body}</span>
                <span className="body-small on-surface-variant post-row__meta">
                  {p.createdAt}
                  <ReportButton
                    targetType="post"
                    targetId={p.id}
                    reportedUserId={person.id}
                    excerpt={p.body}
                  />
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="title-small profile-sec">Sus ideas (hasta tu progreso)</h2>
      {ideas.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Nada visible todavía: o no ha publicado, o sus ideas están más
          adelante de tu punto de lectura.
        </p>
      ) : (
        <div className="profile-ideas">
          {ideas.map((i) => (
            <button
              key={i.id}
              className="idea-row"
              onClick={() => navigate(`/book/${i.bookId}/chapter/${i.chapterNumber}`)}
            >
              <span className="body-medium idea-row__body">{i.body}</span>
              <span className="body-small on-surface-variant">
                {i.bookTitle} · Cap. {i.chapterNumber} · {i.createdAt}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="body-small on-surface-variant" style={{ marginTop: 16 }}>
        <Link to="/explore">← Buscar más lectores</Link>
      </p>
    </section>
  )
}
