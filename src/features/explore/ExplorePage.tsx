import { useEffect, useState } from 'react'
import '@material/web/textfield/outlined-text-field.js'
import { supabase } from '../../lib/supabase'
import { BookCover, SectionHeader } from '../../components/ui'

interface DiscoverBook {
  id: string
  title: string
  author: string
}

const CATEGORIES = ['Ficción', 'No ficción', 'Ensayo', 'Poesía', 'Misterio']

export default function ExplorePage() {
  const [books, setBooks] = useState<DiscoverBook[]>([])

  useEffect(() => {
    supabase
      .from('poll_options')
      .select('id, book_title, book_author')
      .limit(12)
      .then(({ data }) =>
        setBooks(
          (data ?? []).map((o) => ({
            id: o.id,
            title: o.book_title,
            author: o.book_author,
          })),
        ),
      )
  }, [])

  return (
    <section>
      <h1 className="headline-medium serif" style={{ marginBottom: 16 }}>
        Explorar
      </h1>
      <md-outlined-text-field
        label="Busca libros, autores, personas…"
        style={{ width: '100%' }}
      >
        <span slot="leading-icon" className="material-symbols-rounded">
          search
        </span>
      </md-outlined-text-field>

      <SectionHeader title="Próximas lecturas del club" />
      <div
        style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}
      >
        {books.map((b) => (
          <BookCover key={b.id} title={b.title} author={b.author} size="lg" />
        ))}
        {books.length === 0 && (
          <p className="body-medium on-surface-variant">
            Aún no hay propuestas. Aparecerán cuando el capitán abra una
            votación.
          </p>
        )}
      </div>

      <SectionHeader title="Categorías" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => (
          <span
            key={c}
            className="label-large"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </section>
  )
}
