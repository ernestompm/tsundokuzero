import { Link } from 'react-router-dom'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-tonal-button.js'
import { useAuth } from '../../auth/AuthContext'

export default function ProfilePage() {
  const { profile, isSuperAdmin, signOut } = useAuth()

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <div
          aria-hidden
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 12px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
          }}
          className="headline-small"
        >
          {profile?.display_name.slice(0, 2).toUpperCase() ?? '··'}
        </div>
        <h2 className="headline-small">{profile?.display_name}</h2>
        <p className="body-medium on-surface-variant">@{profile?.username}</p>
        {profile?.bio && <p className="body-medium">{profile.bio}</p>}
      </div>

      <p className="body-medium on-surface-variant">
        Aquí irá tu muro: entradas de blog y notas compartidas (Fase 3).
      </p>

      {isSuperAdmin && (
        <Link to="/admin" style={{ display: 'block' }}>
          <md-filled-tonal-button type="button" style={{ width: '100%' }}>
            <span slot="icon" className="material-symbols-rounded">
              admin_panel_settings
            </span>
            Gestión de usuarios
          </md-filled-tonal-button>
        </Link>
      )}

      <md-outlined-button type="button" onClick={() => void signOut()}>
        Cerrar sesión
      </md-outlined-button>
    </section>
  )
}
