import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import { Avatar, Card } from '../../components/ui'
import Reactions from '../../components/Reactions'
import ReportButton from '../../components/ReportButton'
import { useConfirm } from '../../components/ConfirmProvider'
import type { DiscussionKind } from '../../lib/database.types'
import {
  KIND_LABEL,
  type ChapterViewData,
  type ThreadDiscussion,
} from './chapterTypes'
import './chapter.css'

interface Props {
  data: ChapterViewData
  busy?: boolean
  /** error de la última acción, para el banner inline (auditoría A-01) */
  actionError?: string | null
  /** id del usuario conectado: habilita editar/eliminar lo propio */
  currentUserId?: string
  /** si el libro pertenece a un club, se puede etiquetar como «del club» */
  clubAvailable?: boolean
  /* Los callbacks pueden devolver éxito/fallo (auditoría A-01): el texto
     del usuario solo se limpia si la operación fue bien. `void` sigue
     valiendo para los stubs de las previews. */
  onPublish?: (
    kind: DiscussionKind,
    body: string,
    toClub: boolean,
  ) => Promise<boolean> | void
  onReply?: (discussionId: string, body: string) => Promise<boolean> | void
  onEditDiscussion?: (id: string, body: string) => Promise<boolean> | void
  onDeleteDiscussion?: (id: string) => void
  onDeleteComment?: (id: string) => void
  onReact?: (discussionId: string, emoji: string | null) => void
}

const KINDS: DiscussionKind[] = ['comment', 'theory', 'question']

