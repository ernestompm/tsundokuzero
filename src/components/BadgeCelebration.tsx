import { useCallback, useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { badgesDe, type Badge, type MemberStats } from '../lib/badges'
import { useModalBehavior } from './modal'
import './badgecelebration.css'

/**
 * El momento de ganar una insignia (migr. 040).
 *
 * Antes se calculaban bien y se enseñaban en el perfil, pero nadie se
 * enteraba de que tenía una nueva: había que ir a buscarla. Una insignia
 * sin el momento de ganarla es decoración; el momento es casi todo el
 * valor.
 *
 * Cómo funciona: al entrar se comparan las insignias que tienes ahora
 * contra las que ya se te han enseñado (`profiles.badges_seen`). Las que
 * sobren se celebran de una en una y se marcan. Quien ya llevaba tiempo
 * en el club no recibe una avalancha: la primera vez se marcan todas sin
 * enseñar ninguna, porque celebrar quince medallas viejas de golpe no es
 * una celebración, es una notificación de spam.
 */
export default function BadgeCelebration() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [cola, setCola] = useState<Badge[]>([])

  const cerrar = useCallback(() => {
    setCola((c) => c.slice(1))
  }, [])

  const sheetRef = useModalBehavior(cola.length > 0, cerrar)

  useEffect(() => {
    if (!session || !profile) return
    let cancelado = false

    void (async () => {
      const { data, error } = await supabase
        .from('club_member_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()
      if (error || !data || cancelado) return

      const tengo = badgesDe(data as unknown as MemberStats)
      if (tengo.length === 0) return

      const vistas = new Set(
        Array.isArray(profile.badges_seen) ? (profile.badges_seen as string[]) : [],
      )
      const nuevas = tengo.filter((b) => !vistas.has(b.id))
      if (nuevas.length === 0) return

      // Primera vez: se marcan todas sin celebrar ninguna. No tiene
      // sentido darle quince medallas de golpe a quien lleva medio año.
      const estrena = vistas.size === 0
      await supabase.rpc('marcar_insignias', { p_ids: tengo.map((b) => b.id) })
      if (cancelado || estrena) return

      setCola(nuevas.slice(0, 3))
    })()

    return () => {
      cancelado = true
    }
    // `profile` cambia al refrescarlo; basta con el id para no repetir
  }, [session, profile])

  if (cola.length === 0) return null

  const b = cola[0]
  const quedan = cola.length - 1

  return (
    <div className="tz-dialog-scrim" onClick={cerrar}>
      <div
        ref={sheetRef}
        className="tz-dialog celebra"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="celebra-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`celebra__medalla celebra__medalla--${b.tono}`} aria-hidden="true">
          <span className="material-symbols-rounded">{b.icon}</span>
        </span>

        <p className="tz-kicker celebra__kicker">Insignia nueva</p>
        <h2 id="celebra-title" className="headline-small serif celebra__nombre">
          {b.nombre}
        </h2>
        <p className="body-large celebra__detalle">{b.detalle}</p>

        <div className="tz-dialog__actions celebra__acciones">
          <md-text-button type="button" onClick={cerrar}>
            {quedan > 0 ? `Siguiente (${quedan})` : 'Seguir leyendo'}
          </md-text-button>
          <md-filled-button
            type="button"
            autofocus
            onClick={() => {
              setCola([])
              navigate('/me')
            }}
          >
            Ver mis insignias
          </md-filled-button>
        </div>
      </div>
    </div>
  )
}
