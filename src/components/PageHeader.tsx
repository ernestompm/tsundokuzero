import type { ReactNode } from 'react'

/** Cabecera de página estándar: mismo ritmo tipográfico en toda la app. */
export default function PageHeader({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        margin: '4px 0 18px',
      }}
    >
      <div>
        <h1 className="headline-medium serif">{title}</h1>
        {sub && (
          <p className="body-medium on-surface-variant" style={{ marginTop: 2 }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </header>
  )
}
