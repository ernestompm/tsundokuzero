import type { Badge } from '../lib/badges'
import './badges.css'

/** Fila de insignias. `max` recorta y añade un «+N». */
export function BadgeRow({ badges, max }: { badges: Badge[]; max?: number }) {
  if (badges.length === 0) return null
  const visibles = max ? badges.slice(0, max) : badges
  const resto = badges.length - visibles.length
  return (
    <span className="badgerow">
      {visibles.map((b) => (
        <span key={b.id} className={`badge badge--${b.tono}`} title={`${b.nombre}: ${b.detalle}`}>
          <span className="material-symbols-rounded" aria-hidden="true">
            {b.icon}
          </span>
          <span className="label-small">{b.nombre}</span>
        </span>
      ))}
      {resto > 0 && <span className="badge badge--resto label-small">+{resto}</span>}
      <span className="visually-hidden">
        Insignias: {badges.map((b) => `${b.nombre}, ${b.detalle}`).join('. ')}
      </span>
    </span>
  )
}

/** Solo los iconos, para ponerlos junto a un nombre sin ocupar sitio. */
export function BadgeDots({ badges, max = 3 }: { badges: Badge[]; max?: number }) {
  if (badges.length === 0) return null
  return (
    <span className="badgedots">
      {badges.slice(0, max).map((b) => (
        <span
          key={b.id}
          className={`badgedot badgedot--${b.tono}`}
          title={`${b.nombre}: ${b.detalle}`}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {b.icon}
          </span>
        </span>
      ))}
      <span className="visually-hidden">{badges.map((b) => b.nombre).join(', ')}</span>
    </span>
  )
}

/** Ficha completa, con lo que falta para la siguiente. */
export function BadgeBoard({
  badges,
  siguiente,
}: {
  badges: Badge[]
  siguiente?: { nombre: string; falta: string } | null
}) {
  return (
    <div className="badgeboard">
      {badges.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Todavía no tienes ninguna. Se ganan leyendo con el club, no usando la app.
        </p>
      ) : (
        <div className="badgeboard__lista">
          {badges.map((b) => (
            <div key={b.id} className={`badgecard badgecard--${b.tono}`}>
              <span className="badgecard__icon">
                <span className="material-symbols-rounded" aria-hidden="true">
                  {b.icon}
                </span>
              </span>
              <div className="badgecard__txt">
                <span className="title-small">{b.nombre}</span>
                <span className="body-small on-surface-variant">{b.detalle}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {siguiente && (
        <p className="body-small badgeboard__siguiente">
          <span className="material-symbols-rounded" aria-hidden="true">
            trending_up
          </span>
          <span>
            Siguiente: <b>{siguiente.nombre}</b>. {siguiente.falta}.
          </span>
        </p>
      )}
    </div>
  )
}
