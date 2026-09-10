import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import type { DiscussionKind } from '../lib/database.types'
import { KIND_LABEL } from '../features/book/chapterTypes'
import { useModalBehavior } from './modal'
import { BookCover, Chip } from './ui'
import MentionTextarea from './MentionTextarea'
import './ComposeSheet.css'

export interface ComposeTarget {
  bookId: string
  bookTitle: string
  bookAuthor: string
  coverUrl: string | null
  chapterNumber: number
  chapterLabel: string | null
  clubId: string | null
  /** ya lo terminaste: no se ofrece por defecto, solo bajo demanda */
  finished: boolean
}

interface Props {
  open: boolean
  /** libros de tu estantería, los que lees primero */
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

/**
 * Compositor de ideas.
 *
 * DISEÑO (reescrito): casi siempre escribes sobre el libro que tienes
 * entre manos, en el capítulo por el que vas. Antes había una fila de
 * fichas con TODOS los libros que habías tocado alguna vez, que se
 * apilaban hasta llenar la pantalla y obligaban a leerlas para encontrar
 * el de siempre.
 *
 * Ahora hay un solo destino visible, el que casi siempre quieres, con su
 * portada y su capítulo, y un botón «Cambiar» que abre la lista. Los
 * libros terminados no aparecen en la lista principal: viven detrás de un
 * desplegable, para que la cosa no crezca con los años.
 */
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
  /** -1 = entrada general, sin libro */
  const [targetIdx, setTargetIdx] = useState(-1)
  const [picker, setPicker] = useState(false)
  const [verTerminados, setVerTerminados] = useState(false)

  const sheetRef = useModalBehavior(open, onClose)

  useEffect(() => {
    if (!open) return
    // El borrador (`body`) se conserva entre aperturas (auditoría A-02).
    setKind('comment')
    setToClub(true)
    setPicker(false)
    setVerTerminados(false)
    // Por defecto, lo que estás leyendo ahora. Nunca un libro terminado.
    const leyendo = targets.findIndex((t) => !t.finished)
    setTargetIdx(leyendo)
  }, [open, targets])

  useEffect(() => {
    setBody('')
  }, [resetToken])

  if (!open) return null

  const target = targetIdx >= 0 ? (targets[targetIdx] ?? null) : null
  const isBook = target != null
  const leyendo = targets.filter((t) => !t.finished)
  const terminados = targets.filter((t) => t.finished)

  const publish = () =>
    onPublish(kind, body.trim(), isBook && !!target.clubId && toClub, target)

  const elegir = (idx: number) => {
    setTargetIdx(idx)
    setPicker(false)
  }

