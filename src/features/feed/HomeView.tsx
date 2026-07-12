import { useNavigate } from 'react-router-dom'
import { Avatar, BookCover, ProgressBar } from '../../components/ui'
import { useCompose } from '../../components/ComposeProvider'
import { KIND_LABEL } from '../book/chapterTypes'
import type { FeedItem, HomeData } from './homeTypes'
import './home.css'

export default function HomeView({ data }: { data: HomeData }) {
  const navigate = useNavigate()
  const { openCompose } = useCompose()
  const { reading, feed } = data

  return (
    <div className="feed">
      {/* Estado de lectura compacto */}
      {reading ? (
        <button className="reading-strip" onClick={() => navigate('/book')}>
          <BookCover
            title={reading.title}
            author={reading.author}
            coverUrl={reading.coverUrl}
            size="sm"
          />
          <div className="reading-strip__info">
            <span className="label-small reading-strip__kicker">Vas por</span>
            <span className="title-small serif reading-strip__where">
              {reading.chapterNumber > 0
                ? `Cap. ${reading.chapterNumber}${reading.chapterLabel ? ` · ${reading.chapterLabel}` : ''}`
                : 'Aún no has empezado'}
            </span>
            <ProgressBar percent={reading.percent} />
          </div>
          <span className="material-symbols-rounded reading-strip__chev">
            chevron_right
          </span>
        </button>
      ) : (
        <button className="reading-strip" onClick={() => navigate('/book')}>
          <span className="reading-strip__info title-small">
            Empieza el libro del club
          </span>
          <span className="material-symbols-rounded reading-strip__chev">
            chevron_right
          </span>
        </button>
      )}

      {/* Entrada al composer */}
      <button className="composer-entry" onClick={() => void openCompose()}>
        <Avatar name={data.displayName} size={38} />
        <span className="composer-entry__hint body-medium">
          Comparte una idea…
        </span>
        <span className="composer-entry__plus material-symbols-rounded">add</span>
      </button>

      {/* Feed */}
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
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const navigate = useNavigate()
  const go = () => navigate(`/chapter/${item.chapterNumber}`)

  return (
    <article className="feed-card">
      <header className="feed-card__head">
        <Avatar name={item.authorName} size={40} />
        <div className="feed-card__meta">
          <span className="title-small">{item.authorName}</span>
          <span className="body-small on-surface-variant">
            {item.createdAt} · Cap. {item.chapterNumber}
            {item.chapterLabel ? ` · ${item.chapterLabel}` : ''}
          </span>
        </div>
      </header>

      <div className="feed-card__chips">
        <span className="chip chip--kind label-small">
          {KIND_LABEL[item.kind]}
        </span>
        {item.isClub && (
          <span className="chip chip--club label-small">Club</span>
        )}
      </div>

      <p className="feed-card__body body-large" onClick={go}>
        {item.body}
      </p>

      <footer className="feed-card__foot">
        <button className="feed-action" onClick={go}>
          <span className="material-symbols-rounded">chat_bubble</span>
          {item.commentCount > 0 ? item.commentCount : 'Responder'}
        </button>
      </footer>
    </article>
  )
}
