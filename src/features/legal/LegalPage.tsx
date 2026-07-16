import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import RichText from '../../components/RichText'
import { supabase } from '../../lib/supabase'
import {
  fillLegalBody,
  settingsFromRows,
  LEGAL_DOCS,
  LEGAL_ORDER,
  type LegalSettings,
} from './legalContent'
import './legal.css'

/**
 * Páginas legales PÚBLICAS (sin login): /legal/:doc
 * Obligación de disponibilidad permanente (LSSI art. 10, RGPD arts. 12-13).
 * Los datos del titular se cargan de app_settings (Administración → Legal)
 * y sustituyen los tokens del texto; si faltan, el token queda visible.
 */
export default function LegalPage() {
  const { doc } = useParams()
  const entry = doc ? LEGAL_DOCS[doc] : undefined
  const [settings, setSettings] = useState<LegalSettings>({})

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        // En error (p. ej. migración 019 sin ejecutar) se quedan los tokens
        if (!cancelled && !error && data) setSettings(settingsFromRows(data))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (entry) {
      document.title = `${entry.title} — Tsundoku Zero`
      window.scrollTo(0, 0)
    }
    return () => {
      document.title = 'Tsundoku Zero'
    }
  }, [entry])

  if (!entry) return <Navigate to="/legal/terminos" replace />

  return (
    <main className="legal-page">
      <div className="legal-card">
        <header className="legal-head">
          <Link to="/" className="legal-brand title-medium">
            Tsundoku <em>Zero</em>
          </Link>
          <h1 className="headline-medium serif">{entry.title}</h1>
        </header>

        <nav className="legal-nav" aria-label="Documentos legales">
          {LEGAL_ORDER.map((slug) => (
            <NavLink
              key={slug}
              to={`/legal/${slug}`}
              className={({ isActive }) =>
                `legal-nav__item label-medium${isActive ? ' active' : ''}`
              }
            >
              {LEGAL_DOCS[slug].short}
            </NavLink>
          ))}
        </nav>

        <RichText text={fillLegalBody(entry.body, settings)} className="legal-body" />

        <footer className="legal-foot body-small on-surface-variant">
          Tsundoku Zero · beta ·{' '}
          <Link to="/login">Entrar</Link>
        </footer>
      </div>
    </main>
  )
}
