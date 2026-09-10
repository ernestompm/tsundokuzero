import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '@material/web/button/outlined-button.js'
import { supabase } from '../../lib/supabase'
import { BookCover } from '../../components/ui'
import './nextread.css'

interface Proxima {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  buyUrl: string | null
  totalChapters: number
  startsAt: string | null
}

function cuando(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const dias = Math.ceil((d.getTime() - Date.now()) / 86400000)
  const fecha = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  if (dias <= 0) return 'Se empieza ya'
  if (dias === 1) return 'Se empieza mañana'
  if (dias <= 14) return `Se empieza en ${dias} días, el ${fecha}`
  return `Se empieza el ${fecha}`
}

/**
 * La próxima lectura del club: el libro ya elegido que todavía no se ha
 * abierto. Lo pidió un usuario en una reseña, y con razón: entre que se
 * cierra la votación y se empieza a leer hay que conseguir el libro, y
 * antes no había ni un sitio donde ver cuál era.
 *
 * No hay candado que valga aquí: es información pública del club, y el
 * objetivo justamente es que la gente lo vea con tiempo.
 */
export default function NextRead({ compacta = false }: { compacta?: boolean }) {
  const [data, setData] = useState<Proxima | null>(null)

  useEffect(() => {
    let cancelado = false
    const load = async () => {
      const { data: club } = await supabase
        .from('clubs')
        .select('next_book_id, next_starts_at')
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (!club?.next_book_id) {
        if (!cancelado) setData(null)
        return
      }
      const { data: b } = await supabase
        .from('books')
        .select('id, title, author, cover_url, buy_url, total_chapters')
        .eq('id', club.next_book_id)
        .maybeSingle()
      if (!b || cancelado) return
      setData({
        bookId: b.id,
        title: b.title,
        author: b.author,
        coverUrl: b.cover_url,
        buyUrl: b.buy_url,
        totalChapters: b.total_chapters,
        startsAt: club.next_starts_at,
      })
    }
    void load()
    return () => {
      cancelado = true
    }
  }, [])

  if (!data) return null

  const fecha = cuando(data.startsAt)

  return (
    <section className={`nextread${compacta ? ' nextread--compacta' : ''}`}>
      <span className="label-medium nextread__kicker">Próxima lectura</span>

      <div className="nextread__cuerpo">
        <Link to={`/book/${data.bookId}`} className="nextread__portada">
          <BookCover
            title={data.title}
            author={data.author}
            coverUrl={data.coverUrl}
            size={compacta ? 'md' : 'lg'}
          />
        </Link>

        <div className="nextread__info">
          <Link to={`/book/${data.bookId}`} className="nextread__titulo">
            <span className="title-medium serif">{data.title}</span>
          </Link>
          <span className="body-small on-surface-variant">{data.author}</span>
          <span className="body-small on-surface-variant">
            {fecha ?? 'Todavía sin fecha de comienzo'}
          </span>

          <p className="body-small nextread__aviso">
            Ve haciéndote con él para empezar a la vez que el resto.
          </p>

          {data.buyUrl && (
            <md-outlined-button
              onClick={() => window.open(data.buyUrl!, '_blank', 'noopener,noreferrer')}
            >
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
                shopping_bag
              </span>
              Conseguir el libro
            </md-outlined-button>
          )}
        </div>
      </div>
    </section>
  )
}
