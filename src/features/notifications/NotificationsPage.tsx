import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import '@material/web/button/text-button.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { fetchBlockedIds } from '../../lib/blocks'
import { Avatar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { timeAgo } from '../../lib/time'
import type { NotificationType } from '../../lib/database.types'
import './notifications.css'

interface NotiRow {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actorName: string
  actorAvatar: string | null
  actorUsername: string | null
  /** destino al tocar */
  to: string
  detail: string
}

export default function NotificationsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotiRow[] | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const [{ data: rows }, blocked] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, actor_id, type, discussion_id, poll_id, book_id, note, read, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(40),
      fetchBlockedIds(session.user.id),
    ])

    // Bloqueos (P2-13): sin avisos provocados por gente bloqueada
    const list = (rows ?? []).filter(
      (n) => !n.actor_id || !blocked.has(n.actor_id),
    )
    const actorIds = [...new Set(list.map((n) => n.actor_id).filter(Boolean))] as string[]
    const { data: actors } = actorIds.length
      ? await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', actorIds)
      : { data: [] }
    const actorById = new Map((actors ?? []).map((a) => [a.id, a]))

    setItems(
      list.map((n) => {
        const actor = n.actor_id ? actorById.get(n.actor_id) : undefined
        let to = '/'
        let detail = ''
        if (n.type === 'reply') {
          to = n.discussion_id ? `/thread/${n.discussion_id}` : '/'
          detail = 'respondió a tu idea'
        } else if (n.type === 'unlock') {
          to = n.discussion_id ? `/thread/${n.discussion_id}` : '/'
          detail = 'Se ha desbloqueado una respuesta a tu mensaje'
        } else if (n.type === 'book_done') {
          to = n.book_id ? `/book/${n.book_id}` : '/club'
          detail = '¡El club ha terminado el libro! Deja tu reseña'
        } else if (n.type === 'moderation') {
          // DSA art. 17: motivación de la decisión de moderación
          to = '/legal/terminos'
          detail = n.note
            ? `Moderación: ${n.note}`
            : 'Un moderador ha retirado uno de tus contenidos.'
        } else if (n.type === 'follow') {
          to = actor?.username ? `/u/${actor.username}` : '/'
          detail = 'empezó a seguirte'
        } else {
          to = '/club'
          detail = 'abrió una votación en el club'
        }
        return {
          id: n.id,
          type: n.type,
          read: n.read,
          createdAt: timeAgo(n.created_at),
          actorName: actor?.display_name ?? 'Alguien',
          actorAvatar: actor?.avatar_url ?? null,
          actorUsername: actor?.username ?? null,
          to,
          detail,
        }
      }),
    )

    // auditoría M-06: abrir la bandeja ya NO marca nada como leído;
    // cada aviso se marca al tocarlo, o todos con el botón de la cabecera.
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  /** auditoría M-06: marca un aviso como leído al tocarlo y navega. */
  const openNoti = async (n: NotiRow) => {
    if (!n.read) {
      setItems((list) =>
        (list ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      )
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      window.dispatchEvent(new Event('tz-notifications-read'))
    }
    navigate(n.to)
  }

  /** auditoría M-06: botón «Marcar todo como leído». */
  const markAllRead = async () => {
    if (!session) return
    setItems((list) => (list ?? []).map((n) => ({ ...n, read: true })))
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false)
    window.dispatchEvent(new Event('tz-notifications-read'))
  }

  if (!items) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return (
    <section>
      <PageHeader title="Notificaciones" sub="Respuestas, seguidores y votaciones" />
      {/* auditoría M-06: marcar todo como leído, a demanda */}
      {items.some((n) => !n.read) && (
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}
        >
          <md-text-button onClick={() => void markAllRead()}>
            <span
              slot="icon"
              className="material-symbols-rounded"
              aria-hidden="true"
            >
              check_circle
            </span>
            Marcar todo como leído
          </md-text-button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Nada nuevo por aquí. Cuando alguien te responda o te siga, lo verás
          en esta bandeja.
        </p>
      ) : (
        <div className="noti-list">
          {items.map((n) => {
            const systemMsg =
              n.type === 'unlock' ||
              n.type === 'book_done' ||
              n.type === 'moderation'
            const icon =
              n.type === 'reply'
                ? 'chat_bubble'
                : n.type === 'follow'
                  ? 'group'
                  : n.type === 'unlock'
                    ? 'lock_open'
                    : n.type === 'book_done'
                      ? 'menu_book'
                      : n.type === 'moderation'
                        ? 'flag'
                        : 'how_to_vote'
            return (
              <button
                key={n.id}
                className={`noti-row${n.read ? '' : ' unread'}`}
                onClick={() => void openNoti(n)} /* auditoría M-06 */
              >
                {systemMsg ? (
                  <span
                    className="noti-row__sysicon material-symbols-rounded"
                    aria-hidden="true" /* auditoría A-06 */
                  >
                    {icon}
                  </span>
                ) : (
                  <Avatar name={n.actorName} url={n.actorAvatar} size={40} />
                )}
                <span className="noti-row__text">
                  <span className="body-medium">
                    {systemMsg ? (
                      n.detail
                    ) : (
                      <>
                        <b>{n.actorName}</b> {n.detail}
                      </>
                    )}
                  </span>
                  <span className="body-small on-surface-variant">
                    {n.createdAt}
                  </span>
                </span>
                {!systemMsg && (
                  <span
                    className="material-symbols-rounded noti-row__icon"
                    aria-hidden="true" /* auditoría A-06 */
                  >
                    {icon}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
