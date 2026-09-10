import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Envuelve una cara o un nombre para que lleve al perfil público de esa
 * persona. Si no sabemos su usuario, no enlaza y no pasa nada: se pinta
 * igual, sin enlace roto.
 *
 * Corta la propagación del clic porque muchas tarjetas del feed son a su
 * vez clicables, y tocar la cara debe llevar a la persona, no al hilo.
 */
export default function PersonLink({
  username,
  className,
  children,
}: {
  username?: string | null
  className?: string
  children: ReactNode
}) {
  if (!username) return <>{children}</>
  return (
    <Link
      to={`/u/${username}`}
      className={`personlink${className ? ` ${className}` : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  )
}
