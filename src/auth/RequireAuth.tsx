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

  if (!session) return <Navigate to="/login" replace />

  if (!profile && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />

  if (profile && location.pathname === '/onboarding')
    return <Navigate to="/" replace />

  return <Outlet />
}
