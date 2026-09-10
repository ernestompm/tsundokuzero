import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import { Avatar, BookCover } from './ui'
import './recommended.css'

interface Recomendada {
  id: string
  bookId: string
  title: string
  author: string
  cover: string | null
  note: string | null
  fromName: string
  fromUsername: string | null
  fromAvatar: string | null
}

/**
 * «Marina te recomienda este libro».
 *
 * Una recomendación no es un aviso que se lee y se olvida: es una tarea
 * pendiente. Por eso no desaparece al mirarla, sino cuando haces algo con
 * ella, que es o guardarla en tu estantería o decir que no.
 */
export default function RecommendedForYou({ compacta = false }: { compacta?: boolean }) {
  const { session } = useAuth()
  const [lista, setLista] = useState<Recomendada[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data: recs } = await supabase
      .from('recommendations')
      .select('id, book_id, note, from_user')
      .eq('to_user', session.user.id)
      .is('acted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
    const filas = recs ?? []
    if (filas.length === 0) {
      setLista([])
      return
    }
    const [{ data: libros }, { data: perfiles }] = await Promise.all([
      supabase
        .from('books')
        .select('id, title, author, cover_url')
        .in('id', filas.map((r) => r.book_id)),
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', filas.map((r) => r.from_user)),
    ])
    const libroPorId = new Map((libros ?? []).map((b) => [b.id, b]))
    const gentePorId = new Map((perfiles ?? []).map((p) => [p.id, p]))
    setLista(
      filas.flatMap((r) => {
        const b = libroPorId.get(r.book_id)
        if (!b) return []
        const q = gentePorId.get(r.from_user)
        return [
          {
            id: r.id,
            bookId: b.id,
            title: b.title,
            author: b.author,
            cover: b.cover_url,
            note: r.note,
            fromName: q?.display_name ?? 'Alguien',
            fromUsername: q?.username ?? null,
            fromAvatar: q?.avatar_url ?? null,
          },
        ]
      }),
    )
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (lista.length === 0) return null

  /** Marca la recomendación como atendida y, si toca, guarda el libro. */
  const responder = async (r: Recomendada, guardar: boolean) => {
    if (!session) return
    setBusy(r.id)
    setError(null)
    if (guardar) {
      const { error } = await supabase.rpc('add_book_smart', {
        p_title: r.title,
        p_author: r.author,
        p_status: 'want',
      })
      if (error) {
        setError(friendlyError(error, 'No se pudo guardar el libro.'))
        setBusy(null)
        return
      }
    }
    const { error } = await supabase
      .from('recommendations')
      .update({ acted_at: new Date().toISOString() })
      .eq('id', r.id)
    if (error) setError(friendlyError(error, 'No se pudo actualizar la recomendación.'))
    setBusy(null)
    await load()
  }

  return (
    <section className={`recomendadas${compacta ? ' recomendadas--compacta' : ''}`}>
      <h2 className="title-small recomendadas__titulo">
        Te han recomendado
        <span className="recomendadas__cuenta">{lista.length}</span>
      </h2>

      {error && (
        <p className="body-small recomendadas__error" role="alert">
          {error}
        </p>
      )}

      <div className="recomendadas__lista">
        {lista.map((r) => (
          <div key={r.id} className="recomendada">
            <Link to={`/book/${r.bookId}`} className="recomendada__portada">
              <BookCover title={r.title} author={r.author} coverUrl={r.cover} size="md" />
            </Link>
            <div className="recomendada__main">
              <span className="recomendada__quien">
                <Avatar name={r.fromName} url={r.fromAvatar} size={22} />
                <span className="body-small on-surface-variant">
                  {r.fromUsername ? (
                    <Link to={`/u/${r.fromUsername}`} className="recomendada__nombre">
                      {r.fromName}
                    </Link>
                  ) : (
                    r.fromName
                  )}{' '}
                  te lo recomienda
                </span>
              </span>

              <Link to={`/book/${r.bookId}`} className="recomendada__titulo">
                <span className="title-small serif">{r.title}</span>
              </Link>
              <span className="body-small on-surface-variant">{r.author}</span>

              {r.note && <p className="body-medium recomendada__nota">«{r.note}»</p>}

              <div className="recomendada__acciones">
                <md-filled-tonal-button
                  disabled={busy === r.id || undefined}
                  onClick={() => void responder(r, true)}
                >
                  <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
                    bookmark
                  </span>
                  Guardar para leer
                </md-filled-tonal-button>
                <md-text-button
                  disabled={busy === r.id || undefined}
                  onClick={() => void responder(r, false)}
                >
                  Ahora no
                </md-text-button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
