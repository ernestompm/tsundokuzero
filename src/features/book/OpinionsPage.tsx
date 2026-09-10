import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import '@material/web/button/outlined-button.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover, Card } from '../../components/ui'
import Stars from '../../components/Stars'
import PersonLink from '../../components/PersonLink'
import PageHeader from '../../components/PageHeader'
import { RatingBarsCompare, type Dimensions } from '../../components/RatingBars'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/time'
import './opinions.css'

interface Opinion {
  userId: string
  name: string
  username: string | null
  avatar: string | null
  rating: number
  review: string | null
  hasReview: boolean
  dims: Dimensions
  createdAt: string
}

interface Datos {
  title: string
  author: string
  coverUrl: string | null
  media: number | null
  total: number
  /** reparto de estrellas, índice 0 = una estrella */
  reparto: number[]
  club: Dimensions
  mine: Dimensions | null
  yaTerminado: boolean
  /** el club ya abrió las reseñas (migr. 029) */
  premiered: boolean
  /** cuánta gente del club falta por terminar */
  faltan: number
  soyCapitan: boolean
  opiniones: Opinion[]
}

const media = (vals: (number | null)[]) => {
  const n = vals.filter((v): v is number => typeof v === 'number')
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null
}

/**
 * Todas las opiniones de un libro en un sitio: nota media, reparto de
 * estrellas, las cuatro dimensiones del club contra las tuyas y las
 * reseñas escritas.
 *
 * El candado sigue puesto por el servidor: la vista `book_reviews`
 * devuelve el TEXTO en null si no has terminado el libro. Las notas y las
 * dimensiones sí se ven siempre, porque no son spoiler.
 */
