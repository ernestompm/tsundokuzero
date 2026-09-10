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
/** Recuerda durante la sesión que el servidor aún no está al día. */
const ESPERA_KEY = 'tz-novedades-espera'

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

    // UNA sola consulta. Antes eran siete, una por migración, y se
    // lanzaban en CADA carga de página mientras no se hubiera visto el
    // aviso: siete idas y venidas solo para decidir si enseñar algo.
    //
    // La fila del club sirve de testigo de casi todo lo que se anuncia:
    // `captain_mode` llegó con la 029, `next_book_id` con la 030,
    // `affiliate_tag` con la 032 y `emblem_url` con la 033. Si falta
    // cualquiera, PostgREST devuelve error y el aviso se calla.
    //
    // El resultado se recuerda durante la sesión de la pestaña, así que
    // navegar por la app no vuelve a preguntarlo.
    try {
      if (sessionStorage.getItem(ESPERA_KEY) === RELEASE_KEY) return
    } catch {
      /* navegador con el almacenamiento bloqueado: se pregunta y ya */
    }

    void (async () => {
      const { error } = await supabase
        .from('clubs')
        .select('id, captain_mode, next_book_id, affiliate_tag, emblem_url')
        .limit(1)
      if (cancelado) return
      if (error) {
        console.info('[tz] novedades en espera: faltan migraciones por ejecutar')
        try {
          sessionStorage.setItem(ESPERA_KEY, RELEASE_KEY)
        } catch {
          /* sin almacenamiento se vuelve a preguntar, tampoco pasa nada */
        }
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
