import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { AvatarStack } from './ui'
import { antiguedadEnPalabras, badgesDe, type MemberStats } from '../lib/badges'
import { BadgeDots } from './Badges'
import './clubstrip.css'

interface Actividad {
  ideas: number
  respuestas: number
  reacciones: number
  adelantos: { name: string; chapter: number }[]
}

interface Datos {
  nombre: string
  emblema: string | null
  color: string | null
  emblemaUrl: string | null
  miembros: number
  librosLeidos: number
  caras: { name: string; url?: string | null }[]
  desde: string | null
  misBadges: ReturnType<typeof badgesDe>
  actividad: Actividad
}

/** «Marina y Carlos» a partir de los nombres de pila. */
function nombres(lista: { name: string }[]) {
  const n = lista.map((a) => a.name.split(/\s+/)[0])
  if (n.length === 1) return n[0]
  if (n.length === 2) return `${n[0]} y ${n[1]}`
  return `${n[0]}, ${n[1]} y ${n.length - 2} más`
}

/**
 * Tira de pertenencia al club, en lo alto del Inicio.
 *
 * Hace dos cosas. La primera, que te acuerdes de que perteneces a un
 * grupo: emblema, nombre, caras y desde cuándo estás. La segunda, darte
 * una razón para entrar hoy: qué ha pasado desde la última vez que
 * miraste, y si alguien te ha adelantado en la lectura.
 *
 * Los contadores respetan el candado. Solo cuentan mensajes de capítulos
 * que ya has leído: decir «hay 30 mensajes nuevos» de un capítulo al que
 * no has llegado sería contarte que ahí pasa algo.
 */
export default function ClubStrip() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<Datos | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelado = false
    const load = async () => {
      const [{ data: resumen }, { data: club }, { data: act }] = await Promise.all([
        supabase
          .from('club_summary')
          .select('club_id, name, miembros, libros_leidos')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('clubs')
          .select('emblem, emblem_color, emblem_url')
          .order('created_at')
          .limit(1)
          .maybeSingle(),
        supabase.rpc('club_activity'),
      ])
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

      const a = act?.[0]
      setData({
        nombre: resumen.name,
        emblema: club?.emblem ?? null,
        color: club?.emblem_color ?? null,
        emblemaUrl: club?.emblem_url ?? null,
        miembros: resumen.miembros,
        librosLeidos: resumen.libros_leidos,
        caras: (perfiles ?? []).map((p) => ({ name: p.display_name, url: p.avatar_url })),
        desde: stats ? antiguedadEnPalabras(stats.joined_at) : null,
        misBadges: stats ? badgesDe(stats as MemberStats) : [],
        actividad: {
          ideas: a?.ideas_nuevas ?? 0,
          respuestas: a?.respuestas_nuevas ?? 0,
          reacciones: a?.reacciones_nuevas ?? 0,
          adelantos: a?.adelantos ?? [],
        },
      })
    }
    void load()
    return () => {
      cancelado = true
    }
  }, [session])

  if (!data) return null

  const { actividad: act } = data
  const hayActividad =
    act.ideas > 0 || act.respuestas > 0 || act.reacciones > 0 || act.adelantos.length > 0

  const total =
    act.ideas + act.respuestas + act.reacciones + act.adelantos.length

  return (
    <div className="clubstrip">
      <button
        type="button"
        className="clubstrip__fila clubstrip__club"
        onClick={() => navigate('/club')}
      >
        {data.emblemaUrl ? (
          <img className="clubstrip__emblema" src={data.emblemaUrl} alt="" aria-hidden="true" />
        ) : (
          <span
            className="clubstrip__emblema"
            aria-hidden="true"
            style={data.color ? { background: data.color } : undefined}
          >
            {data.emblema ?? '📖'}
          </span>
        )}

        <span className="clubstrip__izq">
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
        </span>

        <AvatarStack
          people={data.caras.slice(0, 4)}
          extra={Math.max(0, data.miembros - 4)}
        />
      </button>

      {hayActividad && (
        <button
          type="button"
          className="clubstrip__novedades"
          onClick={() => navigate('/nuevo')}
          aria-label={`Ver las ${total} novedades`}
        >
          <span className="clubstrip__actividad">
          {act.ideas > 0 && (
            <span className="clubstrip__pill">
              <span className="material-symbols-rounded" aria-hidden="true">forum</span>
              {act.ideas} {act.ideas === 1 ? 'idea nueva' : 'ideas nuevas'}
            </span>
          )}
          {act.respuestas > 0 && (
            <span className="clubstrip__pill">
              <span className="material-symbols-rounded" aria-hidden="true">chat_bubble</span>
              {act.respuestas}{' '}
              {act.respuestas === 1 ? 'respuesta para ti' : 'respuestas para ti'}
            </span>
          )}
          {act.reacciones > 0 && (
            <span className="clubstrip__pill">
              <span className="material-symbols-rounded" aria-hidden="true">
                local_fire_department
              </span>
              {act.reacciones}{' '}
              {act.reacciones === 1 ? 'reacción a lo tuyo' : 'reacciones a lo tuyo'}
            </span>
          )}
          {act.adelantos.length > 0 && (
            <span className="clubstrip__pill clubstrip__pill--alerta">
              <span className="material-symbols-rounded" aria-hidden="true">trending_up</span>
              {nombres(act.adelantos)}{' '}
              {act.adelantos.length === 1 ? 'te ha adelantado' : 'te han adelantado'}
            </span>
          )}
          </span>
          <span className="clubstrip__ver label-large">
            Ver lo nuevo
            <span className="material-symbols-rounded" aria-hidden="true">
              chevron_right
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
