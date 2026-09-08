import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import { BookCover, Card, Chip, ProgressBar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import AddBookSheet from '../../components/AddBookSheet'
import { useConfirm } from '../../components/ConfirmProvider'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../auth/AuthContext'
import './library.css'

type Status = 'reading' | 'finished' | 'want'

interface LibItem {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  current: number
  total: number
  status: Status
}

const TABS: { key: Status; label: string; empty: string }[] = [
  { key: 'reading', label: 'Leyendo', empty: '¿Qué tienes entre manos? Añádelo y abre sus conversaciones.' },
  { key: 'want', label: 'Por leer', empty: 'Tu pila de pendientes está vacía. Guarda aquí lo que te apetece leer.' },
  { key: 'finished', label: 'Leídos', empty: 'Aún no has terminado ningún libro. Cuando llegues al último capítulo, aparecerá aquí con tu reseña.' },
]

/**
 * Biblioteca personal: estantería con tres estados y GESTIÓN de cada libro
 * (empezar, marcar como leído, quitar). El alta vive en la hoja
 * «Añadir libro» (buscador de catálogo + fuentes públicas); `?add=1`
 * la abre directamente para poder enlazarla desde cualquier sitio.
 */
export default function LibraryPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Status>('reading')
  // null = cargando (auditoría M-05)
  const [items, setItems] = useState<LibItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const adding = searchParams.get('add') === '1'
  const addQuery = searchParams.get('q') ?? ''

  const openAdd = () => setSearchParams({ add: '1' }, { replace: true })
  const closeAdd = () => setSearchParams({}, { replace: true })

  const load = useCallback(async () => {
    if (!session) return
    const { data: progress, error } = await supabase
      .from('reading_progress')
      .select('book_id, current_chapter, status')
      .eq('user_id', session.user.id)
    if (error) {
      setError(friendlyError(error, 'No se pudo cargar tu biblioteca.'))
      setItems([])
      return
    }
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
            status: p.status as Status,
          },
        ]
      }),
    )
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  // Si la estantería activa está vacía pero otra no, salta a la que tenga algo
  useEffect(() => {
    if (!items || items.length === 0) return
    if (items.some((i) => i.status === tab)) return
    const first = TABS.find((t) => items.some((i) => i.status === t.key))
    if (first) setTab(first.key)
    // solo al cargar: no perseguir al usuario cuando vacía una pestaña a propósito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items === null])

  const setStatus = async (item: LibItem, status: Status) => {
    if (!session) return
    setBusyId(item.bookId)
    setError(null)
    const current =
      status === 'finished'
        ? item.total
        : status === 'reading'
          ? Math.max(1, item.current)
          : item.current
    const { error } = await supabase.from('reading_progress').upsert(
      { user_id: session.user.id, book_id: item.bookId, status, current_chapter: current },
      { onConflict: 'user_id,book_id' },
    )
    if (error) setError(friendlyError(error, 'No se pudo actualizar el libro.'))
    else if (status === 'finished') {
      // Al terminar, a la ficha: ahí esperan las estrellas y la reseña
      navigate(`/book/${item.bookId}`)
      return
    }
    setBusyId(null)
    await load()
  }

  const remove = async (item: LibItem) => {
    if (!session) return
    const ok = await confirm({
      title: `¿Quitar «${item.title}»?`,
      message:
        item.status === 'finished'
          ? 'Saldrá de tus leídos. Tu reseña y tus ideas en sus capítulos se conservan.'
          : 'Saldrá de tu estantería y perderás el punto de lectura. Tus ideas publicadas se conservan.',
      confirmLabel: 'Quitar',
    })
    if (!ok) return
    setBusyId(item.bookId)
    const { error } = await supabase
      .from('reading_progress')
      .delete()
      .eq('user_id', session.user.id)
      .eq('book_id', item.bookId)
    if (error) setError(friendlyError(error, 'No se pudo quitar el libro.'))
    setBusyId(null)
    await load()
  }

  const counts = new Map<Status, number>()
  for (const i of items ?? []) counts.set(i.status, (counts.get(i.status) ?? 0) + 1)
  const visible = (items ?? []).filter((i) => i.status === tab)
  const tabInfo = TABS.find((t) => t.key === tab)!

  return (
    <section className="library">
      <PageHeader
        title="Mi biblioteca"
        sub="Leyendo, por leer y leídos"
        action={
          <md-filled-button onClick={openAdd}>
            <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
              add
            </span>
            Añadir libro
          </md-filled-button>
        }
      />

      <div className="library__tabs" role="tablist" aria-label="Estanterías">
        {TABS.map((t) => (
          <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {counts.get(t.key) ? ` · ${counts.get(t.key)}` : ''}
          </Chip>
        ))}
      </div>

      {error && (
        <p className="library__error body-medium" role="alert">
          {error}
        </p>
      )}

      {items === null ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <md-circular-progress indeterminate />
        </div>
      ) : visible.length === 0 ? (
        <Card tone="outlined" className="library__empty">
          <span className="material-symbols-rounded library__empty-icon" aria-hidden="true">
            auto_stories
          </span>
          <p className="body-medium on-surface-variant">{tabInfo.empty}</p>
          <div className="library__empty-actions">
            <md-filled-tonal-button onClick={openAdd}>
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
                add
              </span>
              Añadir libro
            </md-filled-tonal-button>
            <md-text-button onClick={() => navigate('/explore')}>Explorar</md-text-button>
          </div>
        </Card>
      ) : (
        <div className="library__list">
          {visible.map((i) => {
            const pct = i.total > 0 ? Math.round((i.current / i.total) * 100) : 0
            const busy = busyId === i.bookId
            return (
              <Card key={i.bookId} className="lib-item" tone="default">
                <button
                  type="button"
                  className="lib-item__main"
                  onClick={() => navigate(`/book/${i.bookId}`)}
                  aria-label={`Abrir ${i.title}`}
                >
                  <BookCover title={i.title} author={i.author} coverUrl={i.coverUrl} size="md" />
                  <div className="lib-item__info">
                    <div className="title-medium serif lib-item__title">{i.title}</div>
                    <div className="body-small on-surface-variant">{i.author}</div>
                    {i.status === 'reading' && (
                      <div className="lib-item__progress">
                        <ProgressBar percent={pct} />
                        <span className="label-medium on-surface-variant">
                          {i.current > 0 ? `Cap. ${i.current} de ${i.total}` : 'Sin empezar'}
                        </span>
                      </div>
                    )}
                    {i.status === 'finished' && (
                      <span className="label-medium lib-item__done">
                        <span className="material-symbols-rounded" aria-hidden="true">
                          check_circle
                        </span>
                        Terminado · {i.total} capítulos
                      </span>
                    )}
                    {i.status === 'want' && (
                      <span className="label-medium on-surface-variant">{i.total} capítulos</span>
                    )}
                  </div>
                </button>

                <div className="lib-item__actions">
                  {i.status === 'want' && (
                    <md-filled-tonal-button disabled={busy || undefined} onClick={() => void setStatus(i, 'reading')}>
                      Empezar
                    </md-filled-tonal-button>
                  )}
                  {i.status === 'reading' && (
                    <md-text-button disabled={busy || undefined} onClick={() => void setStatus(i, 'finished')}>
                      Marcar como leído
                    </md-text-button>
                  )}
                  {i.status === 'finished' && (
                    <md-text-button disabled={busy || undefined} onClick={() => navigate(`/book/${i.bookId}`)}>
                      Mi reseña
                    </md-text-button>
                  )}
                  <button
                    type="button"
                    className="lib-item__remove"
                    aria-label={`Quitar ${i.title} de la estantería`}
                    title="Quitar de la estantería"
                    disabled={busy}
                    onClick={() => void remove(i)}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AddBookSheet open={adding} onClose={closeAdd} initialQuery={addQuery} />
    </section>
  )
}
