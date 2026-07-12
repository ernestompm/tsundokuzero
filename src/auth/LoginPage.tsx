import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import './auth.css'

const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true'
const INVITE_CODE = import.meta.env.VITE_INVITE_CODE ?? ''

type Mode = 'login' | 'signup'

function translateError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed':
      'Tu correo aún no está verificado. Revisa tu bandeja de entrada.',
    'User already registered': 'Ya existe una cuenta con ese correo.',
  }
  return (
    map[message] ??
    (message.includes('Password should be')
      ? 'La contraseña debe tener al menos 6 caracteres.'
      : message)
  )
}

export default function LoginPage() {
  const { session, profile, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session)
    return <Navigate to={profile ? '/' : '/onboarding'} replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!isSupabaseConfigured) {
      setError(
        'Supabase aún no está conectado: falta configurar .env.local con las credenciales del proyecto.',
      )
      return
    }

    if (mode === 'signup' && invite.trim() !== INVITE_CODE) {
      setError('Código de invitación incorrecto.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) setError(translateError(error.message))
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) {
          setError(translateError(error.message))
        } else if (!data.session) {
          setNotice(
            'Te hemos enviado un correo de verificación. Confírmalo y vuelve a entrar.',
          )
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <h1 className="display-small">
            Tsundoku <em>Zero</em>
          </h1>
          <p className="body-large tagline">Leer acompañado, sin spoilers.</p>
        </div>

        {error && <p className="auth-error body-medium">{error}</p>}
        {notice && <p className="auth-notice body-medium">{notice}</p>}

        <md-outlined-text-field
          label="Correo electrónico"
          type="email"
          autocomplete="email"
          required
          value={email}
          onInput={(e) =>
            setEmail((e.currentTarget as HTMLInputElement).value)
          }
        />
        <md-outlined-text-field
          label="Contraseña"
          type="password"
          autocomplete={isSignup ? 'new-password' : 'current-password'}
          required
          value={password}
          onInput={(e) =>
            setPassword((e.currentTarget as HTMLInputElement).value)
          }
        />
        {isSignup && (
          <md-outlined-text-field
            label="Código de invitación"
            required
            value={invite}
            supporting-text="Pídeselo a quien te invitó al club"
            onInput={(e) =>
              setInvite((e.currentTarget as HTMLInputElement).value)
            }
          />
        )}

        <md-filled-button type="submit" disabled={busy || undefined}>
          {busy ? 'Un momento…' : isSignup ? 'Crear cuenta' : 'Entrar'}
        </md-filled-button>

        <p className="auth-switch body-medium">
          {isSignup ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
          <md-text-button
            type="button"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup')
              setError(null)
              setNotice(null)
            }}
          >
            {isSignup ? 'Entrar' : 'Crear cuenta'}
          </md-text-button>
        </p>

        {GOOGLE_ENABLED && (
          <>
            <div className="auth-divider label-medium">o</div>
            <md-outlined-button
              type="button"
              onClick={() =>
                supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: window.location.origin },
                })
              }
            >
              Continuar con Google
            </md-outlined-button>
          </>
        )}
      </form>
    </main>
  )
}
