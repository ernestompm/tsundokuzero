import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import '@material/web/button/filled-button.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import RecommendedForYou from '../../components/RecommendedForYou'
import { timeAgo } from '../../lib/time'
import './news.css'

interface Respuesta {
  id: string
  thread_id: string
  author: string
  avatar: string | null
  body: string
  created_at: string
}

interface Reaccion {
  thread_id: string
  author: string
  avatar: string | null
  emoji: string
  excerpt: string
  created_at: string
}

interface Idea {
  thread_id: string
  author: string
  avatar: string | null
  chapter: number
  body: string
  created_at: string
}

interface Adelanto {
  name: string
  avatar: string | null
  chapter: number
}

interface Novedades {
  replies: Respuesta[]
  reactions: Reaccion[]
  ideas: Idea[]
  ahead: Adelanto[]
  book_id: string | null
  my_chapter: number
}

/**
 * «Lo nuevo»: lo que ha pasado desde la última vez que miraste.
 *
 * Existe porque los contadores de la tira del club no llevaban a ninguna
 * parte, y un aviso que no se puede abrir no es un aviso. Aquí cada cosa
 * es un enlace al sitio donde ocurrió, y al entrar se marcan como vistas,
 * así que la próxima vez ya no aparecen.
 *
 * El candado sigue puesto: las ideas que se listan son solo de capítulos
 * que ya has leído.
 */
export default function NewsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<Novedades | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data: n } = await supabase.rpc('club_news')
    const novedades = (n ?? {}) as Partial<Novedades>
    setData({
      replies: novedades.replies ?? [],
      reactions: novedades.reactions ?? [],
      ideas: novedades.ideas ?? [],
      ahead: novedades.ahead ?? [],
      book_id: novedades.book_id ?? null,
      my_chapter: novedades.my_chapter ?? 0,
    })
    // Se marcan como vistas DESPUÉS de tenerlas: lo que ves ahora se queda
    // en pantalla, pero ya no volverá a contar.
    await supabase.rpc('mark_seen', { p_kind: 'all' })
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const nada =
    data.replies.length === 0 &&
    data.reactions.length === 0 &&
    data.ideas.length === 0 &&
    data.ahead.length === 0

  return (
    <section className="news">
      <PageHeader
        title="Lo nuevo"
        sub="Desde la última vez que miraste"
        action={<md-text-button onClick={() => navigate('/')}>Volver</md-text-button>}
      />

      {/* Las recomendaciones no caducan al mirarlas: son un pendiente */}
      <RecommendedForYou />

      {nada ? (
        <div className="news__vacio">
          <span className="material-symbols-rounded" aria-hidden="true">
            check_circle
          </span>
          <p className="body-large">Estás al día.</p>
          <p className="body-medium on-surface-variant">
            Cuando alguien responda, reaccione o comparta algo de lo que ya has leído,
            aparecerá aquí.
          </p>
          <md-filled-button onClick={() => navigate('/')}>Volver al inicio</md-filled-button>
        </div>
      ) : (
        <>
          {/* ---- Respuestas a lo tuyo: lo más personal, primero ---- */}
          {data.replies.length > 0 && (
            <>
              <h2 className="title-small news__sec">
                Te han respondido
                <span className="news__cuenta">{data.replies.length}</span>
              </h2>
              <div className="news__lista">
                {data.replies.map((r) => (
                  <Link key={r.id} to={`/thread/${r.thread_id}`} className="news__item">
                    <Avatar name={r.author} url={r.avatar} size={38} />
                    <span className="news__txt">
                      <span className="title-small">
                        {r.author}{' '}
                        <span className="body-small on-surface-variant">
                          · {timeAgo(r.created_at)}
                        </span>
                      </span>
                      <span className="body-medium news__cuerpo">{r.body}</span>
                    </span>
                    <span className="material-symbols-rounded news__chev" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* ---- Reacciones ---- */}
          {data.reactions.length > 0 && (
            <>
              <h2 className="title-small news__sec">
                Han reaccionado a tus ideas
                <span className="news__cuenta">{data.reactions.length}</span>
              </h2>
              <div className="news__lista">
                {data.reactions.map((r, i) => (
                  <Link
                    key={`${r.thread_id}-${i}`}
                    to={`/thread/${r.thread_id}`}
                    className="news__item"
                  >
                    <Avatar name={r.author} url={r.avatar} size={38} />
                    <span className="news__txt">
                      <span className="title-small">
                        {r.author} <span className="news__emoji">{r.emoji}</span>{' '}
                        <span className="body-small on-surface-variant">
                          · {timeAgo(r.created_at)}
                        </span>
                      </span>
                      <span className="body-small on-surface-variant news__cuerpo">
                        {r.excerpt}
                      </span>
                    </span>
                    <span className="material-symbols-rounded news__chev" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* ---- Ideas nuevas del club ---- */}
          {data.ideas.length > 0 && (
            <>
              <h2 className="title-small news__sec">
                Ideas nuevas del club
                <span className="news__cuenta">{data.ideas.length}</span>
              </h2>
              <div className="news__lista">
                {data.ideas.map((idea, i) => (
                  <Link
                    key={`${idea.thread_id}-${i}`}
                    to={`/thread/${idea.thread_id}`}
                    className="news__item"
                  >
                    <Avatar name={idea.author} url={idea.avatar} size={38} />
                    <span className="news__txt">
                      <span className="title-small">
                        {idea.author}{' '}
                        <span className="body-small on-surface-variant">
                          · capítulo {idea.chapter} · {timeAgo(idea.created_at)}
                        </span>
                      </span>
                      <span className="body-medium news__cuerpo">{idea.body}</span>
                    </span>
                    <span className="material-symbols-rounded news__chev" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* ---- Quién va por delante ---- */}
          {data.ahead.length > 0 && (
            <>
              <h2 className="title-small news__sec">
                Han avanzado en la lectura
                <span className="news__cuenta">{data.ahead.length}</span>
              </h2>
              <div className="news__lista">
                {data.ahead.map((a, i) => (
                  <Link
                    key={`${a.name}-${i}`}
                    to={data.book_id ? `/book/${data.book_id}` : '/club'}
                    className="news__item"
                  >
                    <Avatar name={a.name} url={a.avatar} size={38} />
                    <span className="news__txt">
                      <span className="title-small">{a.name}</span>
                      <span className="body-small on-surface-variant">
                        Va por el capítulo {a.chapter} y tú por el {data.my_chapter}
                      </span>
                    </span>
                    <span className="material-symbols-rounded news__chev" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
