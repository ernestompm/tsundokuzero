import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { Avatar, Chip } from '../../components/ui'
import type { Club } from '../../lib/database.types'
import './captain.css'

type Modo = 'manual' | 'random' | 'rotation'
type Duracion = 'time' | 'book'
type Unidad = 'day' | 'month' | 'year'

interface Miembro {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  role: string
}

const MODOS: { key: Modo; label: string; explica: string }[] = [
  {
    key: 'manual',
    label: 'A mano',
    explica: 'Lo decides tú o el capitán de turno. Nadie cambia si no lo cambias.',
  },
  {
    key: 'random',
    label: 'Al azar',
    explica:
      'Le toca a alguien al azar cuando acaba el mandato, sin repetir hasta que hayan pasado todos.',
  },
  {
    key: 'rotation',
    label: 'Por turno',
    explica: 'Rota en el orden en que entrasteis al club. Siempre se sabe a quién le toca.',
  },
]

const UNIDADES: { key: Unidad; uno: string; varios: string }[] = [
  { key: 'day', uno: 'día', varios: 'días' },
  { key: 'month', uno: 'mes', varios: 'meses' },
  { key: 'year', uno: 'año', varios: 'años' },
]

function fecha(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Reparto de la capitanía (migr. 029). Tres modos y dos formas de medir
 * el mandato: por tiempo o por libro, con un tope de días para que un
 * libro eterno no deje al club sin relevo.
 *
 * El relevo automático no necesita planificador: se comprueba al abrir
 * el club con `rotate_captain_if_due`.
 */
export default function CaptainCard({
  club,
  members,
  onChanged,
}: {
  club: Club
  members: Miembro[]
  onChanged: () => void
}) {
  const [modo, setModo] = useState<Modo>(club.captain_mode ?? 'manual')
  const [duracion, setDuracion] = useState<Duracion>(club.captain_term ?? 'book')
  const [unidad, setUnidad] = useState<Unidad>(club.captain_term_unit ?? 'month')
  const [cuantos, setCuantos] = useState(String(club.captain_term_count ?? 1))
  const [maxDias, setMaxDias] = useState(
    club.captain_max_days != null ? String(club.captain_max_days) : '',
  )
  const [siguiente, setSiguiente] = useState<Miembro | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const capitan = members.find((m) => m.role === 'captain') ?? null

  // A quién le tocaría después, según el modo guardado
  useEffect(() => {
    if (club.captain_mode === 'manual') {
      setSiguiente(null)
      return
    }
    supabase
      .rpc('next_captain_id', { p_club: club.id })
      .then(({ data }) =>
        setSiguiente(data ? (members.find((m) => m.id === data) ?? null) : null),
      )
  }, [club.id, club.captain_mode, members])

  const guardar = async () => {
    const n = parseInt(cuantos, 10)
    if (duracion === 'time' && (!Number.isFinite(n) || n < 1 || n > 60)) {
      setError('La duración debe estar entre 1 y 60.')
      return
    }
    const tope = maxDias.trim() ? parseInt(maxDias, 10) : null
    if (tope !== null && (!Number.isFinite(tope) || tope < 1 || tope > 3650)) {
      setError('El máximo de días debe estar entre 1 y 3650.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('set_captain_policy', {
      p_mode: modo,
      p_term: duracion,
      p_unit: unidad,
      p_count: Number.isFinite(n) ? n : 1,
      p_max_days: duracion === 'book' ? tope : null,
    })
    if (error) setError(friendlyError(error, 'No se pudo guardar la política de capitanía.'))
    else setMsg('Guardado. Así se reparte la capitanía a partir de ahora.')
    setBusy(false)
    onChanged()
  }

  const asignar = async (userId: string) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('set_captain', { p_user: userId })
    if (error) setError(friendlyError(error, 'No se pudo cambiar el capitán.'))
    else setMsg('Hecho. El club ya tiene el aviso del relevo.')
    setBusy(false)
    onChanged()
  }

  const cambiado =
    modo !== club.captain_mode ||
    duracion !== club.captain_term ||
    unidad !== club.captain_term_unit ||
    parseInt(cuantos, 10) !== club.captain_term_count ||
    (maxDias.trim() ? parseInt(maxDias, 10) : null) !== club.captain_max_days

  const finMandato = fecha(club.captain_term_ends_at)

  return (
    <div className="manage-card capcard">
      <h2 className="title-small manage-card__title">Capitanía</h2>

      <div className="capcard__ahora">
        {capitan ? (
          <>
            <Avatar name={capitan.display_name} url={capitan.avatar_url} size={40} />
            <span className="capcard__ahora-txt">
              <span className="body-medium">
                Ahora manda <b>{capitan.display_name}</b>
              </span>
              <span className="body-small on-surface-variant">
                {club.captain_term === 'book'
                  ? finMandato
                    ? `Hasta que cierre el libro, y como muy tarde el ${finMandato}`
                    : 'Hasta que cierre el libro'
                  : finMandato
                    ? `Hasta el ${finMandato}`
                    : 'Sin fecha de fin'}
              </span>
            </span>
          </>
        ) : (
          <span className="body-medium on-surface-variant">
            El club no tiene capitán ahora mismo.
          </span>
        )}
      </div>

      {siguiente && (
        <p className="body-small capcard__siguiente">
          Después le toca a <b>{siguiente.display_name}</b>.
        </p>
      )}

      {/* ---- Modo ---- */}
      <p className="label-medium capcard__lab">Cómo se reparte</p>
      <div className="capcard__chips">
        {MODOS.map((m) => (
          <Chip key={m.key} active={modo === m.key} onClick={() => setModo(m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>
      <p className="body-small on-surface-variant capcard__explica">
        {MODOS.find((m) => m.key === modo)!.explica}
      </p>

      {/* ---- Duración ---- */}
      <p className="label-medium capcard__lab">Cuánto dura el mandato</p>
      <div className="capcard__chips">
        <Chip active={duracion === 'book'} onClick={() => setDuracion('book')}>
          Un libro
        </Chip>
        <Chip active={duracion === 'time'} onClick={() => setDuracion('time')}>
          Por tiempo
        </Chip>
      </div>

      {duracion === 'time' ? (
        <div className="capcard__fila">
          <input
            className="tz-input body-medium capcard__num"
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            aria-label="Duración del mandato"
            value={cuantos}
            onChange={(e) => setCuantos(e.target.value)}
          />
          <div className="capcard__chips">
            {UNIDADES.map((u) => (
              <Chip key={u.key} active={unidad === u.key} onClick={() => setUnidad(u.key)}>
                {parseInt(cuantos, 10) === 1 ? u.uno : u.varios}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <label className="label-medium capcard__campo">
          Máximo de días con el mismo libro
          <input
            className="tz-input body-medium capcard__num"
            type="number"
            min={1}
            max={3650}
            inputMode="numeric"
            placeholder="Sin tope"
            value={maxDias}
            onChange={(e) => setMaxDias(e.target.value)}
          />
          <span className="body-small on-surface-variant">
            Si el libro sigue abierto pasado ese plazo, se cierra solo y entra el
            capitán siguiente. Déjalo vacío para no poner límite.
          </span>
        </label>
      )}

      <div className="capcard__acciones">
        <md-filled-button disabled={busy || !cambiado || undefined} onClick={() => void guardar()}>
          Guardar
        </md-filled-button>
      </div>

      {/* ---- Asignación a mano, siempre disponible ---- */}
      <p className="label-medium capcard__lab">Nombrar capitán ahora</p>
      <p className="body-small on-surface-variant capcard__explica">
        Vale con cualquier modo: sirve para arrancar, para saltarte un turno o
        para cuando alguien no puede.
      </p>
      <div className="capcard__gente">
        {members.map((m) => (
          <div key={m.id} className="capcard__persona">
            <Avatar name={m.display_name} url={m.avatar_url} size={34} />
            <span className="capcard__persona-txt">
              <span className="title-small">{m.display_name}</span>
              <span className="body-small on-surface-variant">@{m.username}</span>
            </span>
            {m.role === 'captain' ? (
              <span className="label-small capcard__insignia">capitán</span>
            ) : (
              <md-outlined-button
                disabled={busy || undefined}
                onClick={() => void asignar(m.id)}
              >
                Nombrar
              </md-outlined-button>
            )}
          </div>
        ))}
      </div>

      {msg && (
        <p className="body-small capcard__ok" role="status">
          {msg}
        </p>
      )}
      {error && (
        <p className="body-small capcard__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
