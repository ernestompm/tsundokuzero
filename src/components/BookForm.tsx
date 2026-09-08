import { useEffect, useRef, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import {
  defaultBuyUrl,
  enrichSynopsis,
  searchExternalBooks,
  type ExternalBook,
} from '../lib/bookSearch'
import { BookCover } from './ui'
import './BookForm.css'

/**
 * Alta de libro guiada (Admin → Libros y Club → Gestionar). Busca por
 * título, autor o ISBN (Google Books → Open Library) y autorrellena la
 * ficha. Los capítulos: basta con el NÚMERO; los títulos son opcionales
 * (uno por línea) y se pueden completar después.
 *
 * El alta la hace el servidor en una transacción (RPC add_book_smart,
 * migr. 026): libro + capítulos, con deduplicado por ISBN o título+autor.
 */
export default function BookForm({
  onCreated,
  onCancel,
}: {
  onCreated?: (bookId: string) => void
  onCancel?: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ExternalBook[] | null>(null)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [cover, setCover] = useState('')
  const [coverSource, setCoverSource] = useState<string | null>(null)
  const [synopsisSource, setSynopsisSource] = useState<string | null>(null)
  const [buy, setBuy] = useState('')
  const [chapterCount, setChapterCount] = useState('')
  const [chapterTitles, setChapterTitles] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Búsqueda con debounce en fuentes públicas
  useEffect(() => {
    const term = q.trim()
    abortRef.current?.abort()
    if (term.length < 2) {
      setResults(null)
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    const t = setTimeout(async () => {
      const found = await searchExternalBooks(term, ctrl.signal)
      if (ctrl.signal.aborted) return
      setResults(found)
      setSearching(false)
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const pick = async (b: ExternalBook) => {
    const rich = await enrichSynopsis(b)
    setTitle(rich.title)
    setAuthor(rich.author)
    setIsbn(rich.isbn ?? '')
    setSynopsis(rich.synopsis ?? '')
    setSynopsisSource(rich.synopsis ? rich.synopsisSource : null)
    setCover(rich.coverUrl ?? '')
    setCoverSource(rich.coverUrl ? rich.coverSource : null)
    setBuy(defaultBuyUrl(rich))
    setResults(null)
    setQ('')
    const missing: string[] = []
    if (!rich.synopsis) missing.push('sinopsis')
    if (!rich.coverUrl) missing.push('portada')
    setNotice(
      'Ficha rellenada.' +
        (missing.length ? ` Sin datos de: ${missing.join(' y ')}; puedes ponerlos a mano.` : '') +
        ' Indica cuántos capítulos tiene (los títulos son opcionales).' +
        (rich.synopsis
          ? ' La sinopsis importada es texto editorial con copyright: conviene reescribirla con tus palabras.'
          : ''),
    )
  }

  const titles = chapterTitles
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const effectiveCount = titles.length > 0 ? titles.length : parseInt(chapterCount, 10)

  const create = async () => {
    const t = title.trim()
    const a = author.trim()
    if (!t || !a) {
      setError('Hacen falta título y autor.')
      return
    }
    if (!Number.isFinite(effectiveCount) || effectiveCount < 1 || effectiveCount > 500) {
      setError('Indica cuántos capítulos tiene el libro (o pega sus títulos, uno por línea).')
      return
    }
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('add_book_smart', {
      p_title: t,
      p_author: a,
      p_isbn: isbn.trim() || null,
      p_cover_url: cover.trim() || null,
      p_cover_source: cover.trim() ? (coverSource ?? 'Manual') : null,
      p_synopsis: synopsis.trim() || null,
      p_synopsis_source: synopsis.trim() ? (synopsisSource ?? 'Propia') : null,
      p_buy_url: buy.trim() || null,
      p_total_chapters: effectiveCount,
      p_chapter_labels: titles.length > 0 ? titles : null,
    })
    const row = data?.[0]
    if (error || !row) {
      setError(friendlyError(error, 'No se pudo crear el libro.'))
      setBusy(false)
      return
    }
    if (!row.created) {
      setError('Ese libro ya estaba en el catálogo (mismo ISBN o mismo título y autor). No se ha duplicado.')
      setBusy(false)
      onCreated?.(row.book_id)
      return
    }
    setTitle('')
    setAuthor('')
    setIsbn('')
    setSynopsis('')
    setCover('')
    setBuy('')
    setChapterCount('')
    setChapterTitles('')
    setNotice(null)
    setBusy(false)
    onCreated?.(row.book_id)
  }

  return (
    <div className="bookform">
      <p className="body-small on-surface-variant">
        Busca por título, autor o ISBN para autorrellenar la ficha. Solo hace
        falta el número de capítulos; sus títulos son opcionales.
      </p>

      <input
        className="tz-input bookform__input body-medium"
        placeholder="Buscar: título, autor o ISBN…"
        aria-label="Buscar libro por título, autor o ISBN"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {searching && <p className="body-small on-surface-variant">Buscando…</p>}
      {results && results.length === 0 && !searching && (
        <p className="body-small on-surface-variant">
          Sin resultados (pasa con ediciones españolas). Rellena la ficha a mano.
        </p>
      )}
      {results && results.length > 0 && (
        <div className="bookform__results" role="listbox" aria-label="Resultados">
          {results.map((b) => (
            <button
              key={b.key}
              type="button"
              role="option"
              aria-selected={false}
              className="bookform__result"
              onClick={() => void pick(b)}
            >
              <BookCover title={b.title || 'Sin título'} author={b.author} coverUrl={b.coverUrl} size="sm" />
              <span className="bookform__result-text">
                <span className="title-small serif">{b.title || 'Libro sin título'}</span>
                <span className="body-small on-surface-variant">
                  {b.author || 'Autor desconocido'}
                  {b.year ? ` · ${b.year}` : ''}
                  {b.isbn ? ` · ISBN ${b.isbn}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {notice && <p className="body-small bookform__msg">{notice}</p>}
      {error && <p className="body-small bookform__error" role="alert">{error}</p>}

      <div className="bookform__row">
        <label className="bookform__field label-medium" style={{ flex: 2 }}>
          Título *
          <input className="tz-input bookform__input body-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="bookform__field label-medium" style={{ flex: 1 }}>
          ISBN
          <input
            className="tz-input bookform__input body-medium"
            inputMode="numeric"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
        </label>
      </div>
      <label className="bookform__field label-medium">
        Autor *
        <input className="tz-input bookform__input body-medium" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label className="bookform__field label-medium">
        Sinopsis{synopsisSource ? ` — importada de ${synopsisSource}: reescríbela` : ''}
        <textarea
          className="tz-input bookform__input body-medium"
          rows={3}
          value={synopsis}
          onChange={(e) => {
            setSynopsis(e.target.value)
            setSynopsisSource(null)
          }}
        />
      </label>
      <div className="bookform__row">
        <label className="bookform__field label-medium" style={{ flex: 1 }}>
          URL de portada
          <input
            className="tz-input bookform__input body-medium"
            placeholder="https://…"
            value={cover}
            onChange={(e) => {
              setCover(e.target.value)
              setCoverSource(null)
            }}
          />
        </label>
        <label className="bookform__field label-medium" style={{ flex: 1 }}>
          Enlace de compra
          <input
            className="tz-input bookform__input body-medium"
            placeholder="Amazon…"
            value={buy}
            onChange={(e) => setBuy(e.target.value)}
          />
        </label>
      </div>
      {cover.trim() && (
        <img
          className="bookform__coverpreview"
          src={cover.trim()}
          alt="Vista previa de la portada"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      )}

      <div className="bookform__row">
        <label className="bookform__field label-medium" style={{ flex: 1 }}>
          Nº de capítulos *
          <input
            className="tz-input bookform__input body-medium"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={titles.length > 0 ? String(titles.length) : chapterCount}
            disabled={titles.length > 0}
            onChange={(e) => setChapterCount(e.target.value)}
          />
        </label>
        <label className="bookform__field label-medium" style={{ flex: 3 }}>
          Títulos de capítulo (opcional, uno por línea)
          <textarea
            className="tz-input bookform__input body-medium"
            rows={3}
            placeholder={'Cero horas\nLa señora Elm\n…'}
            value={chapterTitles}
            onChange={(e) => setChapterTitles(e.target.value)}
          />
        </label>
      </div>

      <div className="bookform__actions">
        {onCancel && <md-text-button onClick={onCancel}>Cancelar</md-text-button>}
        <md-filled-button disabled={busy || undefined} onClick={() => void create()}>
          {busy ? 'Creando…' : 'Crear libro'}
        </md-filled-button>
      </div>
    </div>
  )
}
