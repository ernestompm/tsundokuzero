import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import { Avatar, Card } from '../../components/ui'
import Reactions from '../../components/Reactions'
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
  /** id del usuario conectado: habilita editar/eliminar lo propio */
  currentUserId?: string
  /** si el libro pertenece a un club, se puede etiquetar como «del club» */
  clubAvailable?: boolean
  onPublish?: (kind: DiscussionKind, body: string, toClub: boolean) => void
  onReply?: (discussionId: string, body: string) => void
  onEditDiscussion?: (id: string, body: string) => void
  onDeleteDiscussion?: (id: string) => void
  onDeleteComment?: (id: string) => void
  onReact?: (discussionId: string, emoji: string | null) => void
}

const KINDS: DiscussionKind[] = ['comment', 'theory', 'question']

export default function ChapterView({
  data,
  busy,
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

  const publish = () => {
    const text = body.trim()
    if (!text || !onPublish) return
    onPublish(kind, text, clubAvailable && toClub)
    setBody('')
    setKind('comment')
  }

  return (
    <section className="chapter">
      <div className="chapter__bar">
        <md-icon-button
          aria-label="Volver al libro"
          onClick={() => navigate(`/book/${data.bookId}`)}
        >
          <span className="material-symbols-rounded">arrow_back</span>
        </md-icon-button>
        <div>
          <div className="title-medium">
            Capítulo {data.chapterNumber}
            {data.chapterLabel ? ` · ${data.chapterLabel}` : ''}
          </div>
          <div className="body-small on-surface-variant">{data.bookTitle}</div>
        </div>
      </div>

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
          <span className="material-symbols-rounded">lock</span>
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
                <span className="material-symbols-rounded">
                  {toClub ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                Club
              </button>
            )}
          </div>
          <md-filled-button
            className="composer__send"
            disabled={!body.trim() || busy || undefined}
            onClick={publish}
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
  onReply?: (discussionId: string, body: string) => void
  onEdit?: (id: string, body: string) => void
  onDelete?: (id: string) => void
  onDeleteComment?: (id: string) => void
  onReact?: (discussionId: string, emoji: string | null) => void
}) {
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.body)

  const send = () => {
    const text = reply.trim()
    if (!text || !onReply) return
    onReply(d.id, text)
    setReply('')
    setReplying(false)
  }

  const saveEdit = () => {
    const text = draft.trim()
    if (!text || !onEdit) return
    onEdit(d.id, text)
    setEditing(false)
  }

  const remove = () => {
    if (!onDelete) return
    if (window.confirm('¿Eliminar esta publicación y sus respuestas?'))
      onDelete(d.id)
  }

  return (
    <Card tone="default" className="disc">
      <div className="disc__head">
        {d.authorUsername ? (
          <Link to={`/u/${d.authorUsername}`} className="disc__author">
            <Avatar name={d.authorName} size={38} />
            <span>
              <span className="who title-small">{d.authorName}</span>
              <span className="meta body-small on-surface-variant" style={{ display: 'block' }}>
                {d.createdAt}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <Avatar name={d.authorName} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who title-small">{d.authorName}</div>
              <div className="meta body-small on-surface-variant">{d.createdAt}</div>
            </div>
          </>
        )}
        <span style={{ flex: 1 }} />
        {mine && !editing && (
          <span className="disc__tools">
            <md-icon-button
              aria-label="Editar"
              onClick={() => {
                setDraft(d.body)
                setEditing(true)
              }}
            >
              <span className="material-symbols-rounded">edit</span>
            </md-icon-button>
            <md-icon-button aria-label="Eliminar" onClick={remove}>
              <span className="material-symbols-rounded">delete</span>
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="disc__edit-actions">
            <md-text-button onClick={() => setEditing(false)}>
              Cancelar
            </md-text-button>
            <md-filled-button disabled={!draft.trim() || undefined} onClick={saveEdit}>
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
              <Avatar name={c.authorName} size={26} />
              {c.body == null ? (
                <p className="body-small disc__comment-locked" style={{ flex: 1 }}>
                  <span className="material-symbols-rounded">lock</span>
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
              {currentUserId === c.authorId && onDeleteComment && (
                <button
                  className="disc__comment-del"
                  aria-label="Eliminar respuesta"
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta respuesta?'))
                      onDeleteComment(c.id)
                  }}
                >
                  <span className="material-symbols-rounded">delete</span>
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
              value={reply}
              autoFocus
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <md-icon-button aria-label="Enviar" onClick={send}>
              <span className="material-symbols-rounded">send</span>
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
