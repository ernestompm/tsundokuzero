import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import {
  Avatar,
  AvatarStack,
  BookCover,
  ProgressBar,
  SectionHeader,
} from '../../components/ui'
import { useCompose } from '../../components/ComposeProvider'
import { KIND_LABEL } from '../book/chapterTypes'
import type { FeedItem, HomeData } from './homeTypes'
import './home.css'

interface Props {
  data: HomeData
  onDeleteItem?: (id: string, type: 'idea' | 'post') => void
}

export default function HomeView({ data, onDeleteItem }: Props) {
  const navigate = useNavigate()
  const { openCompose } = useCompose()
  const { reading, stats, conversations, discover, feed } = data

  return (
    <div className="home">
      {/* ===== Hero (escritorio): lectura actual + reto personal ===== */}
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
          <span className="label-medium hero-card__kicker">Reto personal</span>
          <StatRow icon="local_fire_department" value={stats.ideas} label="ideas compartidas" />
          <hr className="stats-card__sep" />
          <StatRow icon="chat_bubble" value={stats.replies} label="respuestas" />
          <hr className="stats-card__sep" />
          <StatRow icon="menu_book" value={stats.finished} label="libros terminados" />
        </div>
      </div>

      {/* ===== Lectura compacta (móvil) ===== */}
      <button
        className="reading-strip"
        onClick={() => navigate(reading ? `/book/${reading.bookId}` : '/book')}
      >
        {reading ? (
          <>
            <BookCover
              title={reading.title}
              author={reading.author}
              coverUrl={reading.coverUrl}
              size="sm"
            />
            <div className="reading-strip__info">
              <span className="label-small reading-strip__kicker">
                {reading.title}
              </span>
              <span className="title-small serif reading-strip__where">
                {reading.chapterNumber > 0
                  ? `Cap. ${reading.chapterNumber}${reading.chapterLabel ? ` · ${reading.chapterLabel}` : ''}`
                  : 'Aún no has empezado'}
              </span>
              <ProgressBar percent={reading.percent} />
            </div>
          </>
        ) : (
          <span className="reading-strip__info title-small">
            Empieza el libro del club
          </span>
        )}
        <span className="material-symbols-rounded reading-strip__chev">
          chevron_right
        </span>
      </button>

      {/* ===== Votación abierta ===== */}
      {data.openPoll && (
        <button className="poll-banner" onClick={() => navigate('/club')}>
          <span className="material-symbols-rounded">how_to_vote</span>
          <span className="label-large">
            Votación abierta: {data.openPoll.title}
          </span>
          <span className="material-symbols-rounded">chevron_right</span>
        </button>
      )}

      {/* ===== Composer ===== */}
      <button className="composer-entry" onClick={() => void openCompose()}>
        <Avatar name={data.displayName} size={38} />
        <span className="composer-entry__hint body-medium">
          Comparte una idea…
        </span>
        <span className="composer-entry__plus material-symbols-rounded">add</span>
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
                    <AvatarStack names={c.avatars} extra={c.extra} />
                    <span className="label-medium on-surface-variant conv-card__count">
                      <span className="material-symbols-rounded">chat_bubble</span>
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
      {feed.length === 0 ? (
        <div className="feed-empty">
          <span className="material-symbols-rounded feed-empty__icon">forum</span>
          <p className="body-large">Aún no hay ideas en tu punto de lectura.</p>
          <p className="body-medium on-surface-variant">
            Sé el primero: comparte una teoría o una pregunta sobre lo que llevas
            leído.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {feed.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              mine={data.myId != null && item.authorId === data.myId}
              onDelete={onDeleteItem}
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
      <span className="material-symbols-rounded stat-row__icon">{icon}</span>
    </div>
  )
}

function FeedCard({
  item,
  mine,
  onDelete,
}: {
  item: FeedItem
  mine: boolean
  onDelete?: (id: string, type: 'idea' | 'post') => void
}) {
  const navigate = useNavigate()
  const isIdea = item.type === 'idea'
  const go = () => {
    if (isIdea) navigate(`/book/${item.bookId}/chapter/${item.chapterNumber}`)
    else if (item.authorUsername) navigate(`/u/${item.authorUsername}`)
  }

  const metaLine = isIdea
    ? `${item.createdAt} · ${item.bookTitle} · Cap. ${item.chapterNumber}`
    : `${item.createdAt} · En su muro`

  return (
    <article className="feed-card">
      <header className="feed-card__head">
        {item.authorUsername ? (
          <Link to={`/u/${item.authorUsername}`} className="feed-card__author">
            <Avatar name={item.authorName} size={40} />
            <span className="feed-card__meta">
              <span className="title-small">{item.authorName}</span>
              <span className="body-small on-surface-variant">{metaLine}</span>
            </span>
          </Link>
        ) : (
          <div className="feed-card__author">
            <Avatar name={item.authorName} size={40} />
            <span className="feed-card__meta">
              <span className="title-small">{item.authorName}</span>
              <span className="body-small on-surface-variant">{metaLine}</span>
            </span>
          </div>
        )}
        <span className="feed-card__chips">
          <span className="chip chip--kind label-small">
            {isIdea && item.kind ? KIND_LABEL[item.kind] : 'Entrada'}
          </span>
          {item.isClub && <span className="chip chip--club label-small">Club</span>}
        </span>
      </header>

      <div className="feed-card__body body-large" onClick={go}>
        {item.postTitle && (
          <div className="title-medium serif" style={{ marginBottom: 4 }}>
            {item.postTitle}
          </div>
        )}
        {item.body}
      </div>

      <footer className="feed-card__foot">
        {isIdea && (
          <button className="feed-action" onClick={go}>
            <span className="material-symbols-rounded">chat_bubble</span>
            {item.commentCount > 0 ? item.commentCount : 'Responder'}
          </button>
        )}
        {mine && (
          <>
            {isIdea && (
              <button className="feed-action" onClick={go}>
                <span className="material-symbols-rounded">edit</span>
                Editar
              </button>
            )}
            {onDelete && (
              <button
                className="feed-action feed-action--danger"
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Eliminar esta publicación definitivamente?',
                    )
                  )
                    onDelete(item.id, item.type)
                }}
              >
                <span className="material-symbols-rounded">delete</span>
                Eliminar
              </button>
            )}
          </>
        )}
      </footer>
    </article>
  )
}
