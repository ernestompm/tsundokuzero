import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from './AuthContext'
import './auth.css'

/**
 * Restablecer contraseña (auditoría C-01).
 *
 * Se llega desde el enlace del correo de recuperación: Supabase abre la
 * app con una sesión de tipo recovery, por lo que la ruta vive bajo
 * RequireAuth (como /onboarding) y solo hay que fijar la clave nueva.
 */
export default function ResetPasswordPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(
          friendlyError(error, 'No se pudo cambiar la contraseña. Inténtalo de nuevo.'),
        )
        return
      }
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (!session) return null

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <h1 className="headline-medium">Nueva contraseña</h1>
          <p className="body-medium tagline">
            Elige una contraseña nueva para {session.user.email}.
          </p>
        </div>

        {error && <p className="auth-error body-medium">{error}</p>}

        <md-outlined-text-field
          label="Contraseña nueva"
          type="password"
          autocomplete="new-password"
          required
          value={password}
          onInput={(e) =>
            setPassword((e.currentTarget as HTMLInputElement).value)
          }
        />
        <md-outlined-text-field
          label="Repite la contraseña"
          type="password"
          autocomplete="new-password"
          required
          value={confirm}
          onInput={(e) =>
            setConfirm((e.currentTarget as HTMLInputElement).value)
          }
        />

        <md-filled-button type="submit" disabled={busy || undefined}>
          {busy ? 'Un momento…' : 'Guardar y entrar'}
        </md-filled-button>
      </form>
    </main>
  )
}
