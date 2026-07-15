import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover, SectionHeader } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import './explore.css'

interface PersonRow {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
}

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
}

export default function ExplorePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<PersonRow[] | null>(null)
  const [books, setBooks] = useState<BookRow[] | null>(null)
  const [following, setFollowing] = useState<Set<string>>(new Set())

  // Mis seguidos (para pintar Seguir / Siguiendo)
  useEffect(() => {
    if (!session) return
    supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', session.user.id)
      .then(({ data }) =>
        setFollowing(new Set((data ?? []).map((f) => f.followed_id))),
      )
  }, [session])

  // Búsqueda (con debounce); sin consulta → sugerencias
  const search = useCallback(
    async (rawTerm: string) => {
      if (!session) return
      // PostgREST usa comas/paréntesis/porcentajes como sintaxis en or():
      // se limpian para que escribirlos no rompa la búsqueda.
      const term = rawTerm.replace(/[,()%]/g, ' ').trim()
      const like = `%${term}%`
      const [{ data: profiles }, { data: bookRows }] = await Promise.all([
        term
          ? supabase
              .from('profiles')
              .select('id, username, display_name, bio, avatar_url')
              .or(`username.ilike.${like},display_name.ilike.${like}`)
              .neq('id', session.user.id)
              .limit(12)
          : supabase
              .from('profiles')
              .select('id, username, display_name, bio, avatar_url')
              .neq('id', session.user.id)
              .order('created_at')
              .limit(12),
        term
          ? supabase
              .from('books')
              .select('id, title, author, cover_url')
              .or(`title.ilike.${like},author.ilike.${like}`)
              .limit(12)
          : supabase
              .from('books')
              .select('id, title, author, cover_url')
              .limit(12),
      ])
      setPeople(profiles ?? [])
      setBooks(bookRows ?? [])
    },
    [session],
  )

  useEffect(() => {
    const t = setTimeout(() => void search(q.trim()), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, search])

  const toggleFollow = async (personId: string) => {
    if (!session) return
    const am = following.has(personId)
    // Actualización optimista
    setFollowing((s) => {
      const next = new Set(s)
      if (am) next.delete(personId)
      else next.add(personId)
      return next
    })
    if (am) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('followed_id', personId)
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: session.user.id, followed_id: personId })
    }
  }

  return (
    <section className="explore">
      <PageHeader title="Explorar" sub="Libros, autores y lectores del club" />
      <input
        className="explore-search body-large"
        placeholder="Busca libros, autores o personas…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      {people === null || books === null ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
          <md-circular-progress indeterminate />
        </div>
      ) : (
        <>
          <SectionHeader title={q ? 'Libros' : 'En la estantería'} />
          {books.length === 0 ? (
            <p className="body-medium on-surface-variant">
              Ningún libro coincide con «{q}».
            </p>
          ) : (
            <div className="explore-books">
              {books.map((b) => (
                <button
                  key={b.id}
                  className="explore-book"
                  onClick={() => navigate(`/book/${b.id}`)}
                >
                  <BookCover
                    title={b.title}
                    author={b.author}
                    coverUrl={b.cover_url}
                    size="lg"
                  />
                  <span className="label-medium explore-book__title">
                    {b.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          <SectionHeader title={q ? 'Personas' : 'Lectores del club'} />
          {people.length === 0 ? (
            <p className="body-medium on-surface-variant">
              Nadie coincide con «{q}».
            </p>
          ) : (
            <div className="explore-people">
              {people.map((p) => (
                <div key={p.id} className="person-row">
                  <Link to={`/u/${p.username}`} className="person-row__id">
                    <Avatar name={p.display_name} url={p.avatar_url} size={42} />
                    <span className="person-row__names">
                      <span className="title-small">{p.display_name}</span>
                      <span className="body-small on-surface-variant">
                        @{p.username}
                        {p.bio ? ` · ${p.bio}` : ''}
                      </span>
                    </span>
                  </Link>
                  {following.has(p.id) ? (
                    <md-outlined-button onClick={() => void toggleFollow(p.id)}>
                      Siguiendo
                    </md-outlined-button>
                  ) : (
                    <md-filled-button onClick={() => void toggleFollow(p.id)}>
                      Seguir
                    </md-filled-button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