  return (
    <div className="sheet-scrim" ref={sheetRef} onClick={onClose}>
      <div
        className="sheet compose"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva publicación"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" />

        {picker ? (
          /* ---------- Elegir sobre qué escribes ---------- */
          <>
            <div className="sheet__head">
              <button
                type="button"
                className="compose__back label-large"
                onClick={() => setPicker(false)}
              >
                <span className="material-symbols-rounded" aria-hidden="true">
                  arrow_back
                </span>
                ¿Sobre qué escribes?
              </button>
            </div>

            {leyendo.length > 0 && (
              <>
                <p className="label-medium compose__grupo">Leyendo ahora</p>
                <div className="compose__opciones">
                  {leyendo.map((t) => {
                    const i = targets.indexOf(t)
                    return (
                      <button
                        key={t.bookId}
                        type="button"
                        className={`compose__opcion${targetIdx === i ? ' activa' : ''}`}
                        onClick={() => elegir(i)}
                      >
                        <BookCover
                          title={t.bookTitle}
                          author={t.bookAuthor}
                          coverUrl={t.coverUrl}
                          size="sm"
                        />
                        <span className="compose__opcion-txt">
                          <span className="title-small serif">{t.bookTitle}</span>
                          <span className="body-small on-surface-variant">
                            Capítulo {t.chapterNumber}
                            {t.chapterLabel ? ` · ${t.chapterLabel}` : ''}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <p className="label-medium compose__grupo">Sin libro</p>
            <button
              type="button"
              className={`compose__opcion${targetIdx === -1 ? ' activa' : ''}`}
              onClick={() => elegir(-1)}
            >
              <span className="compose__opcion-icon" aria-hidden="true">
                <span className="material-symbols-rounded">edit</span>
              </span>
              <span className="compose__opcion-txt">
                <span className="title-small">Una entrada general</span>
                <span className="body-small on-surface-variant">
                  Va a tu muro, sin anclar a ningún capítulo
                </span>
              </span>
            </button>

            {terminados.length > 0 && (
              <>
                {verTerminados ? (
                  <>
                    <p className="label-medium compose__grupo">Ya leídos</p>
                    <div className="compose__opciones">
                      {terminados.map((t) => {
                        const i = targets.indexOf(t)
                        return (
                          <button
                            key={t.bookId}
                            type="button"
                            className={`compose__opcion${targetIdx === i ? ' activa' : ''}`}
                            onClick={() => elegir(i)}
                          >
                            <BookCover
                              title={t.bookTitle}
                              author={t.bookAuthor}
                              coverUrl={t.coverUrl}
                              size="sm"
                            />
                            <span className="compose__opcion-txt">
                              <span className="title-small serif">{t.bookTitle}</span>
                              <span className="body-small on-surface-variant">
                                Terminado
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="compose__mas label-large"
                    onClick={() => setVerTerminados(true)}
                  >
                    {terminados.length === 1
                      ? 'Ver el libro que ya has leído'
                      : `Ver los ${terminados.length} que ya has leído`}
                  </button>
                )}
              </>
            )}

            {onGoToBook && (
              <div className="sheet__actions">
                <md-text-button onClick={onGoToBook}>
                  {targets.length === 0 ? 'Añadir un libro' : 'Mi biblioteca'}
                </md-text-button>
              </div>
            )}
          </>
        ) : (
          /* ---------- Escribir ---------- */
          <>
            <div className="sheet__head">
              <h2 className="title-large serif">Comparte algo</h2>
            </div>

            {/* Un único destino, visible y con contexto */}
            <button
              type="button"
              className="compose__destino"
              onClick={() => setPicker(true)}
              aria-label="Cambiar sobre qué escribes"
            >
              {isBook ? (
                <>
                  <BookCover
                    title={target.bookTitle}
                    author={target.bookAuthor}
                    coverUrl={target.coverUrl}
                    size="sm"
                  />
                  <span className="compose__destino-txt">
                    <span className="label-medium compose__kicker">
                      {target.finished ? 'Sobre un libro que terminaste' : 'Sobre tu lectura'}
                    </span>
                    <span className="title-small serif">{target.bookTitle}</span>
                    <span className="body-small on-surface-variant">
                      Capítulo {target.chapterNumber}
                      {target.chapterLabel ? ` · ${target.chapterLabel}` : ''}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="compose__opcion-icon" aria-hidden="true">
                    <span className="material-symbols-rounded">edit</span>
                  </span>
                  <span className="compose__destino-txt">
                    <span className="label-medium compose__kicker">Entrada general</span>
                    <span className="title-small">Sin libro</span>
                    <span className="body-small on-surface-variant">
                      {targets.length > 0
                        ? 'Toca para anclarla a lo que estás leyendo'
                        : 'Añade un libro para poder anclar tus ideas'}
                    </span>
                  </span>
                </>
              )}
              <span className="label-large compose__cambiar">Cambiar</span>
            </button>

            <MentionTextarea
              className="sheet__input body-large"
              ariaLabel={isBook ? 'Tu idea sobre este libro' : 'Entrada para tu muro'}
              placeholder={
                isBook
                  ? '¿Qué te ha hecho pensar este capítulo? Escribe @ para mencionar'
                  : 'Escribe una entrada para tu muro…'
              }
              rows={4}
              autoFocus
              value={body}
              onChange={setBody}
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

            {error && <p className="sheet__error body-medium">{error}</p>}

            <div className="sheet__actions">
              <span style={{ flex: 1 }} />
              <md-text-button onClick={onClose}>Cancelar</md-text-button>
              <md-filled-button
                disabled={!body.trim() || submitting || undefined}
                onClick={publish}
              >
                {submitting ? 'Publicando…' : 'Publicar'}
              </md-filled-button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
