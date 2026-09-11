import { useEffect, useRef, useState } from 'react'
import {
  insertarMencion,
  mencionEnCurso,
  mencionables,
  type Mencionable,
} from '../lib/mentions'
import { Avatar } from './ui'
import './mentions.css'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
  ariaLabel?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** tope de caracteres; el contador solo aparece cuando queda poco */
  maxLength?: number
}

/**
 * Campo de texto que sugiere a quién mencionar al escribir «@».
 *
 * La lista es la gente de tu club, que es a quien puedes mencionar. Las
 * flechas y el intro sirven para elegir sin soltar el teclado, y Escape
 * cierra la lista sin tocar lo escrito.
 */
export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  ariaLabel,
  autoFocus,
  onKeyDown,
  maxLength,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [gente, setGente] = useState<Mencionable[]>([])
  const [sugerencias, setSugerencias] = useState<Mencionable[]>([])
  const [activa, setActiva] = useState(0)

  // El contador no está siempre a la vista: aparece cuando quedan 120
  // caracteres. Antes de eso solo es ruido mientras escribes.
  const restantes = maxLength != null ? maxLength - value.length : null
  const avisa = restantes != null && restantes <= 120

  useEffect(() => {
    void mencionables().then(setGente)
  }, [])

  /** Recalcula las sugerencias con el cursor donde esté ahora. */
  const revisar = (texto: string, caret: number) => {
    const parcial = mencionEnCurso(texto, caret)
    if (parcial === null || gente.length === 0) {
      setSugerencias([])
      return
    }
    const encaja = gente.filter(
      (p) =>
        p.username.startsWith(parcial) ||
        p.display_name.toLowerCase().startsWith(parcial),
    )
    setSugerencias(encaja.slice(0, 5))
    setActiva(0)
  }

  const elegir = (p: Mencionable) => {
    const el = ref.current
    if (!el) return
    const { texto, caret } = insertarMencion(value, el.selectionStart ?? value.length, p.username)
    onChange(texto)
    setSugerencias([])
    // El cursor vuelve justo detrás de la mención insertada
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="mentionbox">
      <textarea
        ref={ref}
        className={className}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          revisar(e.target.value, e.target.selectionStart ?? 0)
        }}
        onClick={(e) => revisar(value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => window.setTimeout(() => setSugerencias([]), 150)}
        onKeyDown={(e) => {
          if (sugerencias.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiva((n) => (n + 1) % sugerencias.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiva((n) => (n - 1 + sugerencias.length) % sugerencias.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              elegir(sugerencias[activa])
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setSugerencias([])
              return
            }
          }
          onKeyDown?.(e)
        }}
      />

      {avisa && (
        <span
          className={`mentionbox__cuenta label-small${restantes! < 0 ? ' pasado' : ''}`}
          aria-live="polite"
        >
          {restantes! >= 0
            ? `Quedan ${restantes} caracteres`
            : `Te sobran ${-restantes!} caracteres`}
        </span>
      )}

      {sugerencias.length > 0 && (
        <ul className="mentionbox__lista" role="listbox" aria-label="Personas a mencionar">
          {sugerencias.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activa}
                className={`mentionbox__op${i === activa ? ' activa' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(p)}
              >
                <Avatar name={p.display_name} url={p.avatar_url} size={26} />
                <span className="mentionbox__txt">
                  <span className="title-small">{p.display_name}</span>
                  <span className="body-small on-surface-variant">@{p.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
