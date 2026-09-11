import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './ui.css'

/* ===================== Portada de libro ===================== */

/**
 * Portadas inventadas para los libros sin imagen.
 *
 * Antes eran ocho colores sueltos —azul, morado, marrón— que no eran de
 * nadie y hacían que una estantería pareciera una pantalla de aplicación.
 * Ahora salen todas de la paleta de marca, así que una rejilla de libros
 * sin portada se lee como una colección de una editorial: mismo papel,
 * misma tinta, variaciones dentro de una familia.
 *
 * El amarillo y el salvia llevan tinta oscura; los oscuros, crema.
 */
const COVER_PALETTE = [
  { bg: '#2C3D37', fg: '#F4EFEE' }, // Scarab
  { bg: '#566955', fg: '#F4EFEE' }, // Picholine
  { bg: '#F5E1AC', fg: '#3D2F06' }, // Glad Yellow
  { bg: '#A5A88F', fg: '#252C1F' }, // Bud
  { bg: '#BC5339', fg: '#FFF6F2' }, // Orange Vermillion
  { bg: '#1F2B27', fg: '#E3E8DC' }, // Scarab profundo
  { bg: '#7E6220', fg: '#FBF6EA' }, // Glad Yellow tostado
  { bg: '#8E9A7E', fg: '#20281C' }, // Bud oscurecido
]

function coverColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return COVER_PALETTE[h % COVER_PALETTE.length]
}

type CoverSize = 'sm' | 'md' | 'lg' | 'xl'

export function BookCover({
  title,
  author,
  coverUrl,
  size = 'md',
}: {
  title: string
  author?: string
  coverUrl?: string | null
  size?: CoverSize
}) {
  if (coverUrl) {
    return (
      <img
        className={`book-cover book-cover--${size}`}
        src={coverUrl}
        alt={`Portada de ${title}`}
        loading="lazy"
      />
    )
  }
  const { bg, fg } = coverColor(title)
  return (
    <div
      className={`book-cover book-cover--${size} book-cover--gen`}
      style={{ background: bg, color: fg }}
      aria-label={`Portada de ${title}`}
      role="img"
    >
      <span className="book-cover__title serif">{title}</span>
      {author && <span className="book-cover__author">{author}</span>}
    </div>
  )
}

/* ===================== Avatar ===================== */

/**
 * Iniciales cuando no hay foto. Mayoría en la familia verde —son caras,
 * no etiquetas, y no deben convertirse en una macedonia— con dos tonos
 * cálidos para que un grupo no se vea monocorde.
 */
const AVATAR_PALETTE = [
  { bg: '#2C3D37', fg: '#F4EFEE' },
  { bg: '#566955', fg: '#F4EFEE' },
  { bg: '#7E6220', fg: '#FBF6EA' },
  { bg: '#A5A88F', fg: '#252C1F' },
  { bg: '#BC5339', fg: '#FFF6F2' },
  { bg: '#3E5148', fg: '#E6EDE2' },
]

export function Avatar({
  name,
  url,
  size = 38,
}: {
  name: string
  url?: string | null
  size?: number
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const { bg, fg } = AVATAR_PALETTE[h % AVATAR_PALETTE.length]
  if (url) {
    return (
      <img
        className="avatar"
        src={url}
        alt={name}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="avatar avatar--gen"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function AvatarStack({
  people,
  extra,
}: {
  people: { name: string; url?: string | null }[]
  extra?: number
}) {
  return (
    <span className="avatar-stack">
      {people.map((p, i) => (
        <span key={i} className="avatar-stack__item">
          <Avatar name={p.name} url={p.url} size={26} />
        </span>
      ))}
      {extra ? <span className="avatar-stack__extra label-small">+{extra}</span> : null}
    </span>
  )
}

/* ===================== Barra de progreso ===================== */

export function ProgressBar({
  percent,
  label,
}: {
  percent: number
  label?: string
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progreso de lectura'}
    >
      <div className="progress__fill" style={{ width: `${p}%` }} />
    </div>
  )
}

/* ===================== Chip seleccionable ===================== */

/**
 * Píldora seleccionable compartida (auditoría UX M-09): un solo estado
 * activo y una sola anatomía para filtros, destinos del composer, tipos
 * de idea, motivos de denuncia, etc.
 */
export function Chip({
  active = false,
  onClick,
  icon,
  children,
  className = '',
}: {
  active?: boolean
  onClick?: () => void
  icon?: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={`tz-chip label-large${active ? ' tz-chip--active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon && (
        <span className="material-symbols-rounded" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  )
}

/* ===================== Cabecera de sección ===================== */

export function SectionHeader({
  title,
  actionLabel,
  actionTo,
}: {
  title: string
  actionLabel?: string
  actionTo?: string
}) {
  return (
    <div className="section-header">
      <h2 className="title-large section-header__title">{title}</h2>
      {actionLabel && actionTo && (
        <Link className="label-large section-header__action" to={actionTo}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/* ===================== Tarjeta genérica ===================== */

export function Card({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'soft' | 'outlined'
}) {
  return <div className={`card card--${tone} ${className}`}>{children}</div>
}
