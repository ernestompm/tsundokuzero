import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { BookCover } from '../../components/ui'
import Stars from '../../components/Stars'
import type { Author, Book } from '../../lib/database.types'
import './author.css'

interface BookWithRating extends Book {
  avg: number | null
  count: number
}

export default function AuthorPage() {
  const { authorId } = useParams()
  const { isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [author, setAuthor] = useState<Author | null | 'missing'>(null)
  const [books, setBooks] = useState<BookWithRating[]>([])
  const [editing, setEditing] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [nationalityDraft, setNationalityDraft] = useState('')
  const [birthDraft, setBirthDraft] = useState('')
  const [webDraft, setWebDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!authorId) return
    const { data: a } = await supabase
      .from('authors')
      .select('*')
      .eq('id', authorId)
      .maybeSingle()
    if (!a) {
      setAuthor('missing')
      return
    }
    setAuthor(a)

    const { data: bookRows } = await supabase
      .from('books')
      .select('*')
      .eq('author_id', a.id)
      .order('title')
    const list = bookRows ?? []
    const { data: ratings } = list.length
      ? await supabase
          .from('book_ratings')
          .select('book_id, rating')
          .in('book_id', list.map((b) => b.id))
      : { data: [] }
    const byBook = new Map<string, number[]>()
    for (const r of ratings ?? []) {
      const arr = byBook.get(r.book_id) ?? []
      arr.push(r.rating)
      byBook.set(r.book_id, arr)
    }
    setBooks(
      list.map((b) => {
        const rs = byBook.get(b.id) ?? []
        return {
          ...b,
          avg: rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : null,
          count: rs.length,
        }
      }),
    )
  }, [authorId])

  useEffect(() => {
    void load()
  }, [load])

  if (author === 'missing') {
    return (
      <section style={{ textAlign: 'center', padding: 48 }}>
        <p className="body-large">Este autor no está en el catálogo.</p>
      </section>
    )
  }

  if (!author) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const startEdit = () => {
    setBioDraft(author.bio ?? '')
    setNationalityDraft(author.nationality ?? '')
    setBirthDraft(author.birth_year?.toString() ?? '')
    setWebDraft(author.website ?? '')
    setEditing(true)
  }

  const saveEdit = async () => {
    setBusy(true)
    await supabase
      .from('authors')
      .update({
        bio: bioDraft.trim() || null,
        nationality: nationalityDraft.trim() || null,
        birth_year: birthDraft.trim() ? Number(birthDraft) : null,
        website: webDraft.trim() || null,
      })
      .eq('id', author.id)
    setBusy(false)
    setEditing(false)
    await load()
  }

  const context = [
    author.nationality,
    author.birth_year ? `n. ${author.birth_year}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="author">
      <header className="author-head">
        <span className="author-head__initial serif" aria-hidden>
          {author.name[0]}
        </span>
        <h1 className="headline-medium serif">{author.name}</h1>
        {context && (
          <p className="body-medium on-surface-variant">{context}</p>
        )}
        {author.website && (
          <a
            className="label-large author-web"
            href={author.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sitio web
          </a>
        )}
      </header>

      {editing ? (
        <div className="author-edit">
          <textarea
            className="profile-input body-medium"
            rows={5}
            placeholder="Biografía del autor…"
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
          />
          <div className="author-edit__row">
            <input
              className="profile-input body-medium"
              placeholder="Nacionalidad"
              value={nationalityDraft}
              onChange={(e) => setNationalityDraft(e.target.value)}
            />
            <input
              className="profile-input body-medium"
              placeholder="Año de nacimiento"
              inputMode="numeric"
              value={birthDraft}
              onChange={(e) => setBirthDraft(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <input
            className="profile-input body-medium"
            placeholder="Sitio web (https://…)"
            value={webDraft}
            onChange={(e) => setWebDraft(e.target.value)}
          />
          <div className="author-edit__actions">
            <md-text-button onClick={() => setEditing(false)}>
              Cancelar
            </md-text-button>
            <md-filled-button disabled={busy || undefined} onClick={() => void saveEdit()}>
              Guardar
            </md-filled-button>
          </div>
        </div>
      ) : (
        <>
          {author.bio ? (
            <p className="body-medium author-bio">{author.bio}</p>
          ) : (
            <p className="body-medium on-surface-variant author-bio">
              Aún no hay biografía de este autor.
            </p>
          )}
          {isSuperAdmin && (
            <md-text-button onClick={startEdit}>
              Editar ficha del autor
            </md-text-button>
          )}
        </>
      )}

      <h2 className="title-small author-sec">Sus libros en Tsundoku</h2>
      <div className="author-books">
        {books.map((b) => (
          <button
            key={b.id}
            className="author-book"
            onClick={() => navigate(`/book/${b.id}`)}
          >
            <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="lg" />
            <span className="label-medium author-book__title">{b.title}</span>
            {b.avg != null && (
              <span className="author-book__rating">
                <Stars value={b.avg} size={13} />
              </span>
            )}
          </button>
        ))}
        {books.length === 0 && (
          <p className="body-medium on-surface-variant">
            Todavía no hay libros suyos en el catálogo.
          </p>
        )}
      </div>
    </section>
  )
}
