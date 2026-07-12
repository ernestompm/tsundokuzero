import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './ui.css'

/* ===================== Portada de libro ===================== */

const COVER_PALETTE = [
  { bg: '#3E5240', fg: '#EFEDE3' },
  { bg: '#6B4A3A', fg: '#F2E7DC' },
  { bg: '#41506B', fg: '#E6EAF2' },
  { bg: '#7A6A4E', fg: '#F5EEDF' },
  { bg: '#5E4B33', fg: '#F1E6D6' },
  { bg: '#7A3B2E', fg: '#F5E1DA' },
  { bg: '#3E5449', fg: '#E4EFE9' },
  { bg: '#4A4258', fg: '#E9E5F0' },
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

const AVATAR_BG = ['#3E5449', '#5E4B33', '#7A3B2E', '#4A4258', '#41506B', '#6B4A3A']

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
  const bg = AVATAR_BG[h % AVATAR_BG.length]
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
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function AvatarStack({ names, extra }: { names: string[]; extra?: number }) {
  return (
    <span className="avatar-stack">
      {names.map((n, i) => (
        <span key={i} className="avatar-stack__item">
          <Avatar name={n} size={26} />
        </span>
      ))}
      {extra ? <span className="avatar-stack__extra label-small">+{extra}</span> : null}
    </span>
  )
}

/* ===================== Barra de progreso ===================== */

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="progress" role="progressbar" aria-valuenow={p}>
      <div className="progress__fill" style={{ width: `${p}%` }} />
    </div>
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
