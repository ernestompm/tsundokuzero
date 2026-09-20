import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
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
export default function ColeccionExLibris() {
  const { session } = useAuth()
  const [lista, setLista] = useState<Estampa[] | null>(null)
  const [abierta, setAbierta] = useState<Estampa | null>(null)

  const sheetRef = useModalBehavior(abierta !== null, () => setAbierta(null))

  useEffect(() => {
    if (!session) return
    let cancelado = false
    void supabase.rpc('mis_exlibris').then(({ data }) => {
      if (!cancelado) setLista((data as Estampa[] | null) ?? [])
    })
    return () => {
      cancelado = true
    }
  }, [session])

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
        {lista.length === 0
          ? 'Termina un libro con el club y aquí quedará su estampa.'
          : lista.length === 1
            ? 'Un libro terminado. La plancha acaba de empezar.'
            : `${lista.length} libros terminados, cada uno con su estampa.`}
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
