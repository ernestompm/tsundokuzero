import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover } from '../../components/ui'
import Stars from '../../components/Stars'
import { BadgeRow } from '../../components/Badges'
import { antiguedadEnPalabras, badgesDe, type MemberStats } from '../../lib/badges'
import ReportButton from '../../components/ReportButton'
import { friendlyError } from '../../lib/errors'
import { useConfirm } from '../../components/ConfirmProvider'
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

/** Un libro de su estantería, con la nota que le puso si la puso. */
interface LibroSuyo {
  id: string
  title: string
  author: string
  cover: string | null
  status: 'reading' | 'finished' | 'want'
  rating: number | null
  recomienda: number | null
}

export default function UserProfilePage() {
  const { username } = useParams()
  const { session, profile: me } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [person, setPerson] = useState<Profile | null | 'missing'>(null)
  const [error, setError] = useState<string | null>(null)
  const [followers, setFollowers] = useState(0)
  // Su estantería y sus notas: el perfil público de un club de lectura
  // debería hablar de libros, no solo de mensajes.
  const [libros, setLibros] = useState<LibroSuyo[]>([])
  const [stats, setStats] = useState<MemberStats | null>(null)
  const [following, setFollowing] = useState(0)
  const [amFollowing, setAmFollowing] = useState(false)
  const [amBlocking, setAmBlocking] = useState(false)
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

    // Bloqueo (P2-13): con el perfil bloqueado no se carga su contenido
    const { data: blockRow } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', session.user.id)
      .eq('blocked_id', p.id)
      .maybeSingle()
    if (blockRow) {
      setAmBlocking(true)
      setIdeas([])
      setPosts([])
      setFollowers(0)
      setFollowing(0)
      setAmFollowing(false)
      return
    }
    setAmBlocking(false)

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

  // Sus libros, sus notas y sus insignias
  useEffect(() => {
    if (!person || person === 'missing') return
    const uid = person.id
    let cancelado = false
    const load = async () => {
      const [{ data: prog }, { data: notas }, { data: st }] = await Promise.all([
        supabase
          .from('reading_progress')
          .select('book_id, status, updated_at')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false }),
        // La vista enmascara el TEXTO de la reseña; la nota no es spoiler
        supabase
          .from('book_reviews')
          .select('book_id, rating, d_recommend')
          .eq('user_id', uid),
        supabase.from('club_member_stats').select('*').eq('user_id', uid).maybeSingle(),
      ])
      if (cancelado) return
      setStats((st as MemberStats | null) ?? null)

      const filas = prog ?? []
      if (filas.length === 0) {
        setLibros([])
        return
      }
      const { data: books } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .in('id', filas.map((f) => f.book_id))
      const porId = new Map((books ?? []).map((b) => [b.id, b]))
      const notaPorLibro = new Map((notas ?? []).map((n) => [n.book_id, n]))
      if (cancelado) return
      setLibros(
        filas.flatMap((f) => {
          const b = porId.get(f.book_id)
          if (!b) return []
          const n = notaPorLibro.get(f.book_id)
          return [
            {
              id: b.id,
              title: b.title,
              author: b.author,
              cover: b.cover_url,
              status: f.status as LibroSuyo['status'],
              rating: n?.rating ?? null,
              recomienda: n?.d_recommend ?? null,
            },
          ]
        }),
      )
    }
    void load()
    return () => {
      cancelado = true
    }
  }, [person])

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

  /** Bloquear/desbloquear (P2-13): el RPC rompe los follows en ambos sentidos. */
  const toggleBlock = async () => {
    if (!session) return
    setError(null)
    if (amBlocking) {
      const { error: e } = await supabase.rpc('unblock_user', {
        target: person.id,
      })
      if (e) {
        // auditoría A-04
        setError(friendlyError(e, 'No se pudo desbloquear a esta persona.'))
        return
      }
    } else {
      // auditoría M-04: diálogo propio en lugar de window.confirm
      const ok = await confirm({
        title: `Bloquear a ${person.display_name}`,
        message:
          'Dejaréis de seguiros y no verás su contenido ni sus avisos. Puedes deshacerlo cuando quieras.',
        confirmLabel: 'Bloquear',
        danger: true,
      })
      if (!ok) return
      const { error: e } = await supabase.rpc('block_user', { target: person.id })
      if (e) {
        // auditoría A-04: nada de avisos de migraciones ni window.alert
        setError(friendlyError(e, 'No se pudo bloquear a esta persona.'))
        return
      }
    }
    await load()
  }

  // Recomienda = lo que puntuó alto. La reseña escrita sigue sellada por
  // el servidor hasta que termines el libro; esto son solo estrellas.
  const recomienda = libros
    .filter((b) => (b.recomienda ?? b.rating ?? 0) >= 4)
    .sort((a, b) => (b.recomienda ?? b.rating ?? 0) - (a.recomienda ?? a.rating ?? 0))
    .slice(0, 8)

  return (
    <section className="profile">
      {error && <p className="profile-error body-medium">{error}</p>}
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
        {amBlocking ? (
          <md-outlined-button onClick={() => void toggleBlock()}>
            Desbloquear
          </md-outlined-button>
        ) : amFollowing ? (
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
          {!amBlocking && (
            <button
              type="button"
              className="report-btn"
              aria-label={`Bloquear a ${person.display_name}`}
              title="Bloquear"
              onClick={() => void toggleBlock()}
            >
              <span className="material-symbols-rounded" aria-hidden="true">person_remove</span>
            </button>
          )}
        </span>
      </div>

      {amBlocking && (
        <p className="body-medium on-surface-variant" style={{ textAlign: 'center' }}>
          Has bloqueado a esta persona: no ves su contenido ni sus avisos, y
          no puede seguirte.
        </p>
      )}

      {!amBlocking && stats && badgesDe(stats).length > 0 && (
        <div className="userprofile__insignias">
          <BadgeRow badges={badgesDe(stats)} max={6} />
          <span className="body-small on-surface-variant">
            En el club {antiguedadEnPalabras(stats.joined_at)}
          </span>
        </div>
      )}

      {!amBlocking && recomienda.length > 0 && (
        <>
          <h2 className="title-small profile-sec">Lo que recomienda</h2>
          <p className="body-small on-surface-variant userprofile__sub">
            Los libros a los que puso mejor nota.
          </p>
          <div className="userprofile__estante">
            {recomienda.map((b) => (
              <Link key={b.id} to={`/book/${b.id}`} className="userprofile__libro">
                <BookCover title={b.title} author={b.author} coverUrl={b.cover} size="lg" />
                <span className="label-small userprofile__titulo">{b.title}</span>
                {b.rating != null && <Stars value={b.rating} size={13} />}
              </Link>
            ))}
          </div>
        </>
      )}

      {!amBlocking &&
        (
          [
            ['finished', 'Lo que ha leído'],
            ['reading', 'Leyendo ahora'],
            ['want', 'Lo que tiene pendiente'],
          ] as const
        ).map(([estado, titulo]) => {
          const lista = libros.filter((b) => b.status === estado)
          if (lista.length === 0) return null
          return (
            <section key={estado}>
              <h2 className="title-small profile-sec">
                {titulo}{' '}
                <span className="body-small on-surface-variant">({lista.length})</span>
              </h2>
              <div className="userprofile__estante">
                {lista.map((b) => (
                  <Link key={b.id} to={`/book/${b.id}`} className="userprofile__libro">
                    <BookCover title={b.title} author={b.author} coverUrl={b.cover} size="lg" />
                    <span className="label-small userprofile__titulo">{b.title}</span>
                    {b.rating != null && <Stars value={b.rating} size={13} />}
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

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