export default function ChapterView({
  data,
  busy,
  actionError,
  currentUserId,
  clubAvailable = true,
  onPublish,
  onReply,
  onEditDiscussion,
  onDeleteDiscussion,
  onDeleteComment,
  onReact,
}: Props) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<DiscussionKind>('comment')
  const [body, setBody] = useState('')
  const [toClub, setToClub] = useState(true)

  const publish = async () => {
    const text = body.trim()
    if (!text || !onPublish) return
    // auditoría A-01: solo se limpia el texto si la operación fue bien
    const ok = await onPublish(kind, text, clubAvailable && toClub)
    if (ok !== false) {
      setBody('')
      setKind('comment')
    }
  }

  return (
    <section className="chapter">
      <div className="chapter__bar">
        <md-icon-button
          aria-label="Volver al libro"
          onClick={() => navigate(`/book/${data.bookId}`)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        </md-icon-button>
        <div>
          <div className="title-medium">
            Capítulo {data.chapterNumber}
            {data.chapterLabel ? ` · ${data.chapterLabel}` : ''}
          </div>
          <div className="body-small on-surface-variant">{data.bookTitle}</div>
        </div>
      </div>

      {/* auditoría A-01: aviso inline si una acción falló (el texto no se pierde) */}
      {actionError && (
        <p className="chapter__error body-medium" role="alert">
          {actionError}
        </p>
      )}

      {data.discussions.length === 0 ? (
        <Card tone="outlined" className="chapter__empty">
          <p className="body-medium on-surface-variant">
            Todavía nadie ha abierto conversación en este capítulo. Estrena la
            sala con lo que estás pensando.
          </p>
        </Card>
      ) : (
        <div className="thread">
          {data.discussions.map((d) => (
            <DiscussionCard
              key={d.id}
              d={d}
              mine={currentUserId != null && d.authorId === currentUserId}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEditDiscussion}
              onDelete={onDeleteDiscussion}
              onDeleteComment={onDeleteComment}
              onReact={onReact}
            />
          ))}
        </div>
      )}

      {!data.canWrite && (
        <Card tone="outlined" className="chapter__gate-note">
          <span className="material-symbols-rounded" aria-hidden="true">lock</span>
          <div>
            <p className="body-medium">
              Este capítulo está por delante de tu progreso
              {data.myChapter != null && data.myChapter > 0
                ? ` (vas por el ${data.myChapter})`
                : ''}
              . Actualiza tu punto de lectura para leer y participar.
            </p>
            <md-text-button onClick={() => navigate(`/book/${data.bookId}`)}>
              Ir al libro
            </md-text-button>
          </div>
        </Card>
      )}

      {data.canWrite && onPublish && (
        <Card className="composer" tone="default">
          <div className="composer__anchor label-medium">
            Escribes anclado al capítulo {data.chapterNumber}
          </div>
          <textarea
            className="composer__input body-medium"
            placeholder="Comparte lo que estás pensando…"
            aria-label={`Tu publicación para el capítulo ${data.chapterNumber}`}
            value={body}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="composer__row">
            <div className="composer__kinds">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`kind-chip label-small${kind === k ? ' active' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {clubAvailable && (
              <button
                type="button"
                className={`club-toggle label-small${toClub ? ' active' : ''}`}
                onClick={() => setToClub((v) => !v)}
              >
                <span className="material-symbols-rounded" aria-hidden="true">
                  {toClub ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                Club
              </button>
            )}
          </div>
          <md-filled-button
            className="composer__send"
            disabled={!body.trim() || busy || undefined}
            onClick={() => void publish()}
          >
            Publicar
          </md-filled-button>
        </Card>
      )}
    </section>
  )
}

function DiscussionCard({
  d,
  mine,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onDeleteComment,
  onReact,
}: {
  d: ThreadDiscussion
  mine: boolean
  currentUserId?: string
  onReply?: (discussionId: string, body: string) => Promise<boolean> | void
  onEdit?: (id: string, body: string) => Promise<boolean> | void
  onDelete?: (id: string) => void
  onDeleteComment?: (id: string) => void
  onReact?: (discussionId: string, emoji: string | null) => void
}) {
  const confirm = useConfirm()
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.body)

  // auditoría A-01: el texto solo se limpia si la operación fue bien
  const send = async () => {
    const text = reply.trim()
    if (!text || !onReply) return
    const ok = await onReply(d.id, text)
    if (ok !== false) {
      setReply('')
      setReplying(false)
    }
  }

  const saveEdit = async () => {
    const text = draft.trim()
    if (!text || !onEdit) return
    const ok = await onEdit(d.id, text)
    if (ok !== false) setEditing(false)
  }

  // auditoría M-04: diálogo propio en lugar de window.confirm
  const remove = async () => {
    if (!onDelete) return
    const ok = await confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Se eliminarán también todas sus respuestas.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (ok) onDelete(d.id)
  }

  return (
    <Card tone="default" className="disc">
      <div className="disc__head">
        {d.authorUsername ? (
          <Link to={`/u/${d.authorUsername}`} className="disc__author">
            <Avatar name={d.authorName} url={d.authorAvatar} size={38} />
            <span>
              <span className="who title-small">{d.authorName}</span>
              <span className="meta body-small on-surface-variant" style={{ display: 'block' }}>
                {d.createdAt}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <Avatar name={d.authorName} url={d.authorAvatar} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who title-small">{d.authorName}</div>
              <div className="meta body-small on-surface-variant">{d.createdAt}</div>
            </div>
          </>
        )}
        <span style={{ flex: 1 }} />
        <ReportButton
          targetType="discussion"
          targetId={d.id}
          reportedUserId={d.authorId}
          excerpt={d.body}
        />
        {mine && !editing && (
          <span className="disc__tools">
            <md-icon-button
              aria-label="Editar"
              onClick={() => {
                setDraft(d.body)
                setEditing(true)
              }}
            >
              <span className="material-symbols-rounded" aria-hidden="true">edit</span>
            </md-icon-button>
            <md-icon-button aria-label="Eliminar" onClick={() => void remove()}>
              <span className="material-symbols-rounded" aria-hidden="true">delete</span>
            </md-icon-button>
          </span>
        )}
      </div>
      <div className="disc__chips">
        <span className="chip chip--kind label-small">{KIND_LABEL[d.kind]}</span>
        {d.isClub && (
          <span className="chip chip--club label-small">Club</span>
        )}
      </div>

      {editing ? (
        <div className="disc__edit">
          <textarea
            className="composer__input body-medium"
            rows={3}
            aria-label="Edita tu publicación"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="disc__edit-actions">
            <md-text-button onClick={() => setEditing(false)}>
              Cancelar
            </md-text-button>
            <md-filled-button
              disabled={!draft.trim() || undefined}
              onClick={() => void saveEdit()}
            >
              Guardar
            </md-filled-button>
          </div>
        </div>
      ) : (
        <p className="disc__body body-medium">{d.body}</p>
      )}

      {onReact && (
        <div className="disc__reactions">
          <Reactions
            counts={d.reactions}
            mine={d.myReaction}
            onReact={(emoji) => onReact(d.id, emoji)}
          />
        </div>
      )}

      {d.comments.length > 0 && (
        <div className="disc__comments">
          {d.comments.map((c) => (
            <div key={c.id} className="disc__comment">
              <Avatar name={c.authorName} url={c.authorAvatar} size={26} />
              {c.body == null ? (
                <p className="body-small disc__comment-locked" style={{ flex: 1 }}>
                  <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                  <span>
                    <span className="who">{c.authorName}</span> respondió más
                    adelante — desbloquearás este comentario cuando llegues al
                    capítulo {c.unlockChapter}
                  </span>
                </p>
              ) : (
                <p className="body-small" style={{ flex: 1 }}>
                  <span className="who">{c.authorName}</span> · {c.body}
                </p>
              )}
              {c.body != null && (
                <ReportButton
                  targetType="comment"
                  targetId={c.id}
                  reportedUserId={c.authorId}
                  excerpt={c.body}
                />
              )}
              {currentUserId === c.authorId && onDeleteComment && (
                <button
                  className="disc__comment-del"
                  aria-label="Eliminar respuesta"
                  onClick={() =>
                    // auditoría M-04: diálogo propio en lugar de window.confirm
                    void (async () => {
                      const ok = await confirm({
                        title: '¿Eliminar esta respuesta?',
                        confirmLabel: 'Eliminar',
                        danger: true,
                      })
                      if (ok) onDeleteComment(c.id)
                    })()
                  }
                >
                  <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onReply &&
        (replying ? (
          <div className="disc__reply">
            <input
              className="disc__reply-input body-medium"
              placeholder="Escribe tu respuesta…"
              aria-label="Tu respuesta a esta publicación"
              value={reply}
              autoFocus
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
            />
            <md-icon-button aria-label="Enviar" onClick={() => void send()}>
              <span className="material-symbols-rounded" aria-hidden="true">send</span>
            </md-icon-button>
          </div>
        ) : (
          <md-text-button onClick={() => setReplying(true)}>
            Responder
          </md-text-button>
        ))}
    </Card>
  )
}
