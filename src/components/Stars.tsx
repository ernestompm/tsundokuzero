/** Estrellas de valoración: lectura (value) o interactivas (onRate). */
export default function Stars({
  value,
  onRate,
  size = 20,
}: {
  value: number
  onRate?: (n: number) => void
  size?: number
}) {
  return (
    <span
      style={{ display: 'inline-flex', gap: 2 }}
      role={onRate ? 'radiogroup' : 'img'}
      aria-label={`${value.toFixed(1)} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onRate ? (
          <button
            key={n}
            type="button"
            onClick={() => onRate(n)}
            aria-label={`${n} estrellas`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              className={`material-symbols-rounded${n <= Math.round(value) ? ' filled' : ''}`}
              style={{
                fontSize: size,
                color:
                  n <= Math.round(value)
                    ? 'var(--md-sys-color-tertiary)'
                    : 'var(--md-sys-color-outline)',
              }}
            >
              star
            </span>
          </button>
        ) : (
          <span
            key={n}
            className={`material-symbols-rounded${n <= Math.round(value) ? ' filled' : ''}`}
            style={{
              fontSize: size,
              color:
                n <= Math.round(value)
                  ? 'var(--md-sys-color-tertiary)'
                  : 'var(--md-sys-color-outline)',
            }}
          >
            star
          </span>
        ),
      )}
    </span>
  )
}
