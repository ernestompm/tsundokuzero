import { useEffect, useRef, useState } from 'react'
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
  /** error al guardar la reseña (auditoría A-03) */
  rateError?: string | null
  onSetChapter: (n: number) => void
  onOpenChapter: (n: number) => void
  /** puede devolver éxito/fallo; `void` sigue valiendo (previews) */
  onRate?: (n: number, review: string | null) => Promise<boolean> | void
  onAddToShelf?: (status: 'want' | 'reading') => void
}

export default function BookView({
  data,
  busy,
  rateError,
  onSetChapter,
  onOpenChapter,
  onRate,
  onAddToShelf,
}: Props) {
  const [showSynopsis, setShowSynopsis] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(data.myReview ?? '')
  const [pendingStars, setPendingStars] = useState(data.myRating ?? 0)
  // auditoría A-03: confirmación inline «Reseña guardada», autodescartable
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(savedTimer.current), [])
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
        <div className="book-head__coverwrap">
          <BookCover
            title={data.title}
            author={data.author}
            coverUrl={data.coverUrl}
            size="lg"
          />
          {data.coverUrl && data.coverSource && (
            <span className="book-cover-credit label-small on-surface-variant">
              Portada: {data.coverSource}
            </span>
          )}
        </div>
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
                <span className="material-symbols-rounded" aria-hidden="true">remove</span>
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
                <span className="material-symbols-rounded" aria-hidden="true">add</span>
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
                <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
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
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">bookmark</span>
              Añadir a «por leer»
            </md-outlined-button>
          )}
          <md-filled-button onClick={() => onAddToShelf('reading')}>
            Empezar a leer
          </md-filled-button>
        </div>
      )}

      {/* Terminado: reseña + estrellas.
          auditoría A-03: un solo gesto de guardado — las estrellas solo
          actualizan el borrador; «Guardar reseña» envía todo junto. */}
      {data.canRate && onRate && (
        <Card tone="default" className="book-review">
          <span className="title-small">
            {data.myRating ? 'Tu reseña' : '¡Terminado! ¿Qué te ha parecido?'}
          </span>
          <Stars
            value={pendingStars}
            onRate={(n) => setPendingStars(n)}
            size={30}
          />
          <textarea
            className="book-review__text body-medium"
            rows={3}
            placeholder="Deja una reseña para el club (opcional)…"
            aria-label="Tu reseña del libro"
            value={reviewDraft}
            onChange={(e) => setReviewDraft(e.target.value)}
          />
          {rateError && (
            <p className="book-review__error body-small" role="alert">
              {rateError}
            </p>
          )}
          <md-filled-button
            disabled={
              busy ||
              pendingStars === 0 ||
              (pendingStars === (data.myRating ?? 0) &&
                reviewDraft.trim() === (data.myReview ?? '')) ||
              undefined
            }
            onClick={() =>
              void (async () => {
                const ok = await onRate(pendingStars, reviewDraft.trim() || null)
                if (ok !== false) {
                  window.clearTimeout(savedTimer.current)
                  setJustSaved(true)
                  savedTimer.current = window.setTimeout(
                    () => setJustSaved(false),
                    3000,
                  )
                }
              })()
            }
          >
            Guardar reseña
          </md-filled-button>
          {justSaved && (
            <span className="book-review__saved label-medium" role="status">
              <span className="material-symbols-rounded" aria-hidden="true">
                check_circle
              </span>
              Reseña guardada
            </span>
          )}
        </Card>
      )}

      {/* Reseñas de otros lectores (ocultas hasta terminar el libro) */}
      {(data.reviews.length > 0 || data.hiddenReviews > 0) && (
        <div className="book-others-reviews">
          <h2 className="title-small book-sec__title">Reseñas del club</h2>
          {data.status !== 'finished' && data.hiddenReviews > 0 ? (
            <Card tone="outlined" className="review-locked">
              <span className="material-symbols-rounded" aria-hidden="true">lock</span>
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
          <span slot="icon" className="material-symbols-rounded" aria-hidden="true">forum</span>
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
                    <span className="material-symbols-rounded" aria-hidden="true">chat_bubble</span>
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
            <span className="material-symbols-rounded" aria-hidden="true">lock</span>
            {lockedCount} capítulos por delante se desbloquean según avanzas.
          </p>
        )}
      </div>
    </section>
  )
}
