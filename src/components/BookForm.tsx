import { useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import './BookForm.css'

/**
 * Alta de libro guiada (admin y capitanes). Autorrelleno por ISBN con
 * Google Books → Open Library (título, autor, sinopsis, portada). Los
 * CAPÍTULOS son siempre manuales: ninguna API pública los ofrece.
 */
export default function BookForm({
  onCreated,
  onCancel,
}: {
  onCreated?: () => void
  onCancel?: () => void
}) {
  const [isbn, setIsbn] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [cover, setCover] = useState('')
  // Procedencia de portada y sinopsis (LPI, P1-8): se guarda en el libro
  const [coverSource, setCoverSource] = useState<string | null>(null)
  const [synopsisSource, setSynopsisSource] = useState<string | null>(null)
  const [buy, setBuy] = useState('')
  const [chapters, setChapters] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lookupIsbn = async () => {
    const clean = isbn.replace(/[^0-9Xx]/g, '')
    if (clean.length < 10) {
      setLookupMsg('Escribe un ISBN válido (10 o 13 dígitos).')
      return
    }
    setLookupBusy(true)
    setLookupMsg(null)
    try {
      let fTitle = ''
      let fAuthor = ''
      let fSynopsis = ''
      let fCover = ''
      let fCoverSource: string | null = null
      let fSynopsisSource: string | null = null

      // 1) Google Books
      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}`,
        )
        const data = await res.json()
        const v = data?.items?.[0]?.volumeInfo
        if (v) {
          fTitle = v.title ?? ''
          if (v.subtitle) fTitle += ` — ${v.subtitle}`
          fAuthor = (v.authors ?? []).join(' y ')
          fSynopsis = v.description ?? ''
          if (fSynopsis) fSynopsisSource = 'Google Books'
          fCover = (v.imageLinks?.thumbnail ?? '').replace('http://', 'https://')
          if (fCover) fCoverSource = 'Google Books'
        }
      } catch {
        /* seguimos con Open Library */
      }

      // 2) Open Library: datos básicos
      let olWorkKey: string | null = null
      if (!fTitle || !fAuthor || !fCover) {
        try {
          const res = await fetch(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&jscmd=data&format=json`,
          )
          const data = await res.json()
          const v = data?.[`ISBN:${clean}`]
          if (v) {
            fTitle = fTitle || v.title || ''
            fAuthor =
              fAuthor ||
              (v.authors ?? [])
                .map((a: { name: string }) => a.name)
                .join(' y ')
            if (!fCover && (v.cover?.large || v.cover?.medium)) {
              fCover = v.cover.large || v.cover.medium
              fCoverSource = 'Open Library'
            }
          }
        } catch {
          /* nada */
        }
      }

      // 3) Open Library: sinopsis desde la ficha de la OBRA
      if (!fSynopsis) {
        try {
          const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`)
          if (res.ok) {
            const ed = await res.json()
            olWorkKey = ed?.works?.[0]?.key ?? null
            const edDesc = ed?.description
            fSynopsis =
              typeof edDesc === 'string' ? edDesc : (edDesc?.value ?? '')
            if (!fSynopsis && olWorkKey) {
              const wres = await fetch(
                `https://openlibrary.org${olWorkKey}.json`,
              )
              if (wres.ok) {
                const work = await wres.json()
                const d = work?.description
                fSynopsis = typeof d === 'string' ? d : (d?.value ?? '')
              }
            }
            if (fSynopsis) fSynopsisSource = 'Open Library'
          }
        } catch {
          /* nada */
        }
      }

      // 4) Portada por ISBN (verificada) como último recurso
      if (!fCover) {
        try {
          const url = `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`
          const res = await fetch(url, { method: 'HEAD' })
          if (res.ok) {
            fCover = url
            fCoverSource = 'Open Library'
          }
        } catch {
          /* nada */
        }
      }

      if (!fTitle && !fAuthor) {
        setLookupMsg(
          'Ese ISBN no aparece en Google Books ni Open Library (pasa con muchas ediciones españolas). Rellena los datos a mano.',
        )
        return
      }

      if (fTitle) setTitle(fTitle)
      if (fAuthor) setAuthor(fAuthor)
      if (fSynopsis) {
        setSynopsis(fSynopsis)
        setSynopsisSource(fSynopsisSource)
      }
      if (fCover) {
        setCover(fCover)
        setCoverSource(fCoverSource)
      }
      setBuy(`https://www.amazon.es/s?k=${clean}`)

      const found: string[] = []
      const missing: string[] = []
      ;(fTitle ? found : missing).push('título')
      ;(fAuthor ? found : missing).push('autor')
      ;(fSynopsis ? found : missing).push('sinopsis')
      ;(fCover ? found : missing).push('portada')
      setLookupMsg(
        `Encontrado: ${found.join(', ')}.` +
          (missing.length ? ` Sin datos de: ${missing.join(', ')} — rellénalo a mano.` : '') +
          ' Los capítulos van siempre a mano.' +
          (fSynopsis
            ? // auditoría B-05: sin emoji en el copy
              ' Atención: la sinopsis importada es texto editorial con copyright; reescríbela con tus palabras antes de crear el libro.'
            : ''),
      )
    } finally {
      setLookupBusy(false)
    }
  }

  const create = async () => {
    const t = title.trim()
    const a = author.trim()
    const chapterTitles = chapters
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!t || !a || chapterTitles.length === 0) {
      setError('Título, autor y al menos un capítulo (uno por línea).')
      return
    }
    setBusy(true)
    setError(null)
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        title: t,
        author: a,
        cover_url: cover.trim() || null,
        // Procedencia (LPI): 'Manual' cuando la URL/texto lo puso el editor
        cover_source: cover.trim() ? (coverSource ?? 'Manual') : null,
        synopsis: synopsis.trim() || null,
        synopsis_source: synopsis.trim() ? (synopsisSource ?? 'Propia') : null,
        buy_url: buy.trim() || null,
        total_chapters: chapterTitles.length,
      })
      .select()
      .single()
    if (bookError || !book) {
      setError(
        bookError?.message.includes('row-level security')
          ? 'No tienes cupo: los capitanes pueden crear 3 libros por capitanía.'
          : friendlyError(bookError, 'No se pudo crear el libro.'), // auditoría A-04
      )
      setBusy(false)
      return
    }
    const { error: chError } = await supabase.from('chapters').insert(
      chapterTitles.map((label, i) => ({
        book_id: book.id,
        number: i + 1,
        label,
      })),
    )
    if (chError)
      setError(
        // auditoría A-04
        friendlyError(
          chError,
          'El libro se creó, pero no se pudieron guardar los capítulos.',
        ),
      )
    else {
      setIsbn('')
      setTitle('')
      setAuthor('')
      setSynopsis('')
      setCover('')
      setBuy('')
      setChapters('')
      setLookupMsg(null)
      onCreated?.()
    }
    setBusy(false)
  }

  const chapterCount = chapters.split('\n').filter((l) => l.trim()).length

  return (
    <div className="bookform">
      <p className="body-small on-surface-variant">
        Escribe el ISBN y pulsa Buscar para autorrellenar título, autor,
        sinopsis y portada. Los capítulos se pegan a mano (uno por línea, en
        orden).
      </p>

      <div className="bookform__isbn">
        <input
          className="bookform__input body-medium"
          placeholder="ISBN — p. ej. 978-84-663-8033-1"
          aria-label="ISBN del libro" /* auditoría A-08 */
          inputMode="numeric"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void lookupIsbn()}
        />
        <md-outlined-button
          disabled={lookupBusy || undefined}
          onClick={() => void lookupIsbn()}
        >
          <span slot="icon" className="material-symbols-rounded" aria-hidden="true">search</span>
          {lookupBusy ? 'Buscando…' : 'Buscar'}
        </md-outlined-button>
      </div>
      {lookupMsg && <p className="body-small bookform__msg">{lookupMsg}</p>}
      {error && <p className="body-small bookform__error">{error}</p>}

      <label className="bookform__field label-medium">
        Título *
        <input
          className="bookform__input body-medium"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="bookform__field label-medium">
        Autor *
        <input
          className="bookform__input body-medium"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
      </label>
      <label className="bookform__field label-medium">
        Sinopsis{synopsisSource ? ` — importada de ${synopsisSource}: reescríbela` : ''}
        <textarea
          className="bookform__input body-medium"
          rows={3}
          value={synopsis}
          onChange={(e) => {
            setSynopsis(e.target.value)
            // al reescribirla pasa a ser redacción propia
            setSynopsisSource(null)
          }}
        />
      </label>
      <div className="bookform__row">
        <label className="bookform__field label-medium" style={{ flex: 1 }}>
          URL de portada
          <input
            className="bookform__input body-medium"
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
            className="bookform__input body-medium"
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
      <label className="bookform__field label-medium">
        Capítulos * — un título por línea, en orden ({chapterCount})
        <textarea
          className="bookform__input body-medium"
          rows={6}
          placeholder={'Cero horas\nLa señora Elm\nLa biblioteca de la medianoche\n…'}
          value={chapters}
          onChange={(e) => setChapters(e.target.value)}
        />
      </label>

      <div className="bookform__actions">
        {onCancel && <md-text-button onClick={onCancel}>Cancelar</md-text-button>}
        <md-filled-button disabled={busy || undefined} onClick={() => void create()}>
          Crear libro
        </md-filled-button>
      </div>
    </div>
  )
}
