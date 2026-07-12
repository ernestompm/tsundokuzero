import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import '@material/web/ripple/ripple.js'
import '@material/web/iconbutton/icon-button.js'
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

export default function AppShell() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { openCompose } = useCompose()
  const [dark, setDark] = useState(isDarkActive)

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    setThemeMode(next ? 'dark' : 'light')
  }

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
          {DESTINATIONS.map(({ to, icon, label }) => (
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
        </nav>
        <div className="sidebar__foot">
          <button className="side-item" onClick={toggleTheme} type="button">
            <span className="material-symbols-rounded">
              {dark ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="label-large">{dark ? 'Tema claro' : 'Tema oscuro'}</span>
          </button>
        </div>
      </aside>

      {/* ---- Columna principal ---- */}
      <div className="main">
        <header className="top-bar">
          <span className="top-bar__brand">
            <Logo />
          </span>
          <span className="top-bar__actions">
            <md-icon-button aria-label="Buscar" onClick={() => navigate('/explore')}>
              <span className="material-symbols-rounded">search</span>
            </md-icon-button>
            <md-icon-button
              aria-label={dark ? 'Tema claro' : 'Tema oscuro'}
              onClick={toggleTheme}
            >
              <span className="material-symbols-rounded">
                {dark ? 'light_mode' : 'dark_mode'}
              </span>
            </md-icon-button>
            <button
              className="top-bar__avatar"
              onClick={() => navigate('/me')}
              aria-label="Tu perfil"
            >
              <Avatar name={profile?.display_name ?? 'Tú'} url={profile?.avatar_url} size={34} />
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
          <span className="nav-icon-pill">
            <md-ripple />
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
