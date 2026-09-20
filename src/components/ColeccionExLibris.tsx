import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import { useModalBehavior } from './modal'
import ExLibris from './ExLibris'
import './coleccion.css'

interface Estampa {
  book_id: string
  title: string
  author: string
  cover_url: string | null
  terminado_el: string
  companeros: string[]
}

/**
 * La colección de ex libris (migr. 045).
 *
 * La primera versión ponía una estampa suelta en la ficha del libro, y
 * una estampa suelta no es nada: la ves una vez y se acabó. Lo que
 * engancha de un sello es la plancha llena y los huecos que quedan — por
 * eso la colección vive en tu perfil, junto a las insignias, y se ve de
 * un vistazo cuánto llevas.
 *
 * Cada una se abre a tamaño completo al tocarla, que es el momento en el
 * que se hace la captura para el grupo.
 */
export default function ColeccionExLibris({
  userId,
  ajeno = false,
}: {
  /** de quién; sin esto, la tuya */
  userId?: string
  /** cambia los textos: «su plancha», no «la tuya» */
  ajeno?: boolean
} = {}) {
  const { session } = useAuth()
  const [lista, setLista] = useState<Estampa[] | null>(null)
  const [abierta, setAbierta] = useState<Estampa | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sheetRef = useModalBehavior(abierta !== null, () => setAbierta(null))

  useEffect(() => {
    if (!session) return
    let cancelado = false
    const quien = userId ?? session.user.id
    void supabase
      .rpc('exlibris_de', { p_user: quien })
      .then(({ data, error: e }) => {
        if (cancelado) return
        // Antes se tragaba el error y salía el texto de «todavía no hay
        // ninguno», que es mentira cuando lo que pasa es que no se pudo
        // preguntar.
        if (e) {
          setError(
            /exlibris_de|schema cache/i.test(e.message)
              ? 'Falta ejecutar la migración 047 en Supabase.'
              : friendlyError(e, 'No se pudo cargar la colección.'),
          )
          setLista([])
          return
        }
        setLista((data as Estampa[] | null) ?? [])
      })
    return () => {
      cancelado = true
    }
  }, [session, userId])

  if (!lista) return null

  const anio = (iso: string) => new Date(iso).getFullYear()

  return (
    <>
      <div className="coleccion">
        {lista.map((e) => (
          <button
            key={e.book_id}
            type="button"
            className="sello"
            onClick={() => setAbierta(e)}
            aria-label={`Ex libris de ${e.title}`}
          >
            <span className="sello__marco">
              <span className="sello__titulo serif">{e.title}</span>
              <span className="sello__anio">{anio(e.terminado_el)}</span>
            </span>
          </button>
        ))}

        {/* Los huecos: lo que falta es lo que hace querer la siguiente */}
        {Array.from({ length: Math.max(0, 6 - lista.length) }, (_, i) => (
          <span key={`hueco-${i}`} className="sello sello--hueco" aria-hidden="true" />
        ))}
      </div>

      <p className="body-small coleccion__pie">
        {error ??
          (lista.length === 0
            ? ajeno
              ? 'Todavía no ha terminado ningún libro con el club.'
              : 'Termina un libro con el club y aquí quedará su estampa.'
            : lista.length === 1
              ? ajeno
                ? 'Un libro terminado.'
                : 'Un libro terminado. La plancha acaba de empezar.'
              : `${lista.length} libros terminados, cada uno con su estampa.`)}
      </p>

      {abierta && (
        <div className="tz-dialog-scrim" onClick={() => setAbierta(null)}>
          <div
            ref={sheetRef}
            className="coleccion__abierta"
            role="dialog"
            aria-modal="true"
            aria-label={`Ex libris de ${abierta.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExLibris
              title={abierta.title}
              author={abierta.author}
              finishedAt={abierta.terminado_el}
              companeros={abierta.companeros.map((n) => n.split(/\s+/)[0])}
            />
            <md-text-button onClick={() => setAbierta(null)}>Cerrar</md-text-button>
          </div>
        </div>
      )}
    </>
  )
}
