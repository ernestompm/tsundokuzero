import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import { supabase } from '../lib/supabase'
import {
  NOVEDADES,
  RELEASE_ENTRADA,
  RELEASE_KEY,
  RELEASE_TITULO,
} from '../lib/release'
import { useModalBehavior } from './modal'
import './releasenotes.css'

const STORAGE_KEY = 'tz-novedades-vistas'

/** ¿Ya vio esta persona las novedades de esta versión en este aparato? */
function yaVisto(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === RELEASE_KEY
  } catch {
    // Navegador con almacenamiento bloqueado: mejor no molestar
    return true
  }
}

function marcarVisto() {
  try {
    localStorage.setItem(STORAGE_KEY, RELEASE_KEY)
  } catch {
    /* sin almacenamiento no se puede recordar; se cierra igual */
  }
}

/**
 * Aviso de novedades al entrar. Se enseña una vez por versión y aparato.
 *
 * COMPROBACIÓN IMPORTANTE: no se anuncia nada que no esté funcionando de
 * verdad. Las novedades dependen de migraciones que se ejecutan a mano en
 * la base de datos, así que antes de abrirse comprueba las tres, leyendo
 * una columna testigo de cada una. Si falta alguna, el aviso no aparece
 * ni se marca como visto, y saldrá solo el día que el servidor esté al
 * día.
 */
export default function ReleaseNotes({
  forceOpen = false,
  onClose,
}: {
  /** abierto a mano desde el pie del menú, saltándose el «ya visto» */
  forceOpen?: boolean
  onClose?: () => void
}) {
  const [open, setOpen] = useState(false)

  const cerrar = () => {
    marcarVisto()
    setOpen(false)
    onClose?.()
  }

  const ref = useModalBehavior(open, cerrar)

  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      return
    }
    if (yaVisto()) return
    let cancelado = false

    // Se comprueban las TRES migraciones que sostienen lo que se anuncia,
    // una columna testigo de cada una. Si falta cualquiera, PostgREST
    // devuelve error y el aviso no aparece. Que salga el aviso es, en sí
    // mismo, la prueba de que todo lo que cuenta funciona de verdad.
    void (async () => {
      const [m027, m028, m029, m030] = await Promise.all([
        supabase.from('books').select('id, chapters_confirmed').limit(1),
        supabase.from('club_readings').select('id, kind').limit(1),
        supabase.from('clubs').select('id, captain_mode, next_book_id').limit(1),
        supabase.from('club_summary').select('club_id').limit(1),
      ])
      if (cancelado) return
      if (m027.error || m028.error || m029.error || m030.error) {
        console.info('[tz] novedades en espera: faltan migraciones por ejecutar')
        return
      }
      setOpen(true)
    })()

    return () => {
      cancelado = true
    }
  }, [forceOpen])

  if (!open) return null

  return (
    <div className="sheet-scrim" role="presentation" onClick={cerrar}>
      <div
        ref={ref}
        className="sheet relnotes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relnotes-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" aria-hidden />

        <header className="relnotes__head">
          <span className="label-medium relnotes__version">
            Novedades · v{RELEASE_KEY}
          </span>
          <h2 id="relnotes-titulo" className="headline-small serif">
            {RELEASE_TITULO}
          </h2>
          <p className="body-medium on-surface-variant">{RELEASE_ENTRADA}</p>
        </header>

        <ul className="relnotes__lista">
          {NOVEDADES.map((n) => (
            <li key={n.titulo} className="relnotes__item">
              <span className="relnotes__icon" aria-hidden="true">
                <span className="material-symbols-rounded">{n.icon}</span>
              </span>
              <div className="relnotes__texto">
                <h3 className="title-small">{n.titulo}</h3>
                <p className="body-medium on-surface-variant">{n.texto}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relnotes__pie">
          <md-filled-button onClick={cerrar}>A leer</md-filled-button>
        </div>
      </div>
    </div>
  )
}
