import type { FormEvent, KeyboardEvent } from 'react'
import './searchfield.css'

/**
 * El campo de búsqueda de la app. Uno solo.
 *
 * Había dos: el de la barra superior (píldora rellena, con lupa dentro) y
 * el de Explorar (píldora hueca, sin lupa). En la misma pantalla, dos
 * cosas que hacen exactamente lo mismo con dos formas distintas — y la de
 * Explorar ni siquiera parecía un buscador, porque un campo sin lupa es
 * un campo de texto.
 *
 * Ahora la anatomía es una: lupa · campo · botón de limpiar cuando hay
 * algo escrito. Lo que cambia entre sitios es el tamaño, no la forma.
 */
export default function SearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  ariaLabel,
  autoFocus,
  grande = false,
  onSubmit,
  onKeyDown,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  autoFocus?: boolean
  /** la variante de página, más alta que la de la barra superior */
  grande?: boolean
  onSubmit?: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  className?: string
}) {
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }

  return (
    <form
      className={`buscador${grande ? ' buscador--grande' : ''}${className ? ` ${className}` : ''}`}
      role="search"
      onSubmit={enviar}
    >
      <span className="material-symbols-rounded buscador__lupa" aria-hidden="true">
        search
      </span>
      <input
        className="buscador__campo body-medium"
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {value !== '' && (
        <button
          type="button"
          className="buscador__limpiar"
          aria-label="Borrar la búsqueda"
          onClick={() => onChange('')}
        >
          <span className="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      )}
    </form>
  )
}
