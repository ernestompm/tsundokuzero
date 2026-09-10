import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import './mentions.css'

interface Espera {
  book_id: string
  book_title: string
  chapter_number: number
  my_chapter: number
  total_chapters: number
  cuantas: number
  quien: string | null
}

/**
 * «Marina te mencionó en el capítulo 40. Te faltan 28.»
 *
 * El recordatorio de que alguien pensó en ti unos capítulos más adelante.
 * Dice QUIÉN y DÓNDE, nunca qué: eso sigue sellado hasta que llegues. Es,
 * probablemente, la mejor razón que da esta app para seguir leyendo esta
 * noche.
 *
 * `bookId` lo limita a un libro (ficha del libro); sin él sale todo.
 */
export default function MentionsWaiting({ bookId }: { bookId?: string }) {
  const { session } = useAuth()
  const [lista, setLista] = useState<Espera[]>([])

  useEffect(() => {
    if (!session) return
    let cancelado = false
    supabase.rpc('pending_mentions').then(({ data }) => {
      if (cancelado) return
      const filas = (data as Espera[] | null) ?? []
      setLista(bookId ? filas.filter((f) => f.book_id === bookId) : filas)
    })
    return () => {
      cancelado = true
    }
  }, [session, bookId])

  if (lista.length === 0) return null

  return (
    <>
      {lista.map((e) => {
        const faltan = Math.max(0, e.chapter_number - e.my_chapter)
        return (
          <Link key={e.book_id} to={`/book/${e.book_id}`} className="mencion-espera">
            <span className="material-symbols-rounded" aria-hidden="true">
              lock
            </span>
            <span className="mencion-espera__txt">
              <span className="body-medium">
                {e.quien ? <b>{e.quien.split(/\s+/)[0]}</b> : 'Alguien'}
                {e.cuantas > 1 ? ` y otros te han mencionado ${e.cuantas} veces` : ' te ha mencionado'}{' '}
                en el capítulo <b>{e.chapter_number}</b>
                {!bookId && ` de ${e.book_title}`}.
              </span>
              <span className="body-small">
                {faltan === 0
                  ? 'Ya puedes leerlo: marca tu progreso.'
                  : faltan === 1
                    ? 'Te falta un capítulo para poder leerlo.'
                    : `Te faltan ${faltan} capítulos para poder leerlo.`}
              </span>
            </span>
            <span className="material-symbols-rounded" aria-hidden="true">
              chevron_right
            </span>
          </Link>
        )
      })}
    </>
  )
}
