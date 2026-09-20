import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { ConsentCheckbox } from '../components/ConsentCheckbox'
import { TERMS_VERSION } from '../features/legal/legalContent'
import { useAuth } from './AuthContext'
import './auth.css'

const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const { session, profile, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // El código puede venir en el propio enlace («…/welcome?c=abcdef»), que
  // es lo que se comparte por WhatsApp. Dictar seis letras es justo la
  // parte del alta donde se pierde la gente.
  const [invite, setInvite] = useState(
    () =>
      new URLSearchParams(window.location.search).get('c') ??
      localStorage.getItem('tz-invite') ??
      '',
  )
  // RGPD art. 7 + LOPDGDD art. 7: aceptación expresa y edad mínima (14)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session)
    return <Navigate to={profile ? '/' : '/onboarding'} replace />

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

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

    // Recuperación de contraseña (auditoría C-01)
    if (mode === 'forgot') {
      setBusy(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/reset-password` },
        )
        if (error) {
          setError(friendlyError(error, 'No se pudo enviar el correo. Inténtalo de nuevo.'))
        } else {
          setNotice(
            'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña.',
          )
        }
      } finally {
        setBusy(false)
      }
      return
    }

    // AQUÍ NO SE VALIDA EL CÓDIGO.
    //
    // Se hacía: se comparaba contra `VITE_INVITE_CODE`, el código global
    // que viaja en el build. Desde que cada club tiene el suyo (migr.
    // 038), quien llegaba con el código de su club —seis letras— lo veía
    // rechazado con «código erróneo» SIN QUE EL SERVIDOR LLEGARA A
    // VERLO. El cliente no puede saber los códigos de los clubes, y
    // tampoco debe: el único que puede decir si un código vale es el
    // servidor, y lo hace en `complete_onboarding`.
    if (mode === 'signup' && invite.trim() === '') {
      setError('Escribe el código que te han pasado.')
      return
    }

    if (mode === 'signup' && !accepted) {
      setError(
        'Para crear la cuenta debes aceptar los términos y declarar que tienes al menos 14 años.',
      )
      return
    }

    // El código se re-valida EN SERVIDOR al completar el onboarding
    // (migr. 020); se guarda para no pedirlo dos veces. Igual con el
    // consentimiento (auditoría M-03): el onboarding lo precarga.
    if (mode === 'signup') {
      localStorage.setItem('tz-invite', invite.trim())
      localStorage.setItem('tz-consent', String(TERMS_VERSION))
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error)
          setError(friendlyError(error, 'No se pudo iniciar sesión. Inténtalo de nuevo.'))
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // El código viaja en el enlace de vuelta: si confirmas el
            // correo en otro dispositivo, el `localStorage` de aquí no
            // existe allí y te quedarías sin él en mitad del alta.
            emailRedirectTo: invite.trim()
              ? `${window.location.origin}/?c=${encodeURIComponent(invite.trim())}`
              : window.location.origin,
          },
        })
        if (error) {
          setError(friendlyError(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.'))
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
  const isForgot = mode === 'forgot'

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <h1 className="display-small">
            Tsundoku <em>Zero</em>
          </h1>
          <p className="body-large tagline">
            {isForgot
              ? 'Recupera el acceso a tu cuenta.'
              : 'Leer acompañado, sin spoilers.'}
          </p>
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
        {!isForgot && (
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
        )}
        {isSignup && (
          <>
            <md-outlined-text-field
              label="Código de invitación"
              required
              value={invite}
              supporting-text="Pídeselo a quien te invitó al club"
              onInput={(e) =>
                setInvite((e.currentTarget as HTMLInputElement).value)
              }
            />
            <ConsentCheckbox checked={accepted} onChange={setAccepted} />
          </>
        )}

        <md-filled-button
          type="submit"
          disabled={busy || (isSignup && !accepted) || undefined}
        >
          {busy
            ? 'Un momento…'
            : isForgot
              ? 'Enviar enlace de recuperación'
              : isSignup
                ? 'Crear cuenta'
                : 'Entrar'}
        </md-filled-button>

        {mode === 'login' && (
          <md-text-button
            type="button"
            class="auth-forgot"
            onClick={() => switchMode('forgot')}
          >
            ¿Has olvidado tu contraseña?
          </md-text-button>
        )}

        <p className="auth-switch body-medium">
          {isForgot ? (
            <md-text-button type="button" onClick={() => switchMode('login')}>
              Volver a iniciar sesión
            </md-text-button>
          ) : (
            <>
              {isSignup ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
              <md-text-button
                type="button"
                onClick={() => switchMode(isSignup ? 'login' : 'signup')}
              >
                {isSignup ? 'Entrar' : 'Crear cuenta'}
              </md-text-button>
            </>
          )}
        </p>

        {GOOGLE_ENABLED && !isForgot && (
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

        <nav className="legal-links label-small" aria-label="Información legal">
          <Link to="/legal/privacidad">Privacidad</Link>
          <Link to="/legal/terminos">Términos</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/aviso-legal">Aviso legal</Link>
        </nav>
      </form>
    </main>
  )
}
