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
/**
 * Dónde cae una nota en la barra.
 *
 * La escala es de 1 a 5, no de 0 a 5: el mínimo que se puede poner es un
 * 1. Dividiendo entre 5 —que es lo que hacía antes— un 5 caía justo en el
 * borde derecho y la marca se salía media barra fuera, y un 1 pintaba un
 * 20 % de barra que parecía «casi sin datos». Con (v−1)/4 el 1 es el
 * principio de la barra, el 3 la mitad exacta y el 5 el final.
 */
function pct(v: number | null | undefined): number {
  if (v == null) return 0
  return Math.min(100, Math.max(0, ((v - 1) / 4) * 100))
}

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
                style={{ width: `${pct(c)}%` }}
              />
              {showMine && m != null && (
                <span className="rbars__mark" style={{ left: `${pct(m)}%` }} />
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
