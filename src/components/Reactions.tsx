import './reactions.css'

export const REACTION_EMOJIS = ['❤️', '🔥', '😮', '💡'] as const

/**
 * Barra de reacciones a una publicación. Muestra los cuatro emojis;
 * resalta el que tú has puesto. Tocar el tuyo lo quita, tocar otro lo
 * cambia. `counts` es emoji → nº de reacciones.
 */
export default function Reactions({
  counts,
  mine,
  onReact,
}: {
  counts: Record<string, number>
  mine: string | null
  onReact: (emoji: string | null) => void
}) {
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
    </div>
  )
}
