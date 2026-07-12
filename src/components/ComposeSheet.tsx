import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import type { DiscussionKind } from '../lib/database.types'
import { KIND_LABEL } from '../features/book/chapterTypes'
import './ComposeSheet.css'

interface Props {
  open: boolean
  /** Libro y capítulo al que queda anclada la idea (tu lectura actual). */
  bookTitle?: string | null
  chapterNumber: number
  chapterLabel: string | null
  canWrite: boolean
  clubAvailable?: boolean
  submitting?: boolean
  onPublish: (kind: DiscussionKind, body: string, toClub: boolean) => void
  onClose: () => void
  onGoToBook?: () => void
}

const KINDS: DiscussionKind[] = ['comment', 'theory', 'question']

export default function ComposeSheet({
  open,
  bookTitle,
  chapterNumber,
  chapterLabel,
  canWrite,
  clubAvailable = true,
  submitting,
  onPublish,
  onClose,
  onGoToBook,
}: Props) {
  const [kind, setKind] = useState<DiscussionKind>('comment')
  const [body, setBody] = useState('')
  const [toClub, setToClub] = useState(true)

  useEffect(() => {
    if (open) {
      setKind('comment')
      setBody('')
      setToClub(true)
    }
  }, [open])

  if (!open) return null

  const anchor =
    chapterNumber > 0
      ? `${bookTitle ? `${bookTitle} · ` : ''}Cap. ${chapterNumber}${chapterLabel ? ` · ${chapterLabel}` : ''}`
      : null

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Nueva idea"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" />
        {canWrite ? (
          <>
            <div className="sheet__head">
              <h2 className="title-large serif">Comparte una idea</h2>
              {anchor && (
                <span className="sheet__anchor label-medium">
                  <span className="material-symbols-rounded">bookmark</span>
                  {anchor}
                </span>
              )}
            </div>

            <textarea
              className="sheet__input body-large"
              placeholder="¿Qué te ha hecho pensar este capítulo?"
              rows={4}
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            <div className="sheet__kinds">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`kind-chip label-medium${kind === k ? ' active' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>

            {clubAvailable && (
              <button
                type="button"
                className={`club-toggle label-medium${toClub ? ' active' : ''}`}
                onClick={() => setToClub((v) => !v)}
              >
                <span className="material-symbols-rounded">
                  {toClub ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                Compartir con el club
              </button>
            )}

            <div className="sheet__actions">
              <md-text-button onClick={onClose}>Cancelar</md-text-button>
              <md-filled-button
                disabled={!body.trim() || submitting || undefined}
                onClick={() => onPublish(kind, body.trim(), clubAvailable && toClub)}
              >
                Publicar
              </md-filled-button>
            </div>
          </>
        ) : (
          <div className="sheet__blocked">
            <span className="material-symbols-rounded sheet__blocked-icon">
              menu_book
            </span>
            <h2 className="title-large serif">Marca por dónde vas</h2>
            <p className="body-medium on-surface-variant">
              Para compartir una idea primero dinos en qué capítulo del libro
              estás. Así todo queda anclado a tu punto y nunca es un spoiler.
            </p>
            <div className="sheet__actions">
              <md-text-button onClick={onClose}>Ahora no</md-text-button>
              <md-filled-button onClick={onGoToBook}>
                Ir al libro
              </md-filled-button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
