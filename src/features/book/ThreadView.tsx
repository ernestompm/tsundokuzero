import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import PersonLink from '../../components/PersonLink'
import MentionText from '../../components/MentionText'
import MentionTextarea from '../../components/MentionTextarea'
import { Avatar, Card } from '../../components/ui'
import Reactions from '../../components/Reactions'
import ReportButton from '../../components/ReportButton'
import LockedTeaser from '../../components/LockedTeaser'
import SwornReply from '../../components/SwornReply'
import { useConfirm } from '../../components/ConfirmProvider'
import { useSwear } from '../../components/SwearProvider'
import { KIND_LABEL, type ThreadViewData } from './chapterTypes'
import './thread.css'

interface Props {
  data: ThreadViewData
  busy?: boolean
  /** error de la última acción, para el banner inline (auditoría A-01) */
  actionError?: string | null
  currentUserId?: string
  /** puede devolver éxito/fallo (auditoría A-01); `void` vale (previews) */
  onReply?: (body: string, jurado: boolean) => Promise<boolean> | void
  onReact?: (emoji: string | null) => void
  onDeleteComment?: (id: string) => void
  onDeleteDiscussion?: () => void
  /** editar el pensamiento propio ya publicado */
  onEditDiscussion?: (body: string) => Promise<boolean> | void
  /** editar una respuesta propia ya publicada */
  onEditComment?: (id: string, body: string) => Promise<boolean> | void
}

