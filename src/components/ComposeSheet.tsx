import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import type { DiscussionKind } from '../lib/database.types'
import { KIND_LABEL } from '../features/book/chapterTypes'
import './ComposeSheet.css'

export interface ComposeTarget {
  bookId: string
  bookTitle: string
  chapterNumber: number
  chapterLabel: string | null
  clubId: string | null
}

interface Props {
  open: boolean
  /** libros que estás leyendo (posibles anclajes); vacío = solo general */
  targets: ComposeTarget[]
  submitting?: boolean
  error?: string | null
  onPublish: (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
    target: ComposeTarget | null,
  ) => void
  onClose: () => void
  onGoToBook?: () => void
}

const KINDS: DiscussionKind[] = ['comment', 'theory', 'question']

export default function ComposeSheet({
  open,
  targets,
  submitting,
  error,
  onPublish,
  onClose,
  onGoToBook,
}: Props) {
  const [kind, setKind] = useState<DiscussionKind>('comment')
  const [body, setBody] = useState('')
  const [toClub, setToClub] = useState(true)
  // índice del destino: -1 = general (sin libro), 0..n = un libro
  const [targetIdx, setTargetIdx] = useState(0)

  useEffect(() => {
    if (open) {
      setKind('comment')
      setBody('')
      setToClub(true)
      setTargetIdx(targets.length > 0 ? 0 : -1)
    }
  }, [open, targets.length])

  if (!open) return null

  const target = targetIdx >= 0 ? (targets[targetIdx] ?? null) : null
  const isBook = target != null

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Nueva publicación"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2 className="title-large serif">Comparte algo</h2>
        </div>

        {/* ¿Sobre un libro o general? */}
        <div className="sheet__targets">
          {targets.map((t, i) => (
            <button
              key={t.bookId}
              type="button"
              className={`target-chip label-medium${targetIdx === i ? ' active' : ''}`}
              onClick={() => setTargetIdx(i)}
            >
              <span className="material-symbols-rounded">menu_book</span>
              {t.bookTitle}
            </button>
          ))}
          <button
            type="button"
            className={`target-chip label-medium${targetIdx === -1 ? ' active' : ''}`}
            onClick={() => setTargetIdx(-1)}
          >
            <span className="material-symbols-rounded">edit</span>
            General
          </button>
        </div>

        {isBook && (
          <span className="sheet__anchor label-medium">
            <span className="material-symbols-rounded">bookmark</span>
            Anclado a tu punto: Cap. {target.chapterNumber}
            {target.chapterLabel ? ` · ${target.chapterLabel}` : ''}
          </span>
        )}

        <textarea
          className="sheet__input body-large"
          placeholder={
            isBook
              ? '¿Qué te ha hecho pensar este capítulo?'
              : 'Escribe una entrada para tu muro…'
          }
          rows={4}
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {isBook && (
          <>
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
            {target.clubId && (
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
          </>
        )}

        {targets.length === 0 && (
          <p className="body-small on-surface-variant" style={{ marginTop: 8 }}>
            Para publicar una idea anclada a un libro, marca primero tu progreso
            en la biblioteca. Mientras, puedes escribir una entrada general.
          </p>
        )}

        {error && <p className="sheet__error body-medium">{error}</p>}

        <div className="sheet__actions">
          {onGoToBook && (
            <md-text-button onClick={onGoToBook}>Mi biblioteca</md-text-button>
          )}
          <span style={{ flex: 1 }} />
          <md-text-button onClick={onClose}>Cancelar</md-text-button>
          <md-filled-button
            disabled={!body.trim() || submitting || undefined}
            onClick={() =>
              onPublish(kind, body.trim(), isBook && !!target.clubId && toClub, target)
            }
          >
            {submitting ? 'Publicando…' : 'Publicar'}
          </md-filled-button>
        </div>
      </div>
    </div>
  )
}
