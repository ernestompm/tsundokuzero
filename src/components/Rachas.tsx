import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import type { Rachas as RachasData } from '../lib/badges'
import './rachas.css'

/**
 * Las rachas (migr. 045).
 *
 * Dos cifras y nada más: días seguidos leyendo y días seguidos diciendo
 * algo. Los totales cuentan lo que ya hiciste; la racha cuenta lo que
 * tienes en juego esta noche, que es lo único que hace volver a nadie.
 *
 * Las dos se ganan HACIENDO —mover el capítulo, escribir—, nunca
 * abriendo la app. Una racha que se mantiene mirando el móvil premia
 * mirar el móvil.
 *
 * Y cuando el día está pendiente se dice sin regañar. «Aún no has
 * marcado» empuja; «vas a perder tu racha» chantajea, y a un club de
 * lectura no se entra para que le chantajeen.
 */
export default function Rachas({ compacta = false }: { compacta?: boolean }) {
  const { session } = useAuth()
  const [r, setR] = useState<RachasData | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelado = false
    void supabase.rpc('mis_rachas').then(({ data }) => {
      const fila = Array.isArray(data) ? data[0] : data
      if (!cancelado && fila) setR(fila as RachasData)
    })
    return () => {
      cancelado = true
    }
  }, [session])

  if (!r) return null
  // Sin nada que enseñar todavía no se ocupa sitio en el Inicio
  if (r.dias_leyendo === 0 && r.dias_hablando === 0 && r.dias_totales === 0) {
    return null
  }

  const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`)

  return (
    <div className={`rachas${compacta ? ' rachas--compacta' : ''}`}>
      <div className={`racha${r.leido_hoy ? ' racha--viva' : ''}`}>
        <span className="material-symbols-rounded racha__icono" aria-hidden="true">
          local_fire_department
        </span>
        <span className="racha__txt">
          <b className="racha__num">{dias(r.dias_leyendo)}</b>
          <span className="body-small racha__que">
            {r.dias_leyendo === 0
              ? 'Marca tu capítulo y empieza'
              : r.leido_hoy
                ? 'leyendo · hoy ya está'
                : 'leyendo · te falta hoy'}
          </span>
        </span>
      </div>

      <div className={`racha${r.hablado_hoy ? ' racha--viva' : ''}`}>
        <span className="material-symbols-rounded racha__icono" aria-hidden="true">
          forum
        </span>
        <span className="racha__txt">
          <b className="racha__num">{dias(r.dias_hablando)}</b>
          <span className="body-small racha__que">
            {r.dias_hablando === 0
              ? 'Di algo y empieza'
              : r.hablado_hoy
                ? 'hablando · hoy ya está'
                : 'hablando · te falta hoy'}
          </span>
        </span>
      </div>

      {r.mejor_leyendo > r.dias_leyendo && r.mejor_leyendo >= 3 && (
        <p className="body-small rachas__record">
          Tu récord son {dias(r.mejor_leyendo)} seguidos.
        </p>
      )}
    </div>
  )
}
