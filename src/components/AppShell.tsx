import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import '@material/web/ripple/ripple.js'
import '@material/web/iconbutton/icon-button.js'
import { isDarkActive, setThemeMode } from '../theme/theme'
import './AppShell.css'

const DESTINATIONS = [
  { to: '/', icon: 'home', label: 'Inicio' },
  { to: '/book', icon: 'menu_book', label: 'Libro' },
  { to: '/club', icon: 'group', label: 'Club' },
  { to: '/me', icon: 'account_circle', label: 'Perfil' },
]

export default function AppShell() {
  const navigate = useNavigate()
  const [dark, setDark] = useState(isDarkActive)

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    setThemeMode(next ? 'dark' : 'light')
  }

  return (
    <div className="shell">
      <header className="top-bar">
        <span className="title-large brand">
          Tsundoku <em>Zero</em>
        </span>
        <span className="top-bar-actions">
          <md-icon-button aria-label="Buscar personas" onClick={() => navigate('/people')}>
            <span className="material-symbols-rounded">search</span>
          </md-icon-button>
          <md-icon-button
            aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            onClick={toggleTheme}
          >
            <span className="material-symbols-rounded">
              {dark ? 'light_mode' : 'dark_mode'}
            </span>
          </md-icon-button>
        </span>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="nav-bar" aria-label="Navegación principal">
        {DESTINATIONS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon-pill">
                  <md-ripple />
                  <span
                    className={`material-symbols-rounded${isActive ? ' filled' : ''}`}
                  >
                    {icon}
                  </span>
                </span>
                <span className="label-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
