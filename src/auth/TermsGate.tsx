import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { ConsentCheckbox } from '../components/ConsentCheckbox'
import { useAuth } from './AuthContext'
import { TERMS_VERSION } from '../features/legal/legalContent'
import './auth.css'

type GateState = 'checking' | 'ok' | 'needs-acceptance'

/**
 * Re-aceptación de términos (RGPD art. 7; auditoría P0-2).
 *
 * Con perfil creado, comprueba que exista un consentimiento registrado
 * con versión >= TERMS_VERSION. Si no (usuario antiguo o versión nueva
 * de los textos), muestra un interstitial de aceptación y registra la
 * fila en `consents` con fecha.
 *
 * En error de red/servidor NO bloquea (fail-open): jamás dejar la app
 * inutilizable por un fallo transitorio; se reintenta al recargar.
 */
export default function TermsGate() {
  const { session, profile, signOut } = useAuth()
  const [state, setState] = useState<GateState>('checking')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !profile) return
    let cancelled = false
    supabase
      .from('consents')
      .select('doc_version')
      .eq('user_id', session.user.id)
      .eq('doc', 'terms')
      .order('doc_version', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // fail-open (p. ej. migración 018 sin ejecutar): no brickear la app
          setState('ok')
          return
        }
        setState(
          data && data.doc_version >= TERMS_VERSION ? 'ok' : 'needs-acceptance',
        )
      })
    return () => {
      cancelled = true
    }
  }, [session, profile])

  // Sin sesión/perfil decide RequireAuth; aquí solo cubrimos el gate.
  if (!session || !profile || state === 'ok') return <Outlet />

  // Loader mientras se comprueba el consentimiento (auditoría M-07):
  // nunca una pantalla en blanco entre el spinner de sesión y la app.
  if (state === 'checking')
    return (
      <main
        className="auth-page"
        style={{ display: 'grid', placeItems: 'center' }}
      >
        <md-circular-progress indeterminate aria-label="Cargando" />
      </main>
    )

  const accept = async () => {
    if (!session) return
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.from('consents').insert({
      user_id: session.user.id,
      doc: 'terms',
      doc_version: TERMS_VERSION,
    })
    setBusy(false)
    if (e && e.code !== '23505') {
      setError(
        friendlyError(e, 'No se pudo registrar la aceptación. Inténtalo de nuevo.'),
      )
      return
    }
    setState('ok')
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1 className="headline-medium">
            Términos actualizados
          </h1>
          <p className="body-medium tagline">
            Para seguir usando Tsundoku Zero necesitamos que aceptes la
            versión vigente de los términos.
          </p>
        </div>

        {error && <p className="auth-error body-medium">{error}</p>}

        <ConsentCheckbox checked={accepted} onChange={setAccepted} />

        <md-filled-button
          disabled={!accepted || busy || undefined}
          onClick={() => void accept()}
        >
          Aceptar y continuar
        </md-filled-button>
        <md-text-button onClick={() => void signOut()}>
          No acepto — cerrar sesión
        </md-text-button>
      </div>
    </main>
  )
}
