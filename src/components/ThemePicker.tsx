import { useState } from 'react'
import { getThemeMode, setThemeMode, type ThemeMode } from '../theme/theme'
import './themepicker.css'

const OPCIONES: { id: ThemeMode; icon: string; label: string; corto: string }[] = [
  { id: 'light', icon: 'light_mode', label: 'Tema claro', corto: 'Claro' },
  { id: 'dark', icon: 'dark_mode', label: 'Tema oscuro', corto: 'Oscuro' },
  { id: 'system', icon: 'settings', label: 'Seguir al sistema', corto: 'Sistema' },
]

/**
 * Elegir tema: claro, oscuro o el del sistema.
 *
 * Antes era un interruptor de dos posiciones, y eso obligaba a mentir:
 * no había forma de decir «el que tenga mi móvil» sin que el botón se
 * quedase enseñando lo contrario de lo que pasaba. Tres opciones visibles
 * a la vez, y la que está puesta se ve puesta.
 *
 * Por defecto se entra en claro (ver `theme.ts`): el papel es la marca.
 * «Sistema» está aquí para quien lo quiera, no como comportamiento
 * heredado de nadie.
 */
export default function ThemePicker({
  onChange,
  compacto = false,
}: {
  /** avisa al contenedor para que refresque lo que dependa del tema */
  onChange?: () => void
  /** en el cajón móvil cabe menos: solo los iconos y la etiqueta corta */
  compacto?: boolean
}) {
  // El modo elegido vive aquí además de en `theme.ts`: aplicar el tema
  // toca el DOM directamente y no volvería a pintar este componente, así
  // que la marca de «esta es la puesta» se quedaría donde estaba.
  const [actual, setActual] = useState<ThemeMode>(getThemeMode)

  const elegir = (modo: ThemeMode) => {
    setActual(modo)
    setThemeMode(modo)
    onChange?.()
  }

  return (
    <div
      className={`themepick${compacto ? ' themepick--compacto' : ''}`}
      role="radiogroup"
      aria-label="Tema de la aplicación"
    >
      {OPCIONES.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={actual === o.id}
          aria-label={o.label}
          title={o.label}
          className={`themepick__op label-small${actual === o.id ? ' activa' : ''}`}
          onClick={() => elegir(o.id)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {o.icon}
          </span>
          <span className="themepick__txt">{o.corto}</span>
        </button>
      ))}
    </div>
  )
}
