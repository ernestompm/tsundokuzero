import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookCover, Card, ProgressBar } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'

interface LibItem {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  current: number
  total: number
  status: string
}

const TABS: { key: string; label: string }[] = [
  { key: 'reading', label: 'Leyendo' },
  { key: 'finished', label: 'Leídos' },
  { key: 'want', label: 'Por leer' },
]

export default function LibraryPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('reading')
  const [items, setItems] = useState<LibItem[]>([])

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data: progress } = await supabase
        .from('reading_progress')
        .select('book_id, current_chapter, status')
        .eq('user_id', session!.user.id)
      if (!progress || progress.length === 0) {
        setItems([])
        return
      }
      const { data: books } = await supabase
        .from('books')
        .select('id, title, author, cover_url, total_chapters')
        .in('id', progress.map((p) => p.book_id))
      const byId = new Map((books ?? []).map((b) => [b.id, b]))
      setItems(
        progress.flatMap((p) => {
          const b = byId.get(p.book_id)
          if (!b) return []
          return [
            {
              bookId: p.book_id,
              title: b.title,
              author: b.author,
              coverUrl: b.cover_url,
              current: p.current_chapter,
              total: b.total_chapters,
              status: p.status,
            },
          ]
        }),
      )
    }
    void load()
  }, [session])

  const visible = items.filter((i) => i.status === tab)

  return (
    <section>
      <h1 className="headline-medium serif" style={{ marginBottom: 16 }}>
        Mi biblioteca
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="label-large"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              cursor: 'pointer',
              background:
                tab === t.key
                  ? 'var(--md-sys-color-secondary-container)'
                  : 'transparent',
              color:
                tab === t.key
                  ? 'var(--md-sys-color-on-secondary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card tone="outlined">
          <p className="body-medium on-surface-variant">
            Nada por aquí todavía.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((i) => {
            const pct = Math.round((i.current / i.total) * 100)
            return (
              <Card
                key={i.bookId}
                className="lib-item"
                tone="default"
              >
                <button
                  onClick={() => navigate('/book')}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 14,
                    width: '100%',
                  }}
                >
                  <BookCover
                    title={i.title}
                    author={i.author}
                    coverUrl={i.coverUrl}
                    size="md"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="title-medium serif">{i.title}</div>
                    <div className="body-small on-surface-variant">
                      {i.current > 0
                        ? `Capítulo ${i.current} de ${i.total}`
                        : 'Sin empezar'}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProgressBar percent={pct} />
                      <span className="label-medium on-surface-variant">{pct}%</span>
                    </div>
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
