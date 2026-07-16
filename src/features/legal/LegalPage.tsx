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
interface ModStats {
  open: number
  actioned: number
  dismissed: number
}

export default function LegalPage() {
  const { doc } = useParams()
  const entry = doc ? LEGAL_DOCS[doc] : undefined
  const [settings, setSettings] = useState<LegalSettings>({})
  const [stats, setStats] = useState<ModStats | null>(null)

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

  // Cifras agregadas de moderación (P2-15, DSA art. 15): solo recuentos.
  useEffect(() => {
    if (doc !== 'transparencia') return
    let cancelled = false
    supabase.rpc('moderation_stats').then(({ data, error }) => {
      // Sin migración 020, la sección de cifras simplemente no se muestra
      if (cancelled || error) return
      const row = ((data as ModStats[] | null) ?? [])[0]
      if (row) setStats(row)
    })
    return () => {
      cancelled = true
    }
  }, [doc])

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

        {doc === 'transparencia' && stats && (
          <div className="legal-stats">
            <div className="legal-stat">
              <span className="headline-medium">{stats.open}</span>
              <span className="body-small on-surface-variant">
                denuncias pendientes
              </span>
            </div>
            <div className="legal-stat">
              <span className="headline-medium">{stats.actioned}</span>
              <span className="body-small on-surface-variant">
                contenidos retirados
              </span>
            </div>
            <div className="legal-stat">
              <span className="headline-medium">{stats.dismissed}</span>
              <span className="body-small on-surface-variant">
                denuncias desestimadas
              </span>
            </div>
          </div>
        )}

        <footer className="legal-foot body-small on-surface-variant">
          Tsundoku Zero · beta ·{' '}
          <Link to="/login">Entrar</Link>
        </footer>
      </div>
    </main>
  )
}
