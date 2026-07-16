import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import {
  Avatar,
  AvatarStack,
  BookCover,
  Chip,
  ProgressBar,
  SectionHeader,
} from '../../components/ui'
import { useCompose } from '../../components/ComposeProvider'
import { useConfirm } from '../../components/ConfirmProvider'
import LockedTeaser from '../../components/LockedTeaser'
import Reactions from '../../components/Reactions'
import { KIND_LABEL } from '../book/chapterTypes'
import type {
  FeedFilter,
  FeedItem,
  FeedReply,
  HomeData,
  HomeReading,
} from './homeTypes'
import './home.css'

const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'club', label: 'Mi club' },
  { key: 'reading', label: 'Leyendo ahora' },
  { key: 'finished', label: 'Ya leídos' },
]

// auditoría B-04: el filtro se aplica en la query del servidor, así que un
// vacío significa que de verdad no hay nada que enseñar
const FILTER_EMPTY: Record<FeedFilter, string> = {
  all: 'Aún no hay ideas en tu punto de lectura.',
  club: 'Tu club aún no ha publicado nada.',
  reading: 'Nadie ha comentado aún los libros que estás leyendo.',
  finished: 'No hay conversación sobre tus libros terminados.',
}

/** Enter y Espacio activan la acción, como en un botón real (auditoría A-07) */
function pressKeys(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault()
      action()
    }
  }
}

interface Props {
  data: HomeData
  /** auditoría B-04: filtro controlado desde FeedPage (se aplica en la query
      del servidor). Sin estas props, HomeView filtra en cliente (la preview) */
  filter?: FeedFilter
  onFilterChange?: (filter: FeedFilter) => void
  /** auditoría A-01: error de la última acción, mostrado junto al feed */
  actionError?: string | null
  onDeleteItem?: (id: string, type: 'idea' | 'post') => void
  onReact?: (discussionId: string, emoji: string | null) => void
  /** true = publicada (los stubs de preview pueden seguir devolviendo void) */
  onReply?: (discussionId: string, body: string) => Promise<boolean> | void
}

