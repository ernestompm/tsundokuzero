import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import {
  AvatarStack,
  BookCover,
  Card,
  ProgressBar,
  SectionHeader,
} from '../../components/ui'
import type { HomeData } from './homeTypes'
import './home.css'

export default function HomeView({ data }: { data: HomeData }) {
  const navigate = useNavigate()
  const { reading, stats, conversations, discover } = data

  return (
    <div className="home">
      <div className="home__main">
        <h1 className="home__greeting display-small">
          ¡Buenas, {data.displayName}!
        </h1>

        {/* ---- Hero: lectura actual + reto personal ---- */}
        <div className="home__hero">
          <Card className="reading-card" tone="default">
            <span className="label-medium reading-card__kicker">
              {reading ? 'Estás leyendo' : 'Tu lectura'}
            </span>
            {reading ? (
              <div className="reading-card__body">
                <div className="reading-card__info">
                  <h2 className="reading-card__title headline-medium serif">
                    {reading.title}
                  </h2>
                  <p className="body-medium on-surface-variant reading-card__meta">
                    {reading.author}
                    {reading.chapterLabel
                      ? ` · Cap. ${reading.chapterNumber}: ${reading.chapterLabel}`
                      : reading.chapterNumber > 0
                        ? ` · Capítulo ${reading.chapterNumber}`
                        : ''}
                  </p>
                  <div className="reading-card__progress">
                    <ProgressBar percent={reading.percent} />
                    <span className="label-medium on-surface-variant">
                      {reading.percent}%
                    </span>
                  </div>
                  <md-filled-button
                    onClick={() => navigate('/book')}
                    className="reading-card__cta"
                  >
                    Registrar progreso
                  </md-filled-button>
                </div>
                <div className="reading-card__cover">
                  <BookCover
                    title={reading.title}
                    author={reading.author}
                    coverUrl={reading.coverUrl}
                    size="lg"
                  />
                </div>
              </div>
            ) : (
              <div className="reading-card__empty">
                <p className="body-large">Aún no has empezado ningún libro.</p>
                <md-filled-button onClick={() => navigate('/book')}>
                  Empezar el libro del club
                </md-filled-button>
              </div>
            )}
          </Card>

          <Card className="stats-card" tone="soft">
            <span className="label-medium reading-card__kicker">Reto personal</span>
            <div className="stats-card__row">
              <div>
                <div className="display-small">{stats.streakDays}</div>
                <div className="body-small on-surface-variant">
                  días de racha
                </div>
              </div>
              <span className="material-symbols-rounded stats-card__icon">
                local_fire_department
              </span>
            </div>
            <hr className="stats-card__sep" />
            <div className="stats-card__row">
              <div>
                <div className="display-small">{stats.booksThisYear}</div>
                <div className="body-small on-surface-variant">
                  libros este año
                </div>
              </div>
              <span className="material-symbols-rounded stats-card__icon">
                menu_book
              </span>
            </div>
          </Card>
        </div>

        {/* ---- Conversaciones activas ---- */}
        <SectionHeader
          title="Conversaciones activas"
          actionLabel="Ver todas"
          actionTo="/book"
        />
        {conversations.length === 0 ? (
          <Card tone="outlined">
            <p className="body-medium on-surface-variant">
              Todavía no hay conversaciones en tu punto de lectura. Cuando
              avances, aparecerán aquí.
            </p>
          </Card>
        ) : (
          <div className="conv-grid">
            {conversations.map((c) => (
              <Link key={c.id} to="/book" className="conv-card">
                <BookCover
                  title={c.bookTitle}
                  author={c.author}
                  coverUrl={c.coverUrl}
                  size="md"
                />
                <div className="conv-card__body">
                  <h3 className="title-medium conv-card__title serif">
                    {c.bookTitle}
                  </h3>
                  <p className="body-small on-surface-variant">{c.range}</p>
                  <div className="conv-card__foot">
                    <AvatarStack names={c.avatars} extra={c.extra} />
                    <span className="label-medium on-surface-variant conv-card__count">
                      <span className="material-symbols-rounded">chat_bubble</span>
                      {c.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ---- Descubre nuevas lecturas ---- */}
        {discover.length > 0 && (
          <>
            <SectionHeader
              title="Descubre nuevas lecturas"
              actionLabel="Ver todas"
              actionTo="/explore"
            />
            <div className="discover-row">
              {discover.map((b) => (
                <div key={b.id} className="discover-item">
                  <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} size="lg" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
