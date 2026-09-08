import './ratingbars.css'

/**
 * Las cuatro dimensiones de una valoración (migr. 028). La estrella sigue
 * siendo la nota general; esto explica POR QUÉ gustó, que es de lo que se
 * habla en un club. Todas son opcionales.
 */
export const RATING_DIMENSIONS = [
  { key: 'd_think', label: 'Te hizo pensar', bajo: 'Nada', alto: 'Muchísimo' },
  { key: 'd_flow', label: 'Se lee solo', bajo: 'Cuesta', alto: 'Vuela' },
  { key: 'd_feel', label: 'Te removió', bajo: 'Frío', alto: 'Me dejó tocado' },
  { key: 'd_recommend', label: 'Lo recomendarías', bajo: 'No', alto: 'A todo el mundo' },
] as const

export type DimensionKey = (typeof RATING_DIMENSIONS)[number]['key']
export type Dimensions = Partial<Record<DimensionKey, number | null>>

/** Editor: cinco tramos por dimensión, todos opcionales. */
export function RatingBarsInput({
  value,
  onChange,
}: {
  value: Dimensions
  onChange: (next: Dimensions) => void
}) {
  return (
    <div className="rbars rbars--input">
      {RATING_DIMENSIONS.map((d) => {
        const v = value[d.key] ?? 0
        return (
          <div key={d.key} className="rbars__row">
            <span className="label-medium rbars__label">{d.label}</span>
            <div
              className="rbars__segments"
              role="radiogroup"
              aria-label={d.label}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={v === n}
                  aria-label={`${d.label}: ${n} de 5`}
                  className={`rbars__seg${n <= v ? ' filled' : ''}`}
                  onClick={() =>
                    onChange({ ...value, [d.key]: v === n ? null : n })
                  }
                />
              ))}
            </div>
            <span className="body-small rbars__hint on-surface-variant">
              {v === 0 ? 'Sin marcar' : v <= 2 ? d.bajo : v >= 4 ? d.alto : 'A medias'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Lectura: tu barra contra la media del club. La gracia no es tu nota,
 * es la distancia entre las dos.
 */
export function RatingBarsCompare({
  mine,
  club,
  showMine = true,
}: {
  mine?: Dimensions
  club: Partial<Record<DimensionKey, number | null>>
  showMine?: boolean
}) {
  const hayAlgo = RATING_DIMENSIONS.some((d) => club[d.key] != null)
  if (!hayAlgo) return null

  return (
    <div className="rbars rbars--compare">
      {RATING_DIMENSIONS.map((d) => {
        const c = club[d.key]
        const m = mine?.[d.key]
        if (c == null && m == null) return null
        return (
          <div key={d.key} className="rbars__crow">
            <div className="rbars__chead">
              <span className="label-medium">{d.label}</span>
              <span className="body-small on-surface-variant rbars__num">
                {c != null ? c.toFixed(1) : '—'}
                {showMine && m != null ? ` · tú ${m}` : ''}
              </span>
            </div>
            <div className="rbars__track" aria-hidden="true">
              <div
                className="rbars__fill rbars__fill--club"
                style={{ width: `${((c ?? 0) / 5) * 100}%` }}
              />
              {showMine && m != null && (
                <span
                  className="rbars__mark"
                  style={{ left: `${(m / 5) * 100}%` }}
                />
              )}
            </div>
            <span className="visually-hidden">
              {d.label}: media del club {c != null ? c.toFixed(1) : 'sin datos'} sobre 5
              {showMine && m != null ? `, tu nota ${m} sobre 5` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