export default function HomeView({
  data,
  filter: serverFilter,
  onFilterChange,
  actionError,
  onDeleteItem,
  onReact,
  onReply,
}: Props) {
  const navigate = useNavigate()
  const { openCompose } = useCompose()
  const { readings, stats, conversations, discover, feed } = data
  const reading = readings[0] ?? null

  // Filtro del feed: controlado (FeedPage lo aplica en la query, auditoría
  // B-04) o, si no llegan las props, en cliente como antes (la preview)
  const [localFilter, setLocalFilter] = useState<FeedFilter>('all')
  const filter = serverFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const readingSet = new Set(data.readingBookIds)
  const finishedSet = new Set(data.finishedBookIds)
  const visibleFeed =
    serverFilter != null
      ? feed // ya viene filtrado del servidor
      : feed.filter((item) => {
          if (filter === 'all') return true
          if (filter === 'club') return item.isClub
          const bookId = item.bookId ?? item.parent?.bookId ?? null
          if (bookId == null) return false
          return filter === 'reading'
            ? readingSet.has(bookId)
            : finishedSet.has(bookId)
        })

  return (
    <div className="home">
      {/* ===== Cabecera grande (móvil): fecha + «Hoy», estilo iOS ===== */}
      <header className="home-today">
        <span className="label-medium home-today__date">{todayLabel()}</span>
        <h1 className="home-today__title serif">Hoy</h1>
      </header>

      {/* ===== Hero (escritorio): lectura actual + tu actividad ===== */}
      <div className="home-hero">
        <div className="hero-card">
          <span className="label-medium hero-card__kicker">
            {reading ? 'Estás leyendo' : 'Tu próxima lectura'}
          </span>
          {reading ? (
            <div className="hero-card__body">
              <div className="hero-card__info">
                <h1 className="display-small serif hero-card__title">
                  {reading.title}
                </h1>
                <p className="body-medium on-surface-variant">
                  {reading.chapterNumber > 0
                    ? `Capítulo ${reading.chapterNumber} de ${reading.totalChapters}`
                    : 'Aún no has empezado'}
                  {reading.chapterLabel ? ` · ${reading.chapterLabel}` : ''}
                </p>
                <div className="hero-card__progress">
                  <ProgressBar percent={reading.percent} />
                  <span className="label-medium on-surface-variant">
                    {reading.percent}%
                  </span>
                </div>
                <md-filled-button
                  onClick={() => navigate(`/book/${reading.bookId}`)}
                >
                  Actualizar progreso
                </md-filled-button>
              </div>
              <div className="hero-card__cover">
                <BookCover
                  title={reading.title}
                  author={reading.author}
                  coverUrl={reading.coverUrl}
                  size="xl"
                />
              </div>
            </div>
          ) : (
            <div className="hero-card__body">
              <div className="hero-card__info">
                <h1 className="headline-medium serif">
                  Empieza el libro del club
                </h1>
                <md-filled-button onClick={() => navigate('/book')}>
                  Ir al libro
                </md-filled-button>
              </div>
            </div>
          )}
        </div>

        <div className="stats-card">
          {/* auditoría B-03: la tarjeta no contiene ningún reto, es un resumen */}
          <span className="label-medium hero-card__kicker">Tu actividad</span>
          <StatRow icon="local_fire_department" value={stats.ideas} label="ideas compartidas" />
          <hr className="stats-card__sep" />
          <StatRow icon="chat_bubble" value={stats.replies} label="respuestas" />
          <hr className="stats-card__sep" />
          <StatRow icon="menu_book" value={stats.finished} label="libros terminados" />
        </div>
      </div>

      {/* ===== Tarjetas de lectura (móvil): el club y tus lecturas ===== */}
      {readings.length > 0 ? (
        readings.map((r, i) => (
          <ReadingStrip
            key={r.bookId}
            reading={r}
            extra={i > 0}
            kicker={i === 0 ? 'Sigues leyendo' : 'También estás leyendo'}
            onOpen={() => navigate(`/book/${r.bookId}`)}
          />
        ))
      ) : (
        <button className="reading-strip" onClick={() => navigate('/book')}>
          <span className="reading-strip__info title-small">
            Empieza el libro del club
          </span>
          <span className="material-symbols-rounded reading-strip__chev" aria-hidden="true">
            chevron_right
          </span>
        </button>
      )}

      {/* ===== Votación abierta ===== */}
      {data.openPoll && (
        <button className="poll-banner" onClick={() => navigate('/club')}>
          <span className="poll-banner__icon">
            <span className="material-symbols-rounded" aria-hidden="true">how_to_vote</span>
          </span>
          <span className="poll-banner__text">
            <span className="label-small poll-banner__kicker">
              Votación abierta
            </span>
            <span className="label-large">{data.openPoll.title}</span>
          </span>
          <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>
      )}

      {/* ===== Composer ===== */}
      <button className="composer-entry" onClick={() => void openCompose()}>
        <Avatar name={data.displayName} url={data.myAvatar} size={38} />
        <span className="composer-entry__hint body-medium">
          Comparte una idea…
        </span>
        <span className="composer-entry__plus material-symbols-rounded" aria-hidden="true">
          add
        </span>
      </button>

      {/* ===== Conversaciones activas ===== */}
      {conversations.length > 0 && (
        <>
          <SectionHeader title="Conversaciones activas" />
          <div className="conv-grid">
            {conversations.map((c) => (
              <button
                key={c.bookId}
                className="conv-card"
                onClick={() => navigate(`/book/${c.bookId}`)}
              >
                <BookCover
                  title={c.bookTitle}
                  author={c.author}
                  coverUrl={c.coverUrl}
                  size="md"
                />
                <div className="conv-card__body">
                  <span className="title-small serif conv-card__title">
                    {c.bookTitle}
                  </span>
                  <span className="body-small on-surface-variant">
                    Capítulos 1 – {c.upTo}
                  </span>
                  <span className="conv-card__foot">
                    <AvatarStack people={c.avatars} extra={c.extra} />
                    <span className="label-medium on-surface-variant conv-card__count">
                      <span className="material-symbols-rounded" aria-hidden="true">
                        chat_bubble
                      </span>
                      {c.count}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== Últimas ideas (el feed) ===== */}
      <SectionHeader title="Últimas ideas" />
      {/* auditoría B-09: grupo de botones con aria-pressed (lo aporta Chip) */}
      <div className="feed-filter" role="group" aria-label="Filtrar el feed">
        {FEED_FILTERS.map(({ key, label }) => (
          <Chip
            key={key}
            className="feed-filter__chip"
            active={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </Chip>
        ))}
      </div>
      {actionError && (
        <div className="feed-error body-medium" role="alert">
          {actionError}
        </div>
      )}
      {visibleFeed.length === 0 ? (
        <div className="feed-empty">
          <span className="material-symbols-rounded feed-empty__icon" aria-hidden="true">
            forum
          </span>
          <p className="body-large">{FILTER_EMPTY[filter]}</p>
          <p className="body-medium on-surface-variant">
            Sé el primero: comparte una teoría o una pregunta sobre lo que llevas
            leído.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {visibleFeed.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              mine={data.myId != null && item.authorId === data.myId}
              onDelete={onDeleteItem}
              onReact={onReact}
              onReply={onReply}
            />
          ))}
        </div>
      )}

      {/* ===== Descubre nuevas lecturas ===== */}
      {discover.length > 0 && (
        <>
          <SectionHeader title="Descubre nuevas lecturas" />
          <div className="discover-row">
            {discover.map((b) => (
              <div key={b.id} className="discover-item" title={`${b.title} · ${b.author}`}>
                <BookCover title={b.title} author={b.author} size="lg" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


/** Tarjeta de una lectura en curso (móvil). */
function ReadingStrip({
  reading,
  kicker,
  extra = false,
  onOpen,
}: {
  reading: HomeReading
  kicker: string
  /** lecturas 2ª en adelante: visibles también en escritorio (el hero ya enseña la 1ª) */
  extra?: boolean
  onOpen: () => void
}) {
  return (
    <button
      className={`reading-strip${extra ? ' reading-strip--extra' : ''}`}
      onClick={onOpen}
    >
      <BookCover
        title={reading.title}
        author={reading.author}
        coverUrl={reading.coverUrl}
        size="md"
      />
      <div className="reading-strip__info">
        <span className="label-small reading-strip__kicker">{kicker}</span>
        <span className="title-medium serif reading-strip__title">
          {reading.title}
        </span>
        <span className="body-small on-surface-variant reading-strip__where">
          {reading.chapterNumber > 0
            ? `Cap. ${reading.chapterNumber}${reading.chapterLabel ? ` · ${reading.chapterLabel}` : ''}`
            : 'Aún no has empezado'}
        </span>
        <span className="reading-strip__progress">
          <ProgressBar percent={reading.percent} />
          <span className="label-small on-surface-variant reading-strip__pct">
            {reading.percent}%
          </span>
        </span>
      </div>
      <span className="material-symbols-rounded reading-strip__chev" aria-hidden="true">
        chevron_right
      </span>
    </button>
  )
}

/** «miércoles, 16 de julio» — el uppercase lo pone el CSS */
function todayLabel() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Esqueleto de carga del Inicio: misma silueta que la pantalla real. */
export function HomeSkeleton() {
  return (
    <div className="home" aria-busy>
      <header className="home-today">
        <span className="label-medium home-today__date">{todayLabel()}</span>
        <h1 className="home-today__title serif">Hoy</h1>
      </header>
      <div className="skel" style={{ height: 118, borderRadius: 24, marginBottom: 12 }} />
      <div className="skel" style={{ height: 58, borderRadius: 999, marginBottom: 24 }} />
      <div className="skel" style={{ height: 22, width: 180, marginBottom: 14 }} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skel"
          style={{ height: 132, borderRadius: 20, marginBottom: 12 }}
        />
      ))}
    </div>
  )
}

function StatRow({
  icon,
  value,
  label,
}: {
  icon: string
  value: number
  label: string
}) {
  return (
    <div className="stat-row">
      <div>
        <div className="headline-medium stat-row__value">{value}</div>
        <div className="body-small on-surface-variant">{label}</div>
      </div>
      <span className="material-symbols-rounded stat-row__icon" aria-hidden="true">
        {icon}
      </span>
    </div>
  )
}

function FeedReplyRow({
  reply,
  onOpen,
}: {
  reply: FeedReply
  onOpen: () => void
}) {
  return (
    <div className="feed-reply">
      <Avatar name={reply.authorName} url={reply.authorAvatar} size={26} />
      <div className="feed-reply__content">
        {reply.body == null ? (
          <span className="feed-reply__locked body-small">
            <span className="material-symbols-rounded" aria-hidden="true">lock</span>
            Desbloquearás esta respuesta al llegar al capítulo{' '}
            {reply.unlockChapter}
          </span>
        ) : (
          <p
            className="body-small feed-reply__body"
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={pressKeys(onOpen)}
          >
            <span className="feed-reply__who">{reply.authorName}</span>{' '}
            {reply.body}
          </p>
        )}
      </div>
    </div>
  )
}

function FeedCard({
  item,
  mine,
  onDelete,
  onReact,
  onReply,
}: {
  item: FeedItem
  mine: boolean
  onDelete?: (id: string, type: 'idea' | 'post') => void
  onReact?: (discussionId: string, emoji: string | null) => void
  onReply?: (discussionId: string, body: string) => Promise<boolean> | void
}) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const isIdea = item.type === 'idea'
  const isReply = item.type === 'reply'
  const isPost = item.type === 'post'
  const unlocked = item.body != null

  // Hilo sobre el que se comenta (para responder / ver hilo)
  const threadId = isReply ? item.parent!.discussionId : item.id
  const go = () => {
    if (isIdea || isReply) navigate(`/thread/${threadId}`)
    else if (item.authorUsername) navigate(`/u/${item.authorUsername}`)
  }

  const chapterPart =
    isIdea && item.chapterNumber != null
      ? item.chapterLabel
        ? `Cap. ${item.chapterNumber} · ${item.chapterLabel}`
        : `Cap. ${item.chapterNumber}`
      : ''
  const metaLine = isIdea
    ? `${item.createdAt} · ${item.bookTitle} · ${chapterPart}`
    : isReply
      ? `${item.createdAt} · respondió`
      : `${item.createdAt} · En su muro`

  const kindChip = isIdea
    ? item.kind
      ? KIND_LABEL[item.kind]
      : 'Idea'
    : isReply
      ? 'Respuesta'
      : 'Entrada'

  // auditoría A-01: el input solo se limpia si la respuesta llegó a
  // publicarse (los stubs que devuelven void cuentan como éxito)
  const sendReply = async () => {
    const text = replyText.trim()
    if (!text || !onReply) return
    const ok = await onReply(threadId, text)
    if (ok !== false) {
      setReplyText('')
      setReplying(false)
    }
  }

  const meta = (
    <span className="feed-card__meta">
      <span className="title-small">{item.authorName}</span>
      <span className="body-small on-surface-variant">{metaLine}</span>
    </span>
  )

  return (
    <article className="feed-card">
      {/* Mensaje padre citado (contexto de la respuesta) */}
      {isReply && item.parent && (
        <button className="feed-quote" onClick={go}>
          <span className="feed-quote__head">
            <Avatar
              name={item.parent.authorName}
              url={item.parent.authorAvatar}
              size={22}
            />
            <span className="title-small">{item.parent.authorName}</span>
            <span className="body-small on-surface-variant feed-quote__meta">
              · {item.parent.bookTitle} · Cap. {item.parent.chapterNumber}
              {item.parent.chapterLabel ? ` · ${item.parent.chapterLabel}` : ''}
            </span>
          </span>
          {item.parent.body == null ? (
            <span className="feed-quote__locked body-small">
              <span className="material-symbols-rounded" aria-hidden="true">lock</span>
              Mensaje aún por delante de tu progreso
            </span>
          ) : (
            <span className="feed-quote__body body-medium">
              {item.parent.body}
            </span>
          )}
        </button>
      )}

      {/* Cabecera: ideas y posts (las tarjetas de hilo hablan por la cita) */}
      {!isReply && (
        <header className="feed-card__head">
          {item.authorUsername ? (
            <Link to={`/u/${item.authorUsername}`} className="feed-card__author">
              <Avatar name={item.authorName} url={item.authorAvatar} size={40} />
              {meta}
            </Link>
          ) : (
            <div className="feed-card__author">
              <Avatar name={item.authorName} url={item.authorAvatar} size={40} />
              {meta}
            </div>
          )}
          <span className="feed-card__chips">
            <span className="chip chip--kind label-small">{kindChip}</span>
            {item.isClub && <span className="chip chip--club label-small">Club</span>}
          </span>
        </header>
      )}

      {!isReply &&
        (!unlocked ? (
          <div style={{ margin: '12px 0 4px' }}>
            <LockedTeaser
              label={`Desbloquearás esta idea al llegar al capítulo ${item.chapterNumber}`}
            />
          </div>
        ) : isPost ? (
          // auditoría B-02: en entradas de muro el cuerpo no navega; al
          // perfil se llega por avatar/nombre, como en el resto de tarjetas
          <div className="feed-card__body feed-card__body--static body-large">
            {item.postTitle && (
              <div className="title-medium serif" style={{ marginBottom: 4 }}>
                {item.postTitle}
              </div>
            )}
            {item.body}
          </div>
        ) : (
          <div
            className="feed-card__body body-large"
            role="button"
            tabIndex={0}
            onClick={go}
            onKeyDown={pressKeys(go)}
          >
            {item.body}
          </div>
        ))}

      {/* Reacciones (solo ideas desbloqueadas) */}
      {isIdea && unlocked && onReact && (
        <div className="feed-card__reactions">
          <Reactions
            counts={item.reactions ?? {}}
            mine={item.myReaction ?? null}
            onReact={(emoji) => onReact(item.id, emoji)}
          />
        </div>
      )}

      {/* Respuestas colgando de la publicación (una sola vez, sin repetir) */}
      {(item.replies?.length ?? 0) > 0 && (
        <div className="feed-thread">
          {item.replies!.map((r) => (
            <FeedReplyRow key={r.id} reply={r} onOpen={go} />
          ))}
          {isIdea && (item.commentCount ?? 0) > item.replies!.length && (
            <button className="feed-thread__more label-medium" onClick={go}>
              Ver las {item.commentCount} respuestas
            </button>
          )}
        </div>
      )}

      {/* Caja de respuesta inline */}
      {replying && (
        <div className="feed-reply-box">
          <input
            className="tz-input feed-reply-box__input"
            aria-label="Escribe tu respuesta"
            placeholder="Escribe tu respuesta…"
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendReply()}
          />
          <button
            className="feed-reply-box__send"
            aria-label="Enviar respuesta"
            onClick={() => void sendReply()}
          >
            <span className="material-symbols-rounded" aria-hidden="true">send</span>
          </button>
        </div>
      )}

      <footer className="feed-card__foot">
        {(isIdea ? unlocked : isReply) && onReply && (
          <button className="feed-action" onClick={() => setReplying((v) => !v)}>
            <span className="material-symbols-rounded" aria-hidden="true">chat_bubble</span>
            {isIdea && (item.commentCount ?? 0) > 0
              ? item.commentCount
              : 'Responder'}
          </button>
        )}
        {(isIdea || isReply) && (
          <button className="feed-action" onClick={go}>
            <span className="material-symbols-rounded" aria-hidden="true">forum</span>
            Ver hilo
          </button>
        )}
        {mine && !isReply && onDelete && (
          <button
            className="feed-action feed-action--danger"
            onClick={() =>
              // auditoría M-04: diálogo propio en lugar de window.confirm
              void confirm({
                title: 'Eliminar publicación',
                message: '¿Eliminar esta publicación definitivamente? Esta acción no se puede deshacer.',
                confirmLabel: 'Eliminar',
                danger: true,
              }).then((ok) => {
                if (ok) onDelete(item.id, isPost ? 'post' : 'idea')
              })
            }
          >
            <span className="material-symbols-rounded" aria-hidden="true">delete</span>
            Eliminar
          </button>
        )}
      </footer>
    </article>
  )
}
