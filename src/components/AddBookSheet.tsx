import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import {
  asIsbn,
  defaultBuyUrl,
  enrichSynopsis,
  searchExternalBooks,
  type ExternalBook,
} from '../lib/bookSearch'
import { useModalBehavior } from './modal'
import { BookCover, Chip } from './ui'
import './ComposeSheet.css'
import './AddBookSheet.css'

type Shelf = 'reading' | 'want'

interface CatalogHit {
  id: string
  title: string
  author: string
  coverUrl: string | null
  /** estado en MI estantería, si ya lo tengo */
  mine: 'reading' | 'finished' | 'want' | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** texto inicial (p. ej. lo que buscabas en Explorar) */
  initialQuery?: string
  /** tras añadir: por defecto navega a la ficha del libro */
  onAdded?: (bookId: string, created: boolean) => void
}

/**
 * Hoja «Añadir libro»: busca por título, autor o ISBN en el catálogo y en
 * Google Books / Open Library, y deja el libro en tu estantería en dos
 * toques. El alta en el catálogo la hace el servidor (RPC add_book_smart,
 * migr. 026): deduplica, crea los capítulos y guarda tu estado de lectura
 * en una sola transacción.
 */
export default function AddBookSheet({ open, onClose, initialQuery = '', onAdded }: Props) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const sheetRef = useModalBehavior(open, onClose)

  const [q, setQ] = useState(initialQuery)
  const [catalog, setCatalog] = useState<CatalogHit[] | null>(null)
  const [external, setExternal] = useState<ExternalBook[] | null>(null)
  const [searching, setSearching] = useState(false)

  // Paso 2: confirmar un libro nuevo (de fuera o a mano)
  const [pick, setPick] = useState<ExternalBook | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [chapters, setChapters] = useState('')
  const [shelf, setShelf] = useState<Shelf>('reading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Al abrir: consulta inicial y foco en el buscador
  useEffect(() => {
    if (!open) return
    setQ(initialQuery)
    setPick(null)
    setError(null)
    setBusy(false)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open, initialQuery])

  // Búsqueda con debounce: catálogo propio + fuentes externas en paralelo
  useEffect(() => {
    if (!open || pick) return
    const term = q.trim()
    abortRef.current?.abort()
    if (term.length < 2) {
      setCatalog(null)
      setExternal(null)
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    const t = setTimeout(async () => {
      const like = `%${term.replace(/[,()%]/g, ' ')}%`
      const isbn = asIsbn(term)
      const catalogReq = session
        ? supabase
            .from('books')
            .select('id, title, author, cover_url')
            .or(
              isbn
                ? `isbn.eq.${isbn},title.ilike.${like}`
                : `title.ilike.${like},author.ilike.${like}`,
            )
            .limit(6)
        : Promise.resolve({ data: [] as { id: string; title: string; author: string; cover_url: string | null }[] })
      const [cat, ext] = await Promise.all([catalogReq, searchExternalBooks(term, ctrl.signal)])
      if (ctrl.signal.aborted) return
      const rows = cat.data ?? []
      let mineById = new Map<string, CatalogHit['mine']>()
      if (session && rows.length) {
        const { data: mine } = await supabase
          .from('reading_progress')
          .select('book_id, status')
          .eq('user_id', session.user.id)
          .in('book_id', rows.map((r) => r.id))
        mineById = new Map((mine ?? []).map((m) => [m.book_id, m.status as CatalogHit['mine']]))
      }
      if (ctrl.signal.aborted) return
      const hits: CatalogHit[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        author: r.author,
        coverUrl: r.cover_url,
        mine: mineById.get(r.id) ?? null,
      }))
      setCatalog(hits)
      // Fuera quedan los externos que ya están en el catálogo (mismo título+autor)
      const known = new Set(hits.map((h) => `${h.title.toLowerCase()}|${h.author.toLowerCase()}`))
      setExternal(ext.filter((b) => !known.has(`${b.title.toLowerCase()}|${b.author.toLowerCase()}`)))
      setSearching(false)
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, open, pick, session])

  const choose = async (b: ExternalBook) => {
    setPick(b)
    setTitle(b.title)
    setAuthor(b.author)
    setChapters('')
    setError(null)
    // La sinopsis de Open Library llega en una segunda petición; no bloquea
    const rich = await enrichSynopsis(b)
    setPick((cur) => (cur?.key === b.key ? rich : cur))
  }

  const chooseManual = () => {
    setPick({
      key: 'manual',
      title: '',
      author: '',
      isbn: null,
      coverUrl: null,
      coverSource: null,
      synopsis: null,
      synopsisSource: null,
      year: null,
      pageCount: null,
      olWorkKey: null,
    })
    setTitle(q.trim())
    setAuthor('')
    setChapters('')
    setError(null)
  }

  const finish = (bookId: string, created: boolean) => {
    setBusy(false)
    onClose()
    if (onAdded) onAdded(bookId, created)
    else navigate(`/book/${bookId}`)
  }

  /** Libro que ya está en el catálogo: solo hay que ponerlo en mi estantería */
  const addExisting = async (hit: CatalogHit, status: Shelf) => {
    if (!session) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('add_book_smart', {
      p_title: hit.title,
      p_author: hit.author,
      p_status: status,
    })
    if (error) {
      setError(friendlyError(error, 'No se pudo añadir a tu biblioteca.'))
      setBusy(false)
      return
    }
    finish(hit.id, false)
  }

  /** Libro nuevo (de fuera o a mano): alta + estantería en una transacción */
  const create = async () => {
    if (!session || !pick) return
    const t = title.trim()
    const a = author.trim()
    const n = parseInt(chapters, 10)
    if (!t || !a) {
      setError('Hacen falta título y autor.')
      return
    }
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setError('Indica cuántos capítulos tiene (mira el índice). Podrás ajustarlo después.')
      return
    }
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('add_book_smart', {
      p_title: t,
      p_author: a,
      p_isbn: pick.isbn,
      p_cover_url: pick.coverUrl,
      p_cover_source: pick.coverSource,
      p_synopsis: pick.synopsis,
      p_synopsis_source: pick.synopsisSource,
      p_buy_url: defaultBuyUrl({ isbn: pick.isbn, title: t, author: a }),
      p_total_chapters: n,
      p_status: shelf,
    })
    const row = data?.[0]
    if (error || !row) {
      setError(friendlyError(error, 'No se pudo añadir el libro. Inténtalo de nuevo.'))
      setBusy(false)
      return
    }
    finish(row.book_id, row.created)
  }

  if (!open) return null

  const term = q.trim()
  const nothing =
    !searching && term.length >= 2 && (catalog?.length ?? 0) === 0 && (external?.length ?? 0) === 0

  return (
    <div className="sheet-scrim" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet addbook"
        role="dialog"
        aria-modal="true"
        aria-label="Añadir un libro"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" aria-hidden />

        {pick === null ? (
          <>
            <div className="sheet__head">
              <h2 className="title-large serif">Añadir un libro</h2>
              <md-text-button onClick={onClose}>Cerrar</md-text-button>
            </div>

            <input
              ref={inputRef}
              className="tz-input addbook__search body-large"
              placeholder="Título, autor o ISBN…"
              aria-label="Buscar libro por título, autor o ISBN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />

            {error && <p className="sheet__error body-medium">{error}</p>}

            {term.length < 2 ? (
              <p className="body-medium on-surface-variant addbook__hint">
                Escribe el título o el autor. Si tienes el libro a mano, el ISBN de la
                contraportada es lo más exacto.
              </p>
            ) : (
              <div className="addbook__results">
                {catalog && catalog.length > 0 && (
                  <section>
                    <h3 className="label-medium addbook__section">Ya en Tsundoku</h3>
                    {catalog.map((h) => (
                      <div key={h.id} className="addbook__row">
                        <BookCover title={h.title} author={h.author} coverUrl={h.coverUrl} size="sm" />
                        <div className="addbook__info">
                          <span className="title-small serif addbook__title">{h.title}</span>
                          <span className="body-small on-surface-variant">{h.author}</span>
                        </div>
                        {h.mine ? (
                          <md-text-button onClick={() => finish(h.id, false)}>
                            {h.mine === 'finished' ? 'Leído' : h.mine === 'reading' ? 'Leyendo' : 'Por leer'}
                          </md-text-button>
                        ) : (
                          <div className="addbook__quick">
                            <md-text-button disabled={busy || undefined} onClick={() => void addExisting(h, 'want')}>
                              Por leer
                            </md-text-button>
                            <md-filled-tonal-button disabled={busy || undefined} onClick={() => void addExisting(h, 'reading')}>
                              Leyendo
                            </md-filled-tonal-button>
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {external && external.length > 0 && (
                  <section>
                    <h3 className="label-medium addbook__section">
                      {catalog && catalog.length > 0 ? 'Otras ediciones y libros' : 'Resultados'}
                    </h3>
                    {external.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        className="addbook__row addbook__row--btn"
                        onClick={() => void choose(b)}
                      >
                        <BookCover title={b.title || 'Sin título'} author={b.author} coverUrl={b.coverUrl} size="sm" />
                        <div className="addbook__info">
                          <span className="title-small serif addbook__title">{b.title || 'Libro sin título'}</span>
                          <span className="body-small on-surface-variant">
                            {b.author || 'Autor desconocido'}
                            {b.year ? ` · ${b.year}` : ''}
                          </span>
                        </div>
                        <span className="material-symbols-rounded addbook__chev" aria-hidden="true">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </section>
                )}

                {searching && (
                  <div className="addbook__loading">
                    <md-circular-progress indeterminate style={{ '--md-circular-progress-size': '28px' } as CSSProperties} />
                    <span className="body-small on-surface-variant">Buscando…</span>
                  </div>
                )}

                {nothing && (
                  <p className="body-medium on-surface-variant addbook__hint">
                    No encontramos «{term}». Prueba con el ISBN o añádelo a mano.
                  </p>
                )}

                {!searching && (
                  <button type="button" className="addbook__manual label-large" onClick={chooseManual}>
                    <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                    ¿No está? Añadirlo a mano
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sheet__head">
              <button type="button" className="addbook__back label-large" onClick={() => setPick(null)}>
                <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                Buscar otro
              </button>
              <md-text-button onClick={onClose}>Cerrar</md-text-button>
            </div>

            <div className="addbook__confirm">
              <BookCover title={title || 'Libro'} author={author} coverUrl={pick.coverUrl} size="lg" />
              <div className="addbook__fields">
                <label className="label-medium addbook__field">
                  Título
                  <input
                    className="tz-input body-medium"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus={pick.key === 'manual'}
                  />
                </label>
                <label className="label-medium addbook__field">
                  Autor
                  <input
                    className="tz-input body-medium"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <label className="label-medium addbook__field addbook__chapters">
              ¿Cuántos capítulos tiene?
              <input
                className="tz-input body-medium"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                placeholder="Mira el índice"
                value={chapters}
                onChange={(e) => setChapters(e.target.value)}
                autoFocus={pick.key !== 'manual'}
              />
              <span className="body-small on-surface-variant">
                Con eso el candado antispoiler sabe qué conversaciones abrirte. Los títulos de
                cada capítulo se pueden poner después.
                {pick.pageCount ? ` Esta edición tiene ${pick.pageCount} páginas.` : ''}
              </span>
            </label>

            <div className="addbook__shelf" role="group" aria-label="¿Dónde lo pongo?">
              <Chip icon="menu_book" active={shelf === 'reading'} onClick={() => setShelf('reading')}>
                Lo estoy leyendo
              </Chip>
              <Chip icon="bookmark" active={shelf === 'want'} onClick={() => setShelf('want')}>
                Por leer
              </Chip>
            </div>

            {pick.synopsisSource && (
              <p className="body-small on-surface-variant addbook__hint">
                La sinopsis se importa de {pick.synopsisSource} con su atribución; el admin puede
                reescribirla.
              </p>
            )}

            {error && <p className="sheet__error body-medium">{error}</p>}

            <div className="sheet__actions">
              <md-text-button onClick={onClose}>Cancelar</md-text-button>
              <md-filled-button disabled={busy || undefined} onClick={() => void create()}>
                {busy ? 'Añadiendo…' : 'Añadir a mi biblioteca'}
              </md-filled-button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
