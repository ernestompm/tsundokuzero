import { useEffect, useState } from 'react'
import { clubActual } from '../lib/clubCache'
import './exlibris.css'

/**
 * El ex libris.
 *
 * Cuando terminas un libro con el club, aparece sin que lo pidas: una
 * estampa con el título, la fecha y con quién lo has leído. Como el sello
 * que la gente ponía en la primera página de sus libros para decir «este
 * pasó por mis manos».
 *
 * Es lo único de la app que no sirve para nada. Ese es el punto: terminar
 * un libro con cinco personas merece quedarse en algún sitio que no sea
 * una fila más del historial.
 */
export default function ExLibris({
  title,
  author,
  finishedAt,
  companeros,
}: {
  title: string
  author: string
  /** cuándo lo terminaste tú */
  finishedAt: string | null
  /** quién más lo terminó, por orden de llegada */
  companeros: string[]
}) {
  const [club, setClub] = useState<string | null>(null)

  useEffect(() => {
    void clubActual().then((c) => setClub(c?.name ?? null))
  }, [])

  const fecha = finishedAt
    ? new Date(finishedAt).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const nombres =
    companeros.length === 0
      ? null
      : companeros.length === 1
        ? companeros[0]
        : `${companeros.slice(0, -1).join(', ')} y ${companeros[companeros.length - 1]}`

  return (
    <figure className="exlibris" aria-label={`Ex libris de ${title}`}>
      <div className="exlibris__marco">
        <span className="exlibris__sello" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="40" height="40">
            {/* Un libro abierto, dibujado a línea como un grabado */}
            <path
              d="M24 13c-4-3-9-4-14-3v25c5-1 10 0 14 3 4-3 9-4 14-3V10c-5-1-10 0-14 3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M24 13v25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </span>

        <span className="exlibris__lema">Ex libris</span>

        <p className="exlibris__titulo serif">{title}</p>
        <p className="exlibris__autor">{author}</p>

        <span className="exlibris__filete" aria-hidden="true" />

        <p className="exlibris__pie">
          {nombres ? (
            <>
              Leído junto a <b>{nombres}</b>
              {club ? (
                <>
                  {' '}
                  en <b>{club}</b>
                </>
              ) : null}
            </>
          ) : club ? (
            <>
              Leído en <b>{club}</b>
            </>
          ) : (
            'Leído de principio a fin'
          )}
          {fecha ? <span className="exlibris__fecha">{fecha}</span> : null}
        </p>
      </div>
    </figure>
  )
}
