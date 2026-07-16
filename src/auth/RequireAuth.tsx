import { Navigate, Outlet, useLocation } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { useAuth } from './AuthContext'

/**
 * Guarda de rutas: sin sesión → /login; con sesión pero sin perfil
 * (onboarding pendiente) → /onboarding.
 */
export default function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <md-circular-progress indeterminate />
      </div>
    )
  }

  // Sin sesión, la puerta de entrada es el escaparate público
  if (!session) return <Navigate to="/welcome" replace />

  if (!profile && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />

  // OJO: con perfil creado NO expulsamos de /onboarding — el paso 2
  // (unirse al club + fijar progreso) ocurre después de crear el perfil.
  // OnboardingPage decide por sí misma cuándo está completado.

  return <Outlet />
}
