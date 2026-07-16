import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Avatar } from './ui'
import './reactions.css'

export const REACTION_EMOJIS = ['❤️', '🔥', '😮', '💡'] as const

/**
 * Barra de reacciones a una publicación. Muestra los cuatro emojis;
 * resalta el que tú has puesto. Tocar el tuyo lo quita, tocar otro lo
 * cambia. `counts` es emoji → nº de reacciones.
 *
 * Con `discussionId` y al menos una reacción aparece un «+» que abre
 * la hoja de QUIÉN ha reaccionado con qué.
 */
export default function Reactions({
  counts,
  mine,
  onReact,
  discussionId,
}: {
  counts: Record<string, number>
  mine: string | null
  onReact: (emoji: string | null) => void
  discussionId?: string
}) {
  const [whoOpen, setWhoOpen] = useState(false)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="reactions">
      {REACTION_EMOJIS.map((e) => {
        const count = counts[e] ?? 0
        const isMine = mine === e
        return (
          <button
            key={e}
            type="button"
            className={`reaction${isMine ? ' mine' : ''}${count > 0 ? ' has' : ''}`}
            aria-pressed={isMine}
            aria-label={`Reaccionar ${e}${count ? ` (${count})` : ''}`}
            onClick={() => onReact(isMine ? null : e)}
          >
            <span className="reaction__emoji">{e}</span>
            {count > 0 && <span className="reaction__count">{count}</span>}
          </button>
        )
      })}
      {discussionId && total > 0 && (
        <button
          type="button"
          className="reaction reactions__who"
          aria-label="Ver quién ha reaccionado"
          onClick={() => setWhoOpen(true)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            add
          </span>
        </button>
      )}
      {whoOpen && discussionId && (
        <ReactionsSheet
          discussionId={discussionId}
          onClose={() => setWhoOpen(false)}
        />
      )}
    </div>
  )
}

/* ===================== Quién ha reaccionado ===================== */

interface WhoRow {
  userId: string
  name: string
  username: string | null
  avatar: string | null
  emoji: string
}

function ReactionsSheet({
  discussionId,
  onClose,
}: {
  discussionId: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<WhoRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: reactions } = await supabase
        .from('reactions')
        .select('user_id, emoji, created_at')
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: false })
      const list = reactions ?? []
      const userIds = [...new Set(list.map((r) => r.user_id))]
      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds)
        : { data: [] }
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
      if (!cancelled) {
        setRows(
          list.map((r) => {
            const p = byId.get(r.user_id)
            return {
              userId: r.user_id,
              name: p?.display_name ?? 'Alguien',
              username: p?.username ?? null,
              avatar: p?.avatar_url ?? null,
              emoji: r.emoji,
            }
          }),
        )
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [discussionId])

  return (
    <div
      className="reactions-sheet-scrim"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="reactions-sheet"
        role="dialog"
        aria-label="Quién ha reaccionado"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reactions-sheet__handle" aria-hidden />
        <h2 className="title-medium serif">Reacciones</h2>
        {rows === null ? (
          <p className="body-medium on-surface-variant">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="body-medium on-surface-variant">
            Nadie ha reaccionado todavía.
          </p>
        ) : (
          <div className="reactions-sheet__list">
            {rows.map((r, i) => (
              <div key={`${r.userId}-${i}`} className="reactions-sheet__row">
                <Avatar name={r.name} url={r.avatar} size={36} />
                <span className="reactions-sheet__names">
                  <span className="title-small">{r.name}</span>
                  {r.username && (
                    <span className="body-small on-surface-variant">
                      @{r.username}
                    </span>
                  )}
                </span>
                <span className="reactions-sheet__emoji">{r.emoji}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