export default function OpinionsPage() {
  const { bookId } = useParams()
  const { session } = useAuth()
  const [data, setData] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session || !bookId) return
    const [{ data: book, error: bookError }, { data: rows }] = await Promise.all([
      supabase
        .from('books')
        .select('title, author, cover_url')
        .eq('id', bookId)
        .maybeSingle(),
      supabase
        .from('book_reviews')
        .select('user_id, rating, review, has_review, premiered, d_think, d_flow, d_feel, d_recommend, created_at')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false }),
    ])
    if (bookError || !book) {
      setError(friendlyError(bookError, 'Este libro ya no está en la estantería.'))
      return
    }
    const lista = rows ?? []

    const { data: progreso } = await supabase
      .from('reading_progress')
      .select('status')
      .eq('user_id', session.user.id)
      .eq('book_id', bookId)
      .maybeSingle()

    const perfiles = lista.length
      ? (
          await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', lista.map((r) => r.user_id))
        ).data
      : []
    const byId = new Map((perfiles ?? []).map((p) => [p.id, p]))

    // ¿Cuánta gente del club falta por terminar? Es lo que retiene el estreno.
    const { data: miClub } = await supabase
      .from('club_members')
      .select('club_id, role')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    let faltan = 0
    if (miClub) {
      const [{ data: miembros }, { data: acabados }] = await Promise.all([
        supabase.from('club_members').select('user_id').eq('club_id', miClub.club_id),
        supabase
          .from('reading_progress')
          .select('user_id')
          .eq('book_id', bookId)
          .eq('status', 'finished'),
      ])
      const idsAcabados = new Set((acabados ?? []).map((a) => a.user_id))
      faltan = (miembros ?? []).filter((m) => !idsAcabados.has(m.user_id)).length
    }

    const reparto = [0, 0, 0, 0, 0]
    for (const r of lista) if (r.rating >= 1 && r.rating <= 5) reparto[r.rating - 1]++

    const mia = lista.find((r) => r.user_id === session.user.id)

    setData({
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
      media: media(lista.map((r) => r.rating)),
      total: lista.length,
      reparto,
      club: {
        d_think: media(lista.map((r) => r.d_think)),
        d_flow: media(lista.map((r) => r.d_flow)),
        d_feel: media(lista.map((r) => r.d_feel)),
        d_recommend: media(lista.map((r) => r.d_recommend)),
      },
      mine: mia
        ? {
            d_think: mia.d_think,
            d_flow: mia.d_flow,
            d_feel: mia.d_feel,
            d_recommend: mia.d_recommend,
          }
        : null,
      yaTerminado: progreso?.status === 'finished',
      premiered: lista[0]?.premiered ?? true,
      faltan,
      soyCapitan: miClub?.role === 'captain',
      opiniones: lista.map((r) => {
        const p = byId.get(r.user_id)
        return {
          userId: r.user_id,
          name: p?.display_name ?? 'Lector',
          username: p?.username ?? null,
          avatar: p?.avatar_url ?? null,
          rating: r.rating,
          review: r.review,
          hasReview: r.has_review,
          dims: {
            d_think: r.d_think,
            d_flow: r.d_flow,
            d_feel: r.d_feel,
            d_recommend: r.d_recommend,
          },
          createdAt: r.created_at,
        }
      }),
    })
  }, [session, bookId])

  useEffect(() => {
    void load()
  }, [load])

  /** Escape del capitán: abre las reseñas sin esperar al rezagado. */
  const estrenar = async () => {
    const { error } = await supabase.rpc('premiere_reviews')
    if (error) setError(friendlyError(error, 'No se pudo estrenar las reseñas.'))
    else await load()
  }

  if (error) {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">{error}</p>
        <Link to="/library" className="body-medium">
          Volver a mi biblioteca
        </Link>
      </section>
    )
  }

  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const selladas = data.opiniones.filter((o) => o.hasReview && !o.review).length
  const escritas = data.opiniones.filter((o) => o.review)
  const maxReparto = Math.max(1, ...data.reparto)

  return (
    <section className="opinions">
      <PageHeader title="Opiniones" sub={`${data.title} · ${data.author}`} />

      {data.total === 0 ? (
        <Card tone="outlined">
          <p className="body-medium on-surface-variant">
            Todavía no ha valorado nadie. Sé el primero cuando lo termines.
          </p>
          <Link to={`/book/${bookId}`} className="body-medium">
            Volver a la ficha
          </Link>
        </Card>
      ) : (
        <>
          {/* Resumen: media grande + reparto de estrellas */}
          <Card tone="default" className="opinions__resumen">
            <div className="opinions__nota">
              <BookCover
                title={data.title}
                author={data.author}
                coverUrl={data.coverUrl}
                size="md"
              />
              <div>
                <span className="opinions__media serif">
                  {data.media?.toFixed(1) ?? '—'}
                </span>
                <Stars value={Math.round(data.media ?? 0)} size={18} />
                <p className="body-small on-surface-variant">
                  {data.total} {data.total === 1 ? 'valoración' : 'valoraciones'}
                </p>
              </div>
            </div>
            <div className="opinions__reparto">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = data.reparto[n - 1]
                return (
                  <div key={n} className="opinions__barra">
                    <span className="label-small opinions__barra-n">{n}</span>
                    <span className="opinions__barra-track" aria-hidden="true">
                      <span
                        className="opinions__barra-fill"
                        style={{ width: `${(c / maxReparto) * 100}%` }}
                      />
                    </span>
                    <span className="label-small opinions__barra-c">{c}</span>
                    <span className="visually-hidden">
                      {c} {c === 1 ? 'persona' : 'personas'} le dio {n} de 5
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Las cuatro dimensiones: el club contra tú */}
          <Card tone="soft" className="opinions__dims">
            <h2 className="title-small">Por qué gustó</h2>
            <p className="body-small on-surface-variant opinions__dims-sub">
              La barra es la media del club. La marca vertical eres tú.
            </p>
            <RatingBarsCompare mine={data.mine ?? undefined} club={data.club} />
          </Card>

          {/* Reseñas escritas */}
          <h2 className="title-small opinions__sec">
            Reseñas {escritas.length > 0 ? `(${escritas.length})` : ''}
          </h2>

          {!data.premiered && selladas > 0 && (
            <Card tone="outlined" className="opinions__lock opinions__premiere">
              <span className="material-symbols-rounded" aria-hidden="true">
                lock
              </span>
              <div>
                <p className="body-medium">
                  <b>El estreno.</b> Hay {selladas}{' '}
                  {selladas === 1 ? 'reseña escrita' : 'reseñas escritas'} y se abren
                  todas a la vez, cuando termine el club. Así nadie lee condicionado
                  por lo que dijo otro.
                </p>
                <p className="body-small on-surface-variant">
                  {data.faltan > 0
                    ? `Falta ${data.faltan} ${data.faltan === 1 ? 'persona' : 'personas'} por terminar.`
                    : 'Ya habéis terminado todos: el estreno está al caer.'}
                </p>
                {data.soyCapitan && (
                  <md-outlined-button
                    style={{ marginTop: 10 }}
                    onClick={() => void estrenar()}
                  >
                    Estrenar ahora
                  </md-outlined-button>
                )}
              </div>
            </Card>
          )}

          {data.premiered && !data.yaTerminado && selladas > 0 && (
            <Card tone="outlined" className="opinions__lock">
              <span className="material-symbols-rounded" aria-hidden="true">
                lock
              </span>
              <p className="body-medium">
                Hay {selladas} {selladas === 1 ? 'reseña' : 'reseñas'} escritas, pero
                pueden destripar el final. Termina el libro y se abren solas.
              </p>
            </Card>
          )}

          {escritas.length === 0 && (data.yaTerminado || selladas === 0) && (
            <Card tone="outlined">
              <p className="body-medium on-surface-variant">
                Nadie ha escrito todavía. Hay notas, pero ninguna reseña.
              </p>
            </Card>
          )}

          <div className="opinions__lista">
            {escritas.map((o) => (
              <Card key={o.userId} tone="soft" className="opinion">
                <div className="opinion__head">
                  <PersonLink username={o.username} className="opinion__quien">
                    <Avatar name={o.name} url={o.avatar} size={36} />
                    <span className="opinion__nombres">
                      <span className="title-small">{o.name}</span>
                      <span className="body-small on-surface-variant">
                        {timeAgo(o.createdAt)}
                      </span>
                    </span>
                  </PersonLink>
                  <Stars value={o.rating} size={16} />
                </div>
                <p className="body-medium opinion__texto">{o.review}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
