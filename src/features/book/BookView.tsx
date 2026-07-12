import { useState } from 'react'
import '@material/web/iconbutton/icon-button.js'
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
  const [tab, setTab] = useState<'conv' | 'info'>('conv')
  const { currentChapter, totalChapters } = data

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
                disabled={currentChapter <= 0 || busy || undefined}
                onClick={() => onSetChapter(currentChapter - 1)}
              >
                <span className="material-symbols-rounded">remove</span>
              </md-icon-button>
              <div className="book-progress__label">
                {currentChapter === 0 ? (
                  <span className="title-medium">Sin empezar</span>
                ) : (
                  <>
                    <span className="title-medium serif">
                      {data.currentLabel ?? `Capítulo ${currentChapter}`}
                    </span>
                    <span className="label-small on-surface-variant">
                      {currentChapter} de {totalChapters}
                    </span>
                  </>
                )}
              </div>
              <md-icon-button
                aria-label="Capítulo siguiente"
                disabled={currentChapter >= totalChapters || busy || undefined}
                onClick={() => onSetChapter(currentChapter + 1)}
              >
                <span className="material-symbols-rounded">add</span>
              </md-icon-button>
            </div>
          </div>
        </div>
      </Card>

      <div className="book-tabs">
        <button
          className={`book-tab${tab === 'conv' ? ' active' : ''}`}
          onClick={() => setTab('conv')}
        >
          Conversaciones
        </button>
        <button
          className={`book-tab${tab === 'info' ? ' active' : ''}`}
          onClick={() => setTab('info')}
        >
          Información
        </button>
      </div>

      {tab === 'info' ? (
        <Card tone="soft">
          <p className="body-medium">
            {data.title}, de {data.author}. {totalChapters} capítulos. Cada
            capítulo abre su propia conversación, que solo se desbloquea cuando
            llegas a él.
          </p>
        </Card>
      ) : (
        <>
          <h2 className="title-small book-list__kicker">
            Conversación por capítulo
          </h2>
          <ul className="chapter-list">
            {data.chapters.map((c) =>
              c.unlocked ? (
                <li key={c.number}>
                  <button
                    className={`chapter-row${c.isCurrent ? ' current' : ''}`}
                    onClick={() => onOpenChapter(c.number)}
                  >
                    <span className="chapter-row__num">{c.number}</span>
                    <span className="chapter-row__title serif">{c.label}</span>
                    {c.isCurrent && (
                      <span className="chip chip--here label-small">Estás aquí</span>
                    )}
                    <span className="chapter-row__count label-medium">
                      <span className="material-symbols-rounded">chat_bubble</span>
                      {c.commentCount}
                    </span>
                  </button>
                </li>
              ) : (
                <li key={c.number}>
                  <div className="chapter-row locked">
                    <span className="chapter-row__num">{c.number}</span>
                    <span className="chapter-row__title on-surface-variant">
                      Capítulo {c.number}
                    </span>
                    <span className="material-symbols-rounded chapter-row__lock">
                      lock
                    </span>
                  </div>
                </li>
              ),
            )}
          </ul>
          <p className="body-small on-surface-variant chapter-list__foot">
            Los capítulos que aún no has alcanzado se muestran bloqueados: ni su
            título ni su conversación aparecen hasta que llegues a ellos.
          </p>
        </>
      )}
    </section>
  )
}
