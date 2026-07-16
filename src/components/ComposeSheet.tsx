import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import type { DiscussionKind } from '../lib/database.types'
import { KIND_LABEL } from '../features/book/chapterTypes'
import { useModalBehavior } from './modal'
import { Chip } from './ui'
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
  /** cambia tras publicar con éxito: limpia el borrador (auditoría A-02) */
  resetToken?: number
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
  resetToken = 0,
  onPublish,
  onClose,
  onGoToBook,
}: Props) {
  const [kind, setKind] = useState<DiscussionKind>('comment')
  const [body, setBody] = useState('')
  const [toClub, setToClub] = useState(true)
  // índice del destino: -1 = general (sin libro), 0..n = un libro
  const [targetIdx, setTargetIdx] = useState(0)

  // Diálogo accesible (auditoría C-02): Escape, focus trap, restauración
  const sheetRef = useModalBehavior(open, onClose)

  useEffect(() => {
    if (open) {
      // El borrador (`body`) se conserva entre aperturas (auditoría A-02):
      // un toque accidental en el scrim ya no borra lo escrito.
      setKind('comment')
      setToClub(true)
      setTargetIdx(targets.length > 0 ? 0 : -1)
    }
  }, [open, targets.length])

  // Publicación con éxito (el provider incrementa el token): borrador fuera.
  useEffect(() => {
    setBody('')
  }, [resetToken])

  if (!open) return null

  const target = targetIdx >= 0 ? (targets[targetIdx] ?? null) : null
  const isBook = target != null

  const publish = () =>
    onPublish(kind, body.trim(), isBook && !!target.clubId && toClub, target)

  return (
    <div className="sheet-scrim" ref={sheetRef} onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
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
            <Chip
              key={t.bookId}
              icon="menu_book"
              active={targetIdx === i}
              onClick={() => setTargetIdx(i)}
            >
              {t.bookTitle}
            </Chip>
          ))}
          <Chip
            icon="edit"
            active={targetIdx === -1}
            onClick={() => setTargetIdx(-1)}
          >
            General
          </Chip>
        </div>

        {isBook && (
          <span className="sheet__anchor label-medium">
            <span className="material-symbols-rounded" aria-hidden="true">
              bookmark
            </span>
            Anclado a tu punto: Cap. {target.chapterNumber}
            {target.chapterLabel ? ` · ${target.chapterLabel}` : ''}
          </span>
        )}

        <textarea
          className="sheet__input body-large"
          aria-label={
            isBook ? 'Tu idea sobre este libro' : 'Entrada para tu muro'
          }
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
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </Chip>
              ))}
            </div>
            {target.clubId && (
              <Chip
                icon={toClub ? 'check_circle' : 'radio_button_unchecked'}
                active={toClub}
                onClick={() => setToClub((v) => !v)}
                className="club-toggle"
              >
                Compartir con el club
              </Chip>
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
            onClick={publish}
          >
            {submitting ? 'Publicando…' : 'Publicar'}
          </md-filled-button>
        </div>
      </div>
    </div>
  )
}
