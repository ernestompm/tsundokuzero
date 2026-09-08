import { useEffect, useRef, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
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

const MAX = 5
const MIN = 2

interface Candidato {
  key: string
  book: ExternalBook
  enCatalogo: boolean
  note: string
}

/** «Libro de octubre»: el mes que viene, que es lo que se suele votar. */
function tituloPorDefecto() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `Libro de ${d.toLocaleDateString('es-ES', { month: 'long' })}`
}

/** Domingo que viene, en formato yyyy-mm-dd para el input date. */
function domingoQueViene() {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

function enPalabras(iso: string) {
  if (!iso) return 'sin fecha de cierre'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Crear la votación del próximo libro.
 *
 * DISEÑO. La primera versión era un formulario: pegabas ISBN en un campo
 * de texto monoespaciado, pulsabas «buscar» y luego rellenabas casillas.
 * Eso es pensar como una base de datos. El capitán no tiene tres ISBN en
 * la cabeza, tiene tres libros.
 *
 * Ahora hay un buscador vivo arriba, resultados con su portada y un botón
 * de añadir, y debajo la lista de candidatos como fichas de libro. El
 * nombre de la votación y la fecha de cierre vienen puestos y se cuentan
 * en una frase, no en dos campos; se cambian solo si hace falta.
 *
 * Pegar varios ISBN de golpe sigue funcionando: si el texto pegado trae
 * saltos de línea, se resuelven todos a la vez.
 */
export default function PollComposer({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(tituloPorDefecto())
  const [closesAt, setClosesAt] = useState(domingoQueViene())
  const [verAjustes, setVerAjustes] = useState(false)

  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<{ book: ExternalBook; enCatalogo: boolean }[]>([])
  const [buscando, setBuscando] = useState(false)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [pitchAbierto, setPitchAbierto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  /** Ficha del catálogo propio, para no duplicar libros ya existentes. */
  const buscarEnCatalogo = async (texto: string): Promise<ExternalBook | null> => {
    const isbn = asIsbn(texto)
    const like = `%${texto.replace(/[,()%]/g, ' ').trim()}%`
    const { data } = await supabase
      .from('books')
      .select('id, title, author, isbn, cover_url, cover_source, synopsis, buy_url')
      .or(isbn ? `isbn.eq.${isbn},title.ilike.${like}` : `title.ilike.${like},author.ilike.${like}`)
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

  const yaEsta = (lista: Candidato[], b: ExternalBook) =>
    lista.some(
      (c) =>
        `${c.book.title.toLowerCase()}|${c.book.author.toLowerCase()}` ===
        `${b.title.toLowerCase()}|${b.author.toLowerCase()}`,
    )

  const añadir = (b: ExternalBook, enCatalogo: boolean) => {
    setError(null)
    setCandidatos((cur) => {
      if (cur.length >= MAX || yaEsta(cur, b)) return cur
      return [...cur, { key: `${b.key}-${cur.length}`, book: b, enCatalogo, note: '' }]
    })
    setQ('')
    setResultados([])
  }

  // Búsqueda viva mientras escribes
  useEffect(() => {
    const term = q.trim()
    abortRef.current?.abort()
    if (term.length < 2 || term.includes('\n')) {
      setResultados([])
      setBuscando(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBuscando(true)
    const t = setTimeout(async () => {
      const [local, fuera] = await Promise.all([
        buscarEnCatalogo(term),
        searchExternalBooks(term, ctrl.signal),
      ])
      if (ctrl.signal.aborted) return
      const lista: { book: ExternalBook; enCatalogo: boolean }[] = []
      if (local) lista.push({ book: local, enCatalogo: true })
      for (const b of fuera) {
        if (!b.title || !b.author) continue
        const clave = `${b.title.toLowerCase()}|${b.author.toLowerCase()}`
        if (local && clave === `${local.title.toLowerCase()}|${local.author.toLowerCase()}`) continue
        lista.push({ book: b, enCatalogo: false })
        if (lista.length >= 6) break
      }
      setResultados(lista)
      setBuscando(false)
    }, 320)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  /** Pegar varias líneas de golpe sigue siendo posible. */
  const pegarVarios = async (texto: string) => {
    const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lineas.length < 2) return false
    setBuscando(true)
    setAviso(null)
    setQ('')
    const locales = await Promise.all(
      lineas.map(async (l) => ({ line: l, book: await buscarEnCatalogo(l) })),
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
      const ext = porLinea.get(line)
      if (ext?.title && ext.author) añadir(ext, false)
      else fallidos.push(line)
    }
    if (fallidos.length)
      setAviso(`No encontré ${fallidos.map((f) => `«${f}»`).join(', ')}. Búscalos por título.`)
    setBuscando(false)
    return true
  }

  const abrir = async () => {
    if (candidatos.length < MIN) {
      setError(`Elige al menos ${MIN} libros para que haya algo que votar.`)
      return
    }
    if (!title.trim()) {
      setError('La votación necesita un nombre.')
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

  const faltan = MIN - candidatos.length

  return (
    <div className="pollc">
      {/* ---------- Buscador, siempre arriba ---------- */}
      <div className="pollc__buscar">
        <span className="material-symbols-rounded pollc__lupa" aria-hidden="true">
          search
        </span>
        <input
          className="tz-input body-large pollc__input"
          placeholder="Busca un libro por título, autor o ISBN…"
          aria-label="Buscar un libro para proponerlo"
          value={q}
          disabled={candidatos.length >= MAX}
          onChange={(e) => setQ(e.target.value)}
          onPaste={(e) => {
            const texto = e.clipboardData.getData('text')
            if (texto.includes('\n')) {
              e.preventDefault()
              void pegarVarios(texto)
            }
          }}
        />
        {buscando && <md-circular-progress indeterminate class="pollc__spin" />}
      </div>

      {candidatos.length >= MAX ? (
        <p className="body-small on-surface-variant pollc__pista">
          Ya tienes {MAX} libros, que son los que caben en una votación. Quita alguno
          para cambiarlo.
        </p>
      ) : (
        <p className="body-small on-surface-variant pollc__pista">
          Escribe y elige. Si tienes los ISBN a mano, pégalos todos de golpe.
        </p>
      )}

      {/* ---------- Resultados vivos ---------- */}
      {resultados.length > 0 && (
        <div className="pollc__res">
          {resultados.map(({ book, enCatalogo }) => (
            <button
              key={book.key}
              type="button"
              className="pollc__res-item"
              onClick={() => añadir(book, enCatalogo)}
            >
              <BookCover
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                size="sm"
              />
              <span className="pollc__res-txt">
                <span className="title-small serif">{book.title}</span>
                <span className="body-small on-surface-variant">
                  {book.author}
                  {book.year ? ` · ${book.year}` : ''}
                  {enCatalogo ? ' · ya en el catálogo' : ''}
                </span>
              </span>
              <span className="material-symbols-rounded pollc__mas" aria-hidden="true">
                add
              </span>
            </button>
          ))}
        </div>
      )}

      {aviso && (
        <p className="body-small pollc__warn" role="status">
          {aviso}
        </p>
      )}

      {/* ---------- Los candidatos ---------- */}
      <div className="pollc__cabecera">
        <h3 className="title-small">Los candidatos</h3>
        <span className="label-medium on-surface-variant">
          {candidatos.length} de {MAX}
        </span>
      </div>

      {candidatos.length === 0 ? (
        <div className="pollc__vacio">
          <span className="material-symbols-rounded" aria-hidden="true">
            how_to_vote
          </span>
          <p className="body-medium on-surface-variant">
            Todavía no has propuesto ninguno. Busca arriba los libros entre los que
            quieres que elija el club.
          </p>
        </div>
      ) : (
        <div className="pollc__lista">
          {candidatos.map((c, i) => (
            <div key={c.key} className="pollc__cand">
              <div className="pollc__cand-fila">
                <span className="pollc__num label-medium">{i + 1}</span>
                <BookCover
                  title={c.book.title}
                  author={c.book.author}
                  coverUrl={c.book.coverUrl}
                  size="md"
                />
                <div className="pollc__cand-main">
                  <span className="title-small serif">{c.book.title}</span>
                  <span className="body-small on-surface-variant">
                    {c.book.author}
                    {c.book.year ? ` · ${c.book.year}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="pollc__remove"
                  aria-label={`Quitar ${c.book.title}`}
                  onClick={() => setCandidatos((cur) => cur.filter((_, j) => j !== i))}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">close</span>
                </button>
              </div>

              {/* El motivo va en su propia línea: en un móvil no cabe al
                  lado de la portada sin partirse en dos. */}
              {pitchAbierto === c.key || c.note ? (
                <input
                  className="tz-input body-small pollc__note"
                  placeholder="Por qué lo propones…"
                  aria-label={`Por qué propones ${c.book.title}`}
                  autoFocus={pitchAbierto === c.key && !c.note}
                  value={c.note}
                  onChange={(e) =>
                    setCandidatos((cur) =>
                      cur.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                    )
                  }
                  onBlur={() => setPitchAbierto(null)}
                />
              ) : (
                <button
                  type="button"
                  className="pollc__pitch label-medium"
                  onClick={() => setPitchAbierto(c.key)}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                  Añadir un motivo
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Nombre y cierre: una frase, no dos campos ---------- */}
      <div className="pollc__ajustes">
        {verAjustes ? (
          <>
            <label className="label-medium pollc__campo">
              Cómo se llama
              <input
                className="tz-input body-medium"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="label-medium pollc__campo">
              Se vota hasta
              <input
                className="tz-input body-medium pollc__fecha"
                type="date"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </label>
            <md-text-button onClick={() => setVerAjustes(false)}>Listo</md-text-button>
          </>
        ) : (
          <p className="body-medium">
            Se llamará <b>{title || 'sin nombre'}</b> y se vota hasta el{' '}
            <b>{enPalabras(closesAt)}</b>.{' '}
            <button type="button" className="pollc__cambiar" onClick={() => setVerAjustes(true)}>
              Cambiar
            </button>
          </p>
        )}
      </div>

      {error && (
        <p className="body-medium pollc__error" role="alert">
          {error}
        </p>
      )}

      <div className="pollc__actions">
        <md-text-button onClick={onCancel}>Cancelar</md-text-button>
        <span style={{ flex: 1 }} />
        <span className="body-small on-surface-variant pollc__faltan">
          {faltan > 0
            ? `Elige ${faltan} más`
            : `El club elegirá entre ${candidatos.length}`}
        </span>
        <md-filled-button
          disabled={busy || candidatos.length < MIN || undefined}
          onClick={() => void abrir()}
        >
          {busy ? 'Abriendo…' : 'Abrir la votación'}
        </md-filled-button>
      </div>
    </div>
  )
}
