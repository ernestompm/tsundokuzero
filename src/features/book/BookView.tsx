import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-tonal-button.js'
import { BookCover, Card } from '../../components/ui'
import Stars from '../../components/Stars'
import type { BookViewData } from './bookTypes'
import './book.css'

interface Props {
  data: BookViewData
  busy?: boolean
  onSetChapter: (n: number) => void
  onOpenChapter: (n: number) => void
  onRate?: (n: number, review: string | null) => void
  onAddToShelf?: (status: 'want' | 'reading') => void
}

export default function BookView({
  data,
  busy,
  onSetChapter,
  onOpenChapter,
  onRate,
  onAddToShelf,
}: Props) {
  const [showSynopsis, setShowSynopsis] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(data.myReview ?? '')
  const [pendingStars, setPendingStars] = useState(data.myRating ?? 0)
  const [showAll, setShowAll] = useState(false)
  const { currentChapter, totalChapters } = data
  // Borrador del slider: se confirma con «Guardar», nada de 40 toques.
  const [draft, setDraft] = useState(currentChapter)
  useEffect(() => setDraft(currentChapter), [currentChapter])

  const draftLabel =
    draft === 0
      ? 'Sin empezar'
      : (data.chapters.find((c) => c.number === draft)?.label ??
        `Capítulo ${draft}`)

  const unlocked = data.chapters.filter((c) => c.unlocked)
  const withActivity = unlocked.filter((c) => c.commentCount > 0)
  const lockedCount = totalChapters - unlocked.length
  const listed = showAll ? unlocked : withActivity

  return (
    <section className="book">
      <Card className="book-head" tone="default">
        <BookCover
          title={data.title}
          author={data.author}
          coverUrl={data.coverUrl}
          size="lg"
        />
        <div className="book-head__info">
          <h1 className="headline-small serif book-head__title">{data.title}</h1>
          <p className="body-medium on-surface-variant">
            {data.authorId ? (
              <Link to={`/author/${data.authorId}`} className="book-author-link">
                {data.author}
              </Link>
            ) : (
              data.author
            )}
          </p>
          {data.ratingCount > 0 && data.avgRating != null && (
            <p className="book-rating-line">
              <Stars value={data.avgRating} size={17} />
              <span className="label-medium on-surface-variant">
                {data.avgRating.toFixed(1)} · {data.ratingCount}{' '}
                {data.ratingCount === 1 ? 'valoración' : 'valoraciones'}
              </span>
            </p>
          )}

          <div className="book-progress">
            <span className="label-medium book-progress__kicker">Tu progreso</span>
            <div className="book-progress__stepper">
              <md-icon-button
                aria-label="Capítulo anterior"
                disabled={draft <= 0 || busy || undefined}
                onClick={() => setDraft((d) => Math.max(0, d - 1))}
              >
                <span className="material-symbols-rounded">remove</span>
              </md-icon-button>
              <div className="book-progress__label">
                <span className="title-medium serif">{draftLabel}</span>
                <span className="label-small on-surface-variant">
                  {draft > 0 ? `${draft} de ${totalChapters}` : `${totalChapters} capítulos`}
                </span>
              </div>
              <md-icon-button
                aria-label="Capítulo siguiente"
                disabled={draft >= totalChapters || busy || undefined}
                onClick={() => setDraft((d) => Math.min(totalChapters, d + 1))}
              >
                <span className="material-symbols-rounded">add</span>
              </md-icon-button>
            </div>
            <input
              type="range"
              className="progress-slider"
              min={0}
              max={totalChapters}
              value={draft}
              aria-label="Capítulo por el que vas"
              onChange={(e) => setDraft(Number(e.target.value))}
            />
            {draft !== currentChapter && (
              <md-filled-button
                className="book-progress__save"
                disabled={busy || undefined}
                onClick={() => onSetChapter(draft)}
              >
                {draft === 0
                  ? 'Marcar como sin empezar'
                  : `Guardar · capítulo ${draft}`}
              </md-filled-button>
            )}
          </div>
        </div>
      </Card>

      {(data.synopsis || data.buyUrl) && (
        <Card tone="soft" className="book-extra">
          {data.synopsis && (
            <>
              <p
                className={`body-medium book-synopsis${showSynopsis ? ' open' : ''}`}
              >
                {data.synopsis}
              </p>
              <button
                className="book-synopsis-toggle label-large"
                onClick={() => setShowSynopsis((v) => !v)}
              >
                {showSynopsis ? 'Mostrar menos' : 'Leer sinopsis completa'}
              </button>
            </>
          )}
          {data.buyUrl && (
            <a
              href={data.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="book-buy"
            >
              <md-outlined-button>
                <span slot="icon" className="material-symbols-rounded">
                  shopping_bag
                </span>
                Comprar el libro
              </md-outlined-button>
            </a>
          )}
        </Card>
      )}

      {/* Añadir a la biblioteca si no está */}
      {(data.status == null || data.status === 'want') && onAddToShelf && (
        <div className="book-shelf-actions">
          {data.status == null && (
            <md-outlined-button onClick={() => onAddToShelf('want')}>
              <span slot="icon" className="material-symbols-rounded">bookmark</span>
              Añadir a «por leer»
            </md-outlined-button>
          )}
          <md-filled-button onClick={() => onAddToShelf('reading')}>
            Empezar a leer
          </md-filled-button>
        </div>
      )}

      {/* Terminado: reseña + estrellas */}
      {data.canRate && onRate && (
        <Card tone="default" className="book-review">
          <span className="title-small">
            {data.myRating ? 'Tu reseña' : '¡Terminado! ¿Qué te ha parecido?'}
          </span>
          <Stars
            value={pendingStars}
            onRate={(n) => {
              setPendingStars(n)
              onRate(n, reviewDraft.trim() || null)
            }}
            size={30}
          />
          <textarea
            className="book-review__text body-medium"
            rows={3}
            placeholder="Deja una reseña para el club (opcional)…"
            value={reviewDraft}
            onChange={(e) => setReviewDraft(e.target.value)}
          />
          {pendingStars > 0 && (
            <md-filled-button
              disabled={busy || undefined}
              onClick={() => onRate(pendingStars, reviewDraft.trim() || null)}
            >
              Guardar reseña
            </md-filled-button>
          )}
        </Card>
      )}

      {/* Reseñas de otros lectores (ocultas hasta terminar el libro) */}
      {(data.reviews.length > 0 || data.hiddenReviews > 0) && (
        <div className="book-others-reviews">
          <h2 className="title-small book-sec__title">Reseñas del club</h2>
          {data.status !== 'finished' && data.hiddenReviews > 0 ? (
            <Card tone="outlined" className="review-locked">
              <span className="material-symbols-rounded">lock</span>
              <p className="body-medium">
                Hay {data.hiddenReviews}{' '}
                {data.hiddenReviews === 1 ? 'reseña' : 'reseñas'} del club, pero
                pueden contener spoilers. <b>Termina el libro</b> para leerlas.
              </p>
            </Card>
          ) : (
            data.reviews.map((r, i) => (
              <Card key={i} tone="soft" className="review-card">
                <div className="review-card__head">
                  <span className="title-small">{r.name}</span>
                  <Stars value={r.rating} size={15} />
                </div>
                <p className="body-medium">{r.review}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {currentChapter > 0 && (
        <md-filled-button
          className="book-enter"
          onClick={() => onOpenChapter(currentChapter)}
        >
          <span slot="icon" className="material-symbols-rounded">forum</span>
          Conversación de tu capítulo
        </md-filled-button>
      )}

      <div className="book-sec">
        <h2 className="title-small book-sec__title">
          {showAll ? 'Capítulos leídos' : 'Conversaciones activas'}
        </h2>
        {listed.length === 0 ? (
          <Card tone="outlined">
            <p className="body-medium on-surface-variant">
              {currentChapter === 0
                ? 'Marca por dónde vas para desbloquear las conversaciones.'
                : 'Todavía no hay conversaciones en lo que llevas leído. Estrena una desde tu capítulo.'}
            </p>
          </Card>
        ) : (
          <ul className="chapter-list">
            {listed.map((c) => (
              <li key={c.number}>
                <button
                  className={`chapter-row${c.isCurrent ? ' current' : ''}`}
                  onClick={() => onOpenChapter(c.number)}
                >
                  <span className="chapter-row__num">{c.number}</span>
                  <span className="chapter-row__title serif">
                    {c.label ?? `Capítulo ${c.number}`}
                  </span>
                  {c.isCurrent && (
                    <span className="chip chip--here label-small">Estás aquí</span>
                  )}
                  <span className="chapter-row__count label-medium">
                    <span className="material-symbols-rounded">chat_bubble</span>
                    {c.commentCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {unlocked.length > withActivity.length && (
          <button
            className="book-toggle label-large"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? 'Ver solo las conversaciones activas'
              : `Ver todos los capítulos leídos (${unlocked.length})`}
          </button>
        )}

        {lockedCount > 0 && (
          <p className="body-small on-surface-variant book-locked-note">
            <span className="material-symbols-rounded">lock</span>
            {lockedCount} capítulos por delante se desbloquean según avanzas.
          </p>
        )}
      </div>
    </section>
  )
}
