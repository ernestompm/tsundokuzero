import { useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import {
  asIsbn,
  defaultBuyUrl,
  resolveBookLines,
  searchExternalBooks,
  type ExternalBook,
} from '../../lib/bookSearch'
import { BookCover } from '../../components/ui'
import './pollcomposer.css'

interface Candidato {
  key: string
  /** ficha del libro, venga del catálogo o de fuera */
  book: ExternalBook
  /** ya estaba en el catálogo: no se creará nada nuevo */
  enCatalogo: boolean
  /** pitch del capitán, opcional */
  note: string
}

/** «Libro de octubre»: el mes que viene, que es lo que se suele votar. */
function tituloPorDefecto() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  const mes = d.toLocaleDateString('es-ES', { month: 'long' })
  return `Libro de ${mes}`
}

/** Domingo que viene, en formato yyyy-mm-dd para el input date. */
function domingoQueViene() {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

/**
 * Compositor de votaciones en un paso: el capitán pega los ISBN o los
 * títulos, uno por línea, y salen las fichas listas para abrir la
 * encuesta. Antes había que dar de alta cada libro en el catálogo por
 * separado, y por eso el club acabó votando por WhatsApp.
 *
 * El alta y la votación las hace el servidor en una transacción
 * (RPC create_poll_with_books, migr. 027), que deduplica contra el
 * catálogo y avisa a todos los miembros.
 */
export default function PollComposer({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(tituloPorDefecto())
  const [raw, setRaw] = useState('')
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [noEncontrados, setNoEncontrados] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [closesAt, setClosesAt] = useState(domingoQueViene())
  const [buscando, setBuscando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Busca primero en el catálogo propio: así no se duplican fichas. */
  const enCatalogo = async (linea: string): Promise<ExternalBook | null> => {
    const isbn = asIsbn(linea)
    const like = `%${linea.replace(/[,()%]/g, ' ').trim()}%`
    const { data } = await supabase
      .from('books')
      .select('id, title, author, isbn, cover_url, cover_source, synopsis, buy_url')
      .or(isbn ? `isbn.eq.${isbn},title.ilike.${like}` : `title.ilike.${like}`)
      .limit(1)
    const b = data?.[0]
    if (!b) return null
    return {
      key: `cat:${b.id}`,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      coverUrl: b.cover_url,
      coverSource: b.cover_source,
      synopsis: b.synopsis,
      synopsisSource: null,
      year: null,
      pageCount: null,
      olWorkKey: null,
    }
  }

  const añadir = (book: ExternalBook, yaEsta: boolean) => {
    setCandidatos((cur) => {
      const clave = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`
      if (cur.some((c) => `${c.book.title.toLowerCase()}|${c.book.author.toLowerCase()}` === clave))
        return cur
      if (cur.length >= 5) return cur
      return [...cur, { key: book.key + cur.length, book, enCatalogo: yaEsta, note: '' }]
    })
  }

  const buscarPegados = async () => {
    const lineas = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lineas.length === 0) return
    setBuscando(true)
    setError(null)
    setNoEncontrados([])

    // El catálogo manda: si ya está, se reutiliza esa ficha
    const locales = await Promise.all(
      lineas.map(async (l) => ({ line: l, book: await enCatalogo(l) })),
    )
    const pendientes = locales.filter((x) => !x.book).map((x) => x.line)
    const fuera = pendientes.length ? await resolveBookLines(pendientes) : []
    const porLinea = new Map(fuera.map((f) => [f.line, f.book]))

    const fallidos: string[] = []
    for (const { line, book } of locales) {
      if (book) {
        añadir(book, true)
        continue
      }
      const externo = porLinea.get(line) ?? null
      if (externo && externo.title && externo.author) añadir(externo, false)
      else fallidos.push(line)
    }
    setNoEncontrados(fallidos)
    setRaw('')
    setBuscando(false)
  }

  const añadirUno = async () => {
    const t = extra.trim()
    if (!t) return
    setBuscando(true)
    setError(null)
    const local = await enCatalogo(t)
    if (local) {
      añadir(local, true)
    } else {
      const found = await searchExternalBooks(t)
      if (found[0]?.title && found[0]?.author) añadir(found[0], false)
      else setNoEncontrados((n) => [...n, t])
    }
    setExtra('')
    setBuscando(false)
  }

  const abrir = async () => {
    if (!title.trim()) {
      setError('Ponle un título a la votación.')
      return
    }
    if (candidatos.length < 2) {
      setError('Hacen falta al menos 2 libros para votar.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('create_poll_with_books', {
      p_title: title.trim(),
      p_books: candidatos.map((c) => ({
        title: c.book.title,
        author: c.book.author,
        isbn: c.book.isbn,
        cover_url: c.book.coverUrl,
        cover_source: c.book.coverSource,
        synopsis: c.book.synopsis,
        synopsis_source: c.book.synopsisSource,
        buy_url: defaultBuyUrl(c.book),
        note: c.note.trim() || null,
      })),
      p_closes_at: closesAt ? new Date(closesAt + 'T23:59:00').toISOString() : null,
    })
    if (error) {
      setError(friendlyError(error, 'No se pudo abrir la votación.'))
      setBusy(false)
      return
    }
    setBusy(false)
    onCreated()
  }

  return (
    <div className="pollc">
      <label className="label-medium pollc__field">
        Título de la votación
        <input
          className="tz-input body-medium"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {candidatos.length === 0 ? (
        <>
          <label className="label-medium pollc__field">
            Los libros que propones
            <textarea
              className="tz-input body-medium pollc__paste"
              rows={4}
              placeholder={'9788466345347\n9788433998248\nStoner, John Williams'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <span className="body-small on-surface-variant">
              Un ISBN o un título por línea. Los busca por ti y crea las fichas que
              falten, sin que tengas que pasar por el catálogo.
            </span>
          </label>
          <div className="pollc__actions">
            <md-text-button onClick={onCancel}>Cancelar</md-text-button>
            <span style={{ flex: 1 }} />
            <md-filled-button
              disabled={buscando || !raw.trim() || undefined}
              onClick={() => void buscarPegados()}
            >
              {buscando ? 'Buscando…' : 'Buscar los libros'}
            </md-filled-button>
          </div>
        </>
      ) : (
        <>
          <div className="pollc__list">
            {candidatos.map((c, i) => (
              <div key={c.key} className="pollc__cand">
                <BookCover
                  title={c.book.title}
                  author={c.book.author}
                  coverUrl={c.book.coverUrl}
                  size="sm"
                />
                <div className="pollc__cand-main">
                  <span className="title-small serif">{c.book.title}</span>
                  <span className="body-small on-surface-variant">
                    {c.book.author}
                    {c.book.year ? ` · ${c.book.year}` : ''}
                    {c.enCatalogo ? ' · ya en el catálogo' : ''}
                  </span>
                  <input
                    className="tz-input body-small pollc__note"
                    placeholder="Por qué lo propones, opcional"
                    aria-label={`Por qué propones ${c.book.title}`}
                    value={c.note}
                    onChange={(e) =>
                      setCandidatos((cur) =>
                        cur.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  className="pollc__remove"
                  aria-label={`Quitar ${c.book.title}`}
                  onClick={() => setCandidatos((cur) => cur.filter((_, j) => j !== i))}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>

          {candidatos.length < 5 && (
            <div className="pollc__add">
              <input
                className="tz-input body-medium"
                placeholder="Añadir otro: ISBN o título…"
                aria-label="Añadir otro libro a la votación"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void añadirUno()}
              />
              <md-outlined-button
                disabled={buscando || !extra.trim() || undefined}
                onClick={() => void añadirUno()}
              >
                Añadir
              </md-outlined-button>
            </div>
          )}

          <label className="label-medium pollc__field pollc__when">
            Se vota hasta
            <input
              className="tz-input body-medium"
              type="date"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </label>

          <div className="pollc__actions">
            <md-text-button onClick={onCancel}>Cancelar</md-text-button>
            <span style={{ flex: 1 }} />
            <md-filled-button
              disabled={busy || candidatos.length < 2 || undefined}
              onClick={() => void abrir()}
            >
              {busy ? 'Abriendo…' : `Abrir votación (${candidatos.length})`}
            </md-filled-button>
          </div>
        </>
      )}

      {noEncontrados.length > 0 && (
        <p className="body-small pollc__warn" role="status">
          No encontré {noEncontrados.map((n) => `«${n}»`).join(', ')}. Prueba con el
          ISBN o escribe el título con el autor.
        </p>
      )}
      {error && (
        <p className="body-medium pollc__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
