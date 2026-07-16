import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import { Avatar, Card } from '../../components/ui'
import Reactions from '../../components/Reactions'
import LockedTeaser from '../../components/LockedTeaser'
import { KIND_LABEL, type ThreadViewData } from './chapterTypes'
import './thread.css'

interface Props {
  data: ThreadViewData
  busy?: boolean
  currentUserId?: string
  onReply?: (body: string) => void
  onReact?: (emoji: string | null) => void
  onDeleteComment?: (id: string) => void
  onDeleteDiscussion?: () => void
}

export default function ThreadView({
  data,
  busy,
  currentUserId,
  onReply,
  onReact,
  onDeleteComment,
  onDeleteDiscussion,
}: Props) {
  const navigate = useNavigate()
  const [reply, setReply] = useState('')

  const send = () => {
    const text = reply.trim()
    if (!text || !onReply) return
    onReply(text)
    setReply('')
  }

  const mine = currentUserId != null && data.authorId === currentUserId
  const chapterPart = data.chapterLabel
    ? `Cap. ${data.chapterNumber} · ${data.chapterLabel}`
    : `Cap. ${data.chapterNumber}`

  return (
    <section className="thread-page">
      <div className="chapter__bar">
        <md-icon-button
          aria-label="Volver"
          onClick={() => navigate(`/book/${data.bookId}/chapter/${data.chapterNumber}`)}
        >
          <span className="material-symbols-rounded">arrow_back</span>
        </md-icon-button>
        <div>
          <div className="title-medium">Hilo</div>
          <div className="body-small on-surface-variant">
            {data.bookTitle} · {chapterPart}
          </div>
        </div>
      </div>

      {/* ===== Mensaje principal ===== */}
      <Card tone="default" className="thread-parent">
        <div className="disc__head">
          {data.authorUsername ? (
            <Link to={`/u/${data.authorUsername}`} className="disc__author">
              <Avatar name={data.authorName} url={data.authorAvatar} size={44} />
              <span>
                <span className="who title-medium">{data.authorName}</span>
                <span className="meta body-small on-surface-variant" style={{ display: 'block' }}>
                  {data.createdAt} · {chapterPart}
                </span>
              </span>
            </Link>
          ) : (
            <>
              <Avatar name={data.authorName} url={data.authorAvatar} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="who title-medium">{data.authorName}</div>
                <div className="meta body-small on-surface-variant">
                  {data.createdAt} · {chapterPart}
                </div>
              </div>
            </>
          )}
          <span style={{ flex: 1 }} />
          {mine && onDeleteDiscussion && (
            <md-icon-button
              aria-label="Eliminar"
              onClick={() => {
                if (window.confirm('¿Eliminar este hilo y todas sus respuestas?'))
                  onDeleteDiscussion()
              }}
            >
              <span className="material-symbols-rounded">delete</span>
            </md-icon-button>
          )}
        </div>

        <div className="disc__chips">
          <span className="chip chip--kind label-small">{KIND_LABEL[data.kind]}</span>
          {data.isClub && <span className="chip chip--club label-small">Club</span>}
        </div>

        {data.body == null ? (
          <div style={{ marginTop: 12 }}>
            <LockedTeaser
              label={`Llega al capítulo ${data.chapterNumber} para leer este hilo`}
              lines={3}
            />
          </div>
        ) : (
          <p className="thread-parent__body body-large">{data.body}</p>
        )}

        {onReact && data.body != null && (
          <div className="thread-parent__reactions">
            <Reactions counts={data.reactions} mine={data.myReaction} onReact={onReact} />
          </div>
        )}
      </Card>

      {/* ===== Respuestas ===== */}
      <h2 className="title-small thread-replies__title">
        {data.comments.length > 0
          ? `${data.comments.length} ${data.comments.length === 1 ? 'respuesta' : 'respuestas'}`
          : 'Sin respuestas todavía'}
      </h2>

      <div className="thread-replies">
        {data.comments.map((c) => (
          <div key={c.id} className="thread-reply">
            <Avatar name={c.authorName} url={c.authorAvatar} size={34} />
            <div className="thread-reply__content">
              {c.body == null ? (
                <p className="body-medium disc__comment-locked">
                  <span className="material-symbols-rounded">lock</span>
                  <span>
                    <b>{c.authorName}</b> respondió más adelante —
                    desbloquearás su respuesta al llegar al capítulo{' '}
                    {c.unlockChapter}
                  </span>
                </p>
              ) : (
                <>
                  <div className="thread-reply__head">
                    <span className="title-small">{c.authorName}</span>
                    <span className="body-small on-surface-variant">
                      {c.createdAt}
                    </span>
                    {currentUserId === c.authorId && onDeleteComment && (
                      <button
                        className="thread-reply__del"
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
                  <p className="body-medium thread-reply__body">{c.body}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Composer de respuesta ===== */}
      {data.canWrite && onReply ? (
        <div className="thread-composer">
          <input
            className="thread-composer__input body-medium"
            placeholder="Escribe tu respuesta…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <md-filled-button disabled={!reply.trim() || busy || undefined} onClick={send}>
            Responder
          </md-filled-button>
        </div>
      ) : (
        !data.canWrite && (
          <p className="body-small on-surface-variant thread-locked-note">
            Llegarás a este capítulo para poder responder.
          </p>
        )
      )}
    </section>
  )
}
