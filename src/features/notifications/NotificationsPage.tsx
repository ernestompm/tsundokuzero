import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
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
    const { data: rows } = await supabase
      .from('notifications')
      .select('id, actor_id, type, discussion_id, poll_id, read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(40)

    const list = rows ?? []
    const actorIds = [...new Set(list.map((n) => n.actor_id).filter(Boolean))] as string[]
    const { data: actors } = actorIds.length
      ? await supabase
          .from('profiles')
          .select('id, display_name, username')
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
          actorUsername: actor?.username ?? null,
          to,
          detail,
        }
      }),
    )

    // Al abrir la bandeja, todo queda leído
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false)
    window.dispatchEvent(new Event('tz-notifications-read'))
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

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
      {items.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Nada nuevo por aquí. Cuando alguien te responda o te siga, lo verás
          en esta bandeja.
        </p>
      ) : (
        <div className="noti-list">
          {items.map((n) => (
            <button
              key={n.id}
              className={`noti-row${n.read ? '' : ' unread'}`}
              onClick={() => navigate(n.to)}
            >
              <Avatar name={n.actorName} size={40} />
              <span className="noti-row__text">
                <span className="body-medium">
                  <b>{n.actorName}</b> {n.detail}
                </span>
                <span className="body-small on-surface-variant">
                  {n.createdAt}
                </span>
              </span>
              <span className="material-symbols-rounded noti-row__icon">
                {n.type === 'reply'
                  ? 'chat_bubble'
                  : n.type === 'follow'
                    ? 'group'
                    : 'how_to_vote'}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
