import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import { Avatar, Card } from '../../components/ui'
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
  onPublish?: (kind: DiscussionKind, body: string, toClub: boolean) => void
  onReply?: (discussionId: string, body: string) => void
}

const KINDS: DiscussionKind[] = ['comment', 'theory', 'question']

export default function ChapterView({ data, busy, onPublish, onReply }: Props) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<DiscussionKind>('comment')
  const [body, setBody] = useState('')
  const [toClub, setToClub] = useState(true)

  const publish = () => {
    const text = body.trim()
    if (!text || !onPublish) return
    onPublish(kind, text, toClub)
    setBody('')
    setKind('comment')
  }

  return (
    <section className="chapter">
      <div className="chapter__bar">
        <md-icon-button aria-label="Volver al libro" onClick={() => navigate('/book')}>
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
            <DiscussionCard key={d.id} d={d} onReply={onReply} />
          ))}
        </div>
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
  onReply,
}: {
  d: ThreadDiscussion
  onReply?: (discussionId: string, body: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')

  const send = () => {
    const text = reply.trim()
    if (!text || !onReply) return
    onReply(d.id, text)
    setReply('')
    setReplying(false)
  }

  return (
    <Card tone="default" className="disc">
      <div className="disc__head">
        <Avatar name={d.authorName} size={38} />
        <div>
          <div className="who title-small">{d.authorName}</div>
          <div className="meta body-small on-surface-variant">{d.createdAt}</div>
        </div>
      </div>
      <div className="disc__chips">
        <span className="chip chip--kind label-small">{KIND_LABEL[d.kind]}</span>
        {d.isClub && (
          <span className="chip chip--club label-small">Club · Tsundoku Zero</span>
        )}
      </div>
      <p className="disc__body body-medium">{d.body}</p>

      {d.comments.length > 0 && (
        <div className="disc__comments">
          {d.comments.map((c) => (
            <div key={c.id} className="disc__comment">
              <Avatar name={c.authorName} size={26} />
              <p className="body-small">
                <span className="who">{c.authorName}</span> · {c.body}
              </p>
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