export default function ThreadView({
  data,
  busy,
  actionError,
  currentUserId,
  onReply,
  onReact,
  onDeleteComment,
  onDeleteDiscussion,
  onEditDiscussion,
  onEditComment,
}: Props) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const jurar = useSwear()
  const [reply, setReply] = useState('')
  /** id de la respuesta que se está editando, o 'hilo' para el mensaje padre */
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')

  // auditoría A-01: el texto solo se limpia si la operación fue bien
  const send = async () => {
    const text = reply.trim()
    if (!text || !onReply) return
    // Siempre se pregunta al servidor: es él quien sabe si alguien se
    // quedaría esperando. Si no hay nadie, `jurar` resuelve solo.
    const juramento = await jurar({
      discussionId: data.discussionId,
      chapterNumber: data.chapterNumber,
    })
    if (juramento === 'cancelado') return
    const ok = await onReply(text, juramento === 'jurado')
    if (ok !== false) setReply('')
  }

  const abrirEdicion = (id: string, texto: string) => {
    setEditando(id)
    setBorrador(texto)
  }

  const guardar = async (id: string) => {
    const texto = borrador.trim()
    if (!texto) return
    const ok =
      id === 'hilo'
        ? await onEditDiscussion?.(texto)
        : await onEditComment?.(id, texto)
    if (ok !== false) setEditando(null)
  }

  /** Caja de edición compartida por el hilo y sus respuestas. */
  const cajaEdicion = (id: string) => (
    <div className="thread-editar">
      <MentionTextarea
        className="tz-input thread-editar__input body-medium"
        ariaLabel="Edita tu texto"
        value={borrador}
        rows={3}
        maxLength={1500}
        autoFocus
        onChange={setBorrador}
      />
      <div className="thread-editar__acciones">
        <md-text-button onClick={() => setEditando(null)}>Cancelar</md-text-button>
        <md-filled-button
          disabled={!borrador.trim() || busy || undefined}
          onClick={() => void guardar(id)}
        >
          Guardar cambios
        </md-filled-button>
      </div>
    </div>
  )

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
          <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        </md-icon-button>
        <div>
          <div className="title-medium">Hilo</div>
          <div className="body-small on-surface-variant">
            {data.bookTitle} · {chapterPart}
          </div>
        </div>
      </div>

      {/* auditoría A-01: aviso inline si una acción falló (el texto no se pierde) */}
      {actionError && (
        <p className="chapter__error body-medium" role="alert">
          {actionError}
        </p>
      )}

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
          {data.body != null && (
            <ReportButton
              targetType="discussion"
              targetId={data.discussionId}
              reportedUserId={data.authorId}
              excerpt={data.body}
            />
          )}
          {mine && data.body != null && onEditDiscussion && (
            <md-icon-button
              aria-label="Editar"
              onClick={() => abrirEdicion('hilo', data.body ?? '')}
            >
              <span className="material-symbols-rounded" aria-hidden="true">edit</span>
            </md-icon-button>
          )}
          {mine && onDeleteDiscussion && (
            <md-icon-button
              aria-label="Eliminar"
              onClick={() =>
                // auditoría M-04: diálogo propio en lugar de window.confirm
                void (async () => {
                  const ok = await confirm({
                    title: '¿Eliminar este hilo?',
                    message: 'Se eliminarán también todas sus respuestas.',
                    confirmLabel: 'Eliminar',
                    danger: true,
                  })
                  if (ok) onDeleteDiscussion()
                })()
              }
            >
              <span className="material-symbols-rounded" aria-hidden="true">delete</span>
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
          editando === 'hilo' ? (
            cajaEdicion('hilo')
          ) : (
            <p className="thread-parent__body body-large">
              <MentionText text={data.body} />
            </p>
          )
        )}

        {onReact && data.body != null && (
          <div className="thread-parent__reactions">
            <Reactions
              counts={data.reactions}
              mine={data.myReaction}
              onReact={onReact}
              discussionId={data.discussionId}
            />
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
            <PersonLink username={c.authorUsername}>
              <Avatar name={c.authorName} url={c.authorAvatar} size={34} />
            </PersonLink>
            <div className="thread-reply__content">
              {c.body == null && c.canReveal ? (
                <SwornReply
                  commentId={c.id}
                  authorId={c.authorId}
                  authorName={c.authorName}
                  authorChapter={c.unlockChapter ?? data.chapterNumber}
                />
              ) : c.body == null ? (
                <p className="body-medium disc__comment-locked">
                  <span className="material-symbols-rounded" aria-hidden="true">lock</span>
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
                    <ReportButton
                      targetType="comment"
                      targetId={c.id}
                      reportedUserId={c.authorId}
                      excerpt={c.body}
                    />
                    {currentUserId === c.authorId && onEditComment && (
                      <button
                        className="thread-reply__del"
                        aria-label="Editar respuesta"
                        onClick={() => abrirEdicion(c.id, c.body ?? '')}
                      >
                        <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                      </button>
                    )}
                    {currentUserId === c.authorId && onDeleteComment && (
                      <button
                        className="thread-reply__del"
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
                  {editando === c.id ? (
                    cajaEdicion(c.id)
                  ) : (
                    <p className="body-medium thread-reply__body">
                      <MentionText text={c.body} />
                    </p>
                  )}
                  {c.swornSafe && c.unlockChapter != null &&
                    c.unlockChapter > data.myChapter && (
                      <span className="body-small jurada-sello">
                        <span className="material-symbols-rounded" aria-hidden="true">
                          lock_open
                        </span>
                        Abierta bajo juramento
                      </span>
                    )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Composer de respuesta ===== */}
      {data.canWrite && onReply ? (
        <div className="thread-composer">
          <MentionTextarea
            className="thread-composer__input body-medium"
            placeholder="Escribe tu respuesta… @ para mencionar"
            ariaLabel="Tu respuesta al hilo"
            value={reply}
            rows={2}
            maxLength={1500}
            onChange={setReply}
            onKeyDown={(e) => {
              // Intro hace párrafo. Se envía con el botón o con Ctrl/⌘+Intro:
              // desde que se respetan los saltos de línea, robar el Intro
              // era quitarle a la gente la única tecla para separar ideas.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <md-filled-button
            disabled={!reply.trim() || busy || undefined}
            onClick={() => void send()}
          >
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
