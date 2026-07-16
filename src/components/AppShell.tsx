import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import '@material/web/ripple/ripple.js'
import '@material/web/iconbutton/icon-button.js'
import { supabase } from '../lib/supabase'
import { Avatar } from './ui'
import { useAuth } from '../auth/AuthContext'
import { useCompose } from './ComposeProvider'
import { isDarkActive, setThemeMode } from '../theme/theme'
import './AppShell.css'

const DESTINATIONS = [
  { to: '/', icon: 'home', label: 'Inicio' },
  { to: '/explore', icon: 'travel_explore', label: 'Explorar' },
  { to: '/library', icon: 'auto_stories', label: 'Biblioteca' },
  { to: '/me', icon: 'account_circle', label: 'Perfil' },
]

/** En escritorio hay sitio: el Club también va en la barra lateral. */
const SIDEBAR_DESTINATIONS = [
  ...DESTINATIONS.slice(0, 3),
  { to: '/club', icon: 'group', label: 'Club' },
  DESTINATIONS[3],
]

function Logo() {
  return (
    <span className="logo">
      <span className="logo__mark" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="logo__word">
        Tsundoku <em>Zero</em>
      </span>
    </span>
  )
}

const DRAWER_LINKS = [
  { to: '/', icon: 'home', label: 'Inicio' },
  { to: '/explore', icon: 'travel_explore', label: 'Explorar' },
  { to: '/library', icon: 'auto_stories', label: 'Biblioteca' },
  { to: '/club', icon: 'group', label: 'Mi club' },
  { to: '/notifications', icon: 'notifications', label: 'Notificaciones' },
  { to: '/me', icon: 'account_circle', label: 'Perfil' },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, isSuperAdmin, signOut } = useAuth()
  const { openCompose } = useCompose()
  const [dark, setDark] = useState(isDarkActive)
  const [unread, setUnread] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [topQuery, setTopQuery] = useState('')

  // Cierra el drawer al cambiar de ruta
  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])

  // Contador de no leídas: al navegar y cuando la bandeja marca leído.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const refresh = () => {
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false)
        .then(({ count }) => {
          if (!cancelled) setUnread(count ?? 0)
        })
    }
    refresh()
    window.addEventListener('tz-notifications-read', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('tz-notifications-read', refresh)
    }
  }, [session, location.pathname])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    setThemeMode(next ? 'dark' : 'light')
  }

  const bell = (
    <span className="bell">
      <md-icon-button
        aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}
        onClick={() => navigate('/notifications')}
      >
        <span className="material-symbols-rounded">notifications</span>
      </md-icon-button>
      {unread > 0 && (
        <span className="bell__badge">{unread > 9 ? '9+' : unread}</span>
      )}
    </span>
  )

  // Barra móvil: 5 ranuras con el FAB en el centro.
  const mobileLeft = DESTINATIONS.slice(0, 2)
  const mobileRight = DESTINATIONS.slice(2)

  return (
    <div className="shell">
      {/* ---- Barra lateral (escritorio) ---- */}
      <aside className="sidebar">
        <div className="sidebar__logo">
          <Logo />
        </div>
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {SIDEBAR_DESTINATIONS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `side-item${isActive ? ' active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <md-ripple />
                  <span
                    className={`material-symbols-rounded${isActive ? ' filled' : ''}`}
                  >
                    {icon}
                  </span>
                  <span className="label-large">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `side-item${isActive ? ' active' : ''}`
            }
          >
            <md-ripple />
            <span className="material-symbols-rounded">notifications</span>
            <span className="label-large">
              Avisos{unread > 0 ? ` (${unread})` : ''}
            </span>
          </NavLink>
          {isSuperAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `side-item${isActive ? ' active' : ''}`
              }
            >
              <md-ripple />
              <span className="material-symbols-rounded">
                admin_panel_settings
              </span>
              <span className="label-large">Admin</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar__foot">
          <button className="side-item" onClick={toggleTheme} type="button">
            <span className="material-symbols-rounded">
              {dark ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="label-large">{dark ? 'Tema claro' : 'Tema oscuro'}</span>
          </button>
          <span className="shell-version label-small">
            Tsundoku Zero v{__APP_VERSION__} · beta
          </span>
        </div>
      </aside>

      {/* ---- Drawer (móvil) ---- */}
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(false)}>
          <nav
            className="drawer"
            aria-label="Menú"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="drawer__profile"
              onClick={() => navigate('/me')}
            >
              <Avatar
                name={profile?.display_name ?? 'Tú'}
                url={profile?.avatar_url}
                size={48}
              />
              <span className="drawer__names">
                <span className="title-medium">{profile?.display_name}</span>
                <span className="body-small on-surface-variant">
                  @{profile?.username}
                </span>
              </span>
            </button>

            <div className="drawer__links">
              {DRAWER_LINKS.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `drawer__link${isActive ? ' active' : ''}`
                  }
                >
                  <span className="material-symbols-rounded">{icon}</span>
                  <span className="label-large">{label}</span>
                  {to === '/notifications' && unread > 0 && (
                    <span className="drawer__badge label-small">{unread}</span>
                  )}
                </NavLink>
              ))}
              {isSuperAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `drawer__link${isActive ? ' active' : ''}`
                  }
                >
                  <span className="material-symbols-rounded">
                    admin_panel_settings
                  </span>
                  <span className="label-large">Administración</span>
                </NavLink>
              )}
            </div>

            <div className="drawer__foot">
              <button className="drawer__link" onClick={toggleTheme}>
                <span className="material-symbols-rounded">
                  {dark ? 'light_mode' : 'dark_mode'}
                </span>
                <span className="label-large">
                  {dark ? 'Tema claro' : 'Tema oscuro'}
                </span>
              </button>
              <button
                className="drawer__link"
                onClick={() => void signOut()}
              >
                <span className="material-symbols-rounded">logout</span>
                <span className="label-large">Cerrar sesión</span>
              </button>
              <span className="shell-version label-small">
                Tsundoku Zero v{__APP_VERSION__} · beta
              </span>
            </div>
          </nav>
        </div>
      )}

      {/* ---- Columna principal ---- */}
      <div className="main">
        <header className="top-bar">
          <span className="top-bar__brand">
            <md-icon-button
              class="top-bar__menu"
              aria-label="Abrir menú"
              onClick={() => setDrawer(true)}
            >
              <span className="material-symbols-rounded">menu</span>
            </md-icon-button>
            <Logo />
          </span>

          {/* Buscador (solo escritorio; en móvil queda el icono) */}
          <form
            className="top-bar__search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = topQuery.trim()
              navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
            }}
          >
            <span className="material-symbols-rounded" aria-hidden>
              search
            </span>
            <input
              className="top-bar__searchinput body-medium"
              type="search"
              placeholder="Buscar libros o lectores…"
              aria-label="Buscar libros o lectores"
              value={topQuery}
              onChange={(e) => setTopQuery(e.target.value)}
            />
          </form>

          <span className="top-bar__actions">
            <md-icon-button
              class="top-bar__searchbtn"
              aria-label="Buscar"
              onClick={() => navigate('/explore')}
            >
              <span className="material-symbols-rounded">search</span>
            </md-icon-button>
            {bell}
            <button
              className="top-bar__avatar"
              onClick={() => navigate('/me')}
              aria-label="Tu perfil"
            >
              <Avatar
                name={profile?.display_name ?? 'Tú'}
                url={profile?.avatar_url}
                size={34}
              />
            </button>
          </span>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {/* ---- Barra inferior (móvil) ---- */}
      <nav className="nav-bar" aria-label="Navegación principal">
        {mobileLeft.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} />
        ))}
        <button
          className="fab"
          type="button"
          aria-label="Compartir una idea"
          onClick={() => void openCompose()}
        >
          <md-ripple />
          <span className="material-symbols-rounded">add</span>
        </button>
        {mobileRight.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} />
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      {({ isActive }) => (
        <>
          {/* Sin ripple: en móvil el feedback es el tinte + escala, como iOS */}
          <span className="nav-icon-pill">
            <span className={`material-symbols-rounded${isActive ? ' filled' : ''}`}>
              {icon}
            </span>
          </span>
          <span className="label-small">{label}</span>
        </>
      )}
    </NavLink>
  )
}
