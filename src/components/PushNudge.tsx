import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import { useAuth } from '../auth/AuthContext'
import { enablePush, pushEnabled, pushSupported } from '../lib/push'
import './pushnudge.css'

const DISMISS_KEY = 'tz-push-nudge'

/**
 * Invitación a activar el push nada más entrar (los permisos de
 * notificación EXIGEN un gesto del usuario: esto es lo más parecido a
 * «activado por defecto» que permite la web). Un toque y listo; si se
 * descarta, no vuelve a aparecer en este dispositivo.
 */
export default function PushNudge() {
  const { session } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    if (!pushSupported()) return
    if (Notification.permission === 'denied') return
    if (localStorage.getItem(DISMISS_KEY) === 'off') return
    let cancelled = false
    void pushEnabled().then((on) => {
      if (!cancelled) setShow(!on)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  if (!show || !session) return null

  const activate = async () => {
    setBusy(true)
    const result = await enablePush(session.user.id)
    setBusy(false)
    // ok → activado; denied → el navegador manda: en ambos casos, fuera
    if (result === 'ok' || result === 'denied') {
      localStorage.setItem(DISMISS_KEY, 'off')
      setShow(false)
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'off')
    setShow(false)
  }

  return (
    <div className="push-nudge">
      <span className="push-nudge__icon material-symbols-rounded" aria-hidden>
        notifications
      </span>
      <div className="push-nudge__text">
        <span className="title-small">No te pierdas nada</span>
        <span className="body-small on-surface-variant">
          Activa los avisos y entérate al momento cuando te respondan o se
          desbloquee algo — aunque la app esté cerrada.
        </span>
      </div>
      <div className="push-nudge__actions">
        <md-filled-button
          disabled={busy || undefined}
          onClick={() => void activate()}
        >
          Activar
        </md-filled-button>
        <md-text-button onClick={dismiss}>Ahora no</md-text-button>
      </div>
    </div>
  )
}
