import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { AvatarStack } from './ui'
import { antiguedadEnPalabras, badgesDe, type MemberStats } from '../lib/badges'
import { BadgeDots } from './Badges'
import './clubstrip.css'

interface Datos {
  nombre: string
  miembros: number
  librosLeidos: number
  caras: { name: string; url?: string | null }[]
  desde: string | null
  misBadges: ReturnType<typeof badgesDe>
}

/**
 * Tira de pertenencia al club, en lo alto del Inicio.
 *
 * De la reseña de un usuario: «no se ve nada de tu pertenencia en la
 * primera parte». Tenía razón: podías abrir la app cada día sin que nada
 * te recordara que perteneces a un grupo. Esto pone delante el nombre del
 * club, las caras de la gente, cuánto lleváis leyendo juntos y desde
 * cuándo estás tú.
 */
export default function ClubStrip() {
  const { session } = useAuth()
  const [data, setData] = useState<Datos | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelado = false
    const load = async () => {
      const { data: resumen } = await supabase
        .from('club_summary')
        .select('club_id, name, miembros, libros_leidos')
        .limit(1)
        .maybeSingle()
      if (!resumen || cancelado) return

      const [{ data: miembros }, { data: stats }] = await Promise.all([
        supabase.from('club_members').select('user_id').eq('club_id', resumen.club_id).limit(8),
        supabase
          .from('club_member_stats')
          .select('*')
          .eq('club_id', resumen.club_id)
          .eq('user_id', session.user.id)
          .maybeSingle(),
      ])
      const ids = (miembros ?? []).map((m) => m.user_id)
      const { data: perfiles } = ids.length
        ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
        : { data: [] }
      if (cancelado) return

      setData({
        nombre: resumen.name,
        miembros: resumen.miembros,
        librosLeidos: resumen.libros_leidos,
        caras: (perfiles ?? []).map((p) => ({ name: p.display_name, url: p.avatar_url })),
        desde: stats ? antiguedadEnPalabras(stats.joined_at) : null,
        misBadges: stats ? badgesDe(stats as MemberStats) : [],
      })
    }
    void load()
    return () => {
      cancelado = true
    }
  }, [session])

  if (!data) return null

  return (
    <Link to="/club" className="clubstrip">
      <div className="clubstrip__izq">
        <span className="label-medium clubstrip__kicker">Tu club</span>
        <span className="title-medium serif clubstrip__nombre">
          {data.nombre}
          <BadgeDots badges={data.misBadges} max={3} />
        </span>
        <span className="body-small clubstrip__datos">
          {data.miembros} {data.miembros === 1 ? 'lector' : 'lectores'}
          {data.librosLeidos > 0 &&
            ` · ${data.librosLeidos} ${data.librosLeidos === 1 ? 'libro' : 'libros'} juntos`}
          {data.desde ? ` · tú ${data.desde}` : ''}
        </span>
      </div>
      <AvatarStack
        people={data.caras.slice(0, 4)}
        extra={Math.max(0, data.miembros - 4)}
      />
    </Link>
  )
}
