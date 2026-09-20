import { useCallback, useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import './insignias.css'

/** Solo estos: la app no sabe pintar otros (scripts/icons.txt). */
const ICONOS = [
  'star', 'local_fire_department', 'auto_stories', 'menu_book', 'bookmark',
  'forum', 'chat_bubble', 'how_to_vote', 'group', 'trending_up',
  'travel_explore', 'lock_open', 'check_circle', 'flag',
]

type Tono = 'oro' | 'salvia' | 'tierra'

const TONOS: { id: Tono; label: string }[] = [
  { id: 'oro', label: 'Oro' },
  { id: 'salvia', label: 'Salvia' },
  { id: 'tierra', label: 'Tierra' },
]

interface Fila {
  id: string
  nombre: string
  detalle: string
  icon: string
  tono: Tono
  cuantos: number
  la_tengo: boolean
  mi_motivo: string | null
  quien: string[]
}

interface Persona {
  id: string
  username: string
  display_name: string
}

/**
 * Crear insignias y repartirlas (migr. 046).
 *
 * Las automáticas premian lo que se puede contar. Estas son para lo que
 * no: quien se leyó el libro en dos días y no dijo ni media palabra para
 * no destriparlo, quien trajo la lectura del año, quien aguantó el tostón
 * hasta el final por no dejar a nadie tirado.
 *
 * El motivo se escribe y se ve en su perfil. Una insignia sin motivo es
 * una pegatina; con motivo es que alguien se fijó.
 */
export default function InsigniasTab() {
  const [lista, setLista] = useState<Fila[] | null>(null)
  const [gente, setGente] = useState<Persona[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [nombre, setNombre] = useState('')
  const [detalle, setDetalle] = useState('')
  const [icon, setIcon] = useState('star')
  const [tono, setTono] = useState<Tono>('oro')

  const [dando, setDando] = useState<string | null>(null)
  const [aQuien, setAQuien] = useState('')
  const [motivo, setMotivo] = useState('')

  const load = useCallback(async () => {
    const [{ data: ins, error: e1 }, { data: users }] = await Promise.all([
      supabase.rpc('insignias_a_mano'),
      supabase.rpc('admin_list_users'),
    ])
    if (e1) {
      setError(
        /insignias_a_mano|schema cache/i.test(e1.message)
          ? 'Falta ejecutar la migración 046 (insignias a mano).'
          : friendlyError(e1, 'No se pudieron cargar las insignias.'),
      )
      setLista([])
      return
    }
    setLista((ins as Fila[] | null) ?? [])
    setGente((users as Persona[] | null) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const crear = async () => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_crear_insignia', {
      p_nombre: nombre.trim(),
      p_detalle: detalle.trim(),
      p_icon: icon,
      p_tono: tono,
    })
    setBusy(false)
    if (e) {
      setError(friendlyError(e, 'No se pudo crear la insignia.'))
      return
    }
    setNombre('')
    setDetalle('')
    setError(null)
    await load()
  }

  const dar = async (insignia: string) => {
    if (!aQuien) return
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_dar_insignia', {
      p_insignia: insignia,
      p_user: aQuien,
      p_motivo: motivo.trim() || null,
    })
    setBusy(false)
    if (e) {
      setError(friendlyError(e, 'No se pudo dar la insignia.'))
      return
    }
    setDando(null)
    setAQuien('')
    setMotivo('')
    setError(null)
    await load()
  }

  const borrar = async (id: string) => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_borrar_insignia', { p_id: id })
    setBusy(false)
    if (e) setError(friendlyError(e, 'No se pudo borrar.'))
    else await load()
  }

  if (lista === null) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}

      {/* ---------- Inventar una ---------- */}
      <div className="admin-card">
        <span className="label-medium">Inventar una insignia</span>
        <p className="body-small on-surface-variant" style={{ margin: '4px 0 10px' }}>
          Para lo que ningún contador va a ver nunca. El nombre es lo que se
          presume; el detalle explica por qué existe.
        </p>

        <div className="admin-book__row">
          <input
            className="tz-input admin-input body-medium"
            placeholder="Nombre, p. ej. «Sin destripar nada»"
            aria-label="Nombre de la insignia"
            maxLength={40}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="admin-book__row">
          <input
            className="tz-input admin-input body-medium"
            placeholder="Qué significa, en una frase"
            aria-label="Qué significa la insignia"
            maxLength={120}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </div>

        <div className="insig-iconos" role="radiogroup" aria-label="Icono">
          {ICONOS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={icon === i}
              aria-label={i}
              className={`insig-icono${icon === i ? ' activo' : ''}`}
              onClick={() => setIcon(i)}
            >
              <span className="material-symbols-rounded" aria-hidden="true">{i}</span>
            </button>
          ))}
        </div>

        <div className="insig-tonos" role="radiogroup" aria-label="Tono">
          {TONOS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tono === t.id}
              className={`insig-tono insig-tono--${t.id}${tono === t.id ? ' activo' : ''}`}
              onClick={() => setTono(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Cómo va a quedar, antes de crearla */}
        <div className={`insig-muestra insig-muestra--${tono}`}>
          <span className="insig-muestra__icono">
            <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
          </span>
          <span className="insig-muestra__txt">
            <span className="title-small">{nombre.trim() || 'Nombre de la insignia'}</span>
            <span className="body-small on-surface-variant">
              {detalle.trim() || 'Qué significa, en una frase'}
            </span>
          </span>
        </div>

        <div className="club-poll__form-actions">
          <md-filled-button
            disabled={!nombre.trim() || !detalle.trim() || busy || undefined}
            onClick={() => void crear()}
          >
            Crear insignia
          </md-filled-button>
        </div>
      </div>

      {/* ---------- Las que hay ---------- */}
      {lista.length === 0 && (
        <p className="body-medium on-surface-variant">
          Todavía no has inventado ninguna. Las automáticas siguen su curso.
        </p>
      )}

      {lista.map((b) => (
        <div key={b.id} className="admin-card">
          <div className={`insig-muestra insig-muestra--${b.tono}`}>
            <span className="insig-muestra__icono">
              <span className="material-symbols-rounded" aria-hidden="true">{b.icon}</span>
            </span>
            <span className="insig-muestra__txt">
              <span className="title-small">{b.nombre}</span>
              <span className="body-small on-surface-variant">{b.detalle}</span>
              <span className="body-small insig-quien">
                {b.cuantos === 0
                  ? 'Sin repartir todavía'
                  : `La tienen: ${b.quien.join(', ')}`}
              </span>
            </span>
            <button
              className="admin-danger"
              aria-label={`Borrar ${b.nombre}`}
              title="Borrar"
              disabled={busy}
              onClick={() => void borrar(b.id)}
            >
              <span className="material-symbols-rounded" aria-hidden="true">delete</span>
            </button>
          </div>

          {dando === b.id ? (
            <>
              <div className="admin-book__row" style={{ marginTop: 12 }}>
                <select
                  className="tz-input admin-input body-medium"
                  aria-label="A quién se la das"
                  value={aQuien}
                  onChange={(e) => setAQuien(e.target.value)}
                >
                  <option value="">Elige a quién…</option>
                  {gente.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} · @{u.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-book__row">
                <input
                  className="tz-input admin-input body-medium"
                  placeholder="Por qué se la das — lo va a leer"
                  aria-label="Motivo"
                  maxLength={200}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div className="club-poll__form-actions">
                <md-text-button onClick={() => setDando(null)}>Cancelar</md-text-button>
                <md-filled-button
                  disabled={!aQuien || busy || undefined}
                  onClick={() => void dar(b.id)}
                >
                  Dársela
                </md-filled-button>
              </div>
            </>
          ) : (
            <div className="club-poll__form-actions">
              <md-outlined-button onClick={() => setDando(b.id)}>
                Dar esta insignia
              </md-outlined-button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
