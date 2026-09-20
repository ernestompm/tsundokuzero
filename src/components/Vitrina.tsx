import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import {
  catalogoConProgreso,
  faltaPara,
  pctBadge,
  type BadgeMeta,
} from '../lib/badgeCatalog'
import type { MemberStats, Rachas } from '../lib/badges'
import './vitrina.css'

/** Una insignia dada a mano por el administrador (migr. 046). */
interface AMano {
  id: string
  nombre: string
  detalle: string
  icon: string
  tono: 'oro' | 'salvia' | 'tierra'
  cuantos: number
  la_tengo: boolean
  mi_motivo: string | null
  quien: string[]
}

/**
 * La vitrina.
 *
 * La versión anterior enseñaba solo lo conseguido, y eso no hace que
 * nadie quiera nada: para querer una insignia hay que VERLA, saber cuánto
 * te falta y ver que otros la tienen. Aquí están las tres cosas.
 *
 * Lo que está a punto de caer va primero, porque es donde hay que mirar.
 * Y las que te ha dado Ernesto a mano van en su propia balda: valen
 * precisamente porque alguien decidió dártelas.
 */
export default function Vitrina({
  stats,
  rachas,
  /** cuánta gente del club tiene cada insignia automática */
  cuantosPorBadge,
}: {
  stats: MemberStats
  rachas?: Rachas | null
  cuantosPorBadge?: Map<string, number>
}) {
  const { session } = useAuth()
  const [aMano, setAMano] = useState<AMano[]>([])

  useEffect(() => {
    if (!session) return
    let cancelado = false
    void supabase.rpc('insignias_a_mano').then(({ data }) => {
      if (!cancelado) setAMano((data as AMano[] | null) ?? [])
    })
    return () => {
      cancelado = true
    }
  }, [session])

  const catalogo = catalogoConProgreso(stats, rachas)
  const conseguidas = catalogo.filter((b) => b.conseguida)
  const enJuego = catalogo.filter((b) => !b.conseguida)

  const tarjeta = (b: BadgeMeta) => {
    const pct = pctBadge(b)
    const cuantos = cuantosPorBadge?.get(b.id)
    return (
      <div
        key={b.id}
        className={`vit-card vit-card--${b.tono}${b.conseguida ? ' conseguida' : ''}`}
      >
        <span className="vit-card__icono">
          <span className="material-symbols-rounded" aria-hidden="true">
            {b.conseguida ? b.icon : 'lock'}
          </span>
        </span>

        <div className="vit-card__txt">
          <span className="title-small vit-card__nombre">{b.nombre}</span>
          <span className="body-small vit-card__detalle">{b.detalle}</span>

          {!b.conseguida && (
            <>
              <span className="vit-barra" aria-hidden="true">
                <span className="vit-barra__fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="label-small vit-card__falta">{faltaPara(b)}</span>
            </>
          )}

          {b.conseguida && cuantos != null && (
            <span className="label-small vit-card__rareza">
              {cuantos === 1
                ? 'Eres el único del club que la tiene'
                : `La tenéis ${cuantos} del club`}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="vitrina">
      {enJuego.length > 0 && (
        <>
          <p className="tz-kicker vitrina__balda">A un paso</p>
          <div className="vitrina__lista">{enJuego.slice(0, 6).map(tarjeta)}</div>
        </>
      )}

      {conseguidas.length > 0 && (
        <>
          <p className="tz-kicker vitrina__balda">
            Conseguidas · {conseguidas.length}
          </p>
          <div className="vitrina__lista">{conseguidas.map(tarjeta)}</div>
        </>
      )}

      {aMano.length > 0 && (
        <>
          <p className="tz-kicker vitrina__balda">De la casa</p>
          <p className="body-small vitrina__nota">
            Estas no las da ningún contador: las reparte Ernesto a mano.
          </p>
          <div className="vitrina__lista">
            {aMano.map((b) => (
              <div
                key={b.id}
                className={`vit-card vit-card--${b.tono} vit-card--mano${
                  b.la_tengo ? ' conseguida' : ''
                }`}
              >
                <span className="vit-card__icono">
                  <span className="material-symbols-rounded" aria-hidden="true">
                    {b.la_tengo ? b.icon : 'lock'}
                  </span>
                </span>
                <div className="vit-card__txt">
                  <span className="title-small vit-card__nombre">{b.nombre}</span>
                  <span className="body-small vit-card__detalle">{b.detalle}</span>
                  {b.la_tengo && b.mi_motivo && (
                    <span className="body-small vit-card__motivo">
                      «{b.mi_motivo}»
                    </span>
                  )}
                  <span className="label-small vit-card__rareza">
                    {b.cuantos === 0
                      ? 'Todavía no la tiene nadie'
                      : b.cuantos === 1
                        ? `La tiene ${b.quien[0]}`
                        : `La tienen ${b.cuantos} personas`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
