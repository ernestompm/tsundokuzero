import { useEffect, useState } from 'react'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/button/filled-button.js'
import { BookCover, Card } from '../../components/ui'
import type { BookViewData } from './bookTypes'
import './book.css'

interface Props {
  data: BookViewData
  busy?: boolean
  onSetChapter: (n: number) => void
  onOpenChapter: (n: number) => void
}

export default function BookView({
  data,
  busy,
  onSetChapter,
  onOpenChapter,
}: Props) {
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
            {data.author} · Libro del club
          </p>

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
