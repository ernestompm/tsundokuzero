/**
 * Búsqueda de libros en fuentes públicas (Google Books → Open Library).
 *
 * Un único punto para «encontrar un libro por lo que sea»: título, autor
 * o ISBN. Lo usan la hoja «Añadir libro» (cualquier lector) y el
 * formulario de alta de Admin/capitanía. Las dos fuentes están en el
 * connect-src de la CSP (vercel.json).
 *
 * Los CAPÍTULOS nunca vienen de aquí: ninguna API pública los ofrece.
 */

export interface ExternalBook {
  /** clave estable para React y deduplicado en cliente */
  key: string
  title: string
  author: string
  isbn: string | null
  coverUrl: string | null
  coverSource: string | null
  synopsis: string | null
  synopsisSource: string | null
  year: number | null
  pageCount: number | null
  /** clave de OBRA en Open Library (para pedir la sinopsis al elegirla) */
  olWorkKey: string | null
}

/** Devuelve el ISBN limpio (10 o 13) si el texto parece un ISBN. */
export function asIsbn(raw: string): string | null {
  const clean = raw.replace(/[^0-9Xx]/g, '').toUpperCase()
  if (clean.length === 10 || clean.length === 13) {
    // al menos el 80 % dígitos: evita confundir «Xxx» con un ISBN
    const digits = clean.replace(/[^0-9]/g, '').length
    if (digits >= clean.length - 1) return clean
  }
  return null
}

const https = (u: string | undefined | null) =>
  u ? u.replace(/^http:\/\//, 'https://') : null

interface GoogleVolume {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    pageCount?: number
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

function fromGoogle(v: GoogleVolume): ExternalBook | null {
  const info = v.volumeInfo
  if (!info?.title) return null
  const ids = info.industryIdentifiers ?? []
  const isbn =
    ids.find((i) => i.type === 'ISBN_13')?.identifier ??
    ids.find((i) => i.type === 'ISBN_10')?.identifier ??
    null
  const cover = https(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail)
  const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  return {
    key: `g:${v.id}`,
    title: info.subtitle ? `${info.title} — ${info.subtitle}` : info.title,
    author: (info.authors ?? []).join(' y '),
    isbn,
    coverUrl: cover,
    coverSource: cover ? 'Google Books' : null,
    synopsis: info.description ?? null,
    synopsisSource: info.description ? 'Google Books' : null,
    year: Number.isFinite(year) ? year : null,
    pageCount: info.pageCount ?? null,
    olWorkKey: null,
  }
}

interface OlDoc {
  key: string
  title?: string
  author_name?: string[]
  isbn?: string[]
  cover_i?: number
  first_publish_year?: number
  number_of_pages_median?: number
}

function fromOpenLibrary(d: OlDoc): ExternalBook | null {
  if (!d.title) return null
  return {
    key: `ol:${d.key}`,
    title: d.title,
    // Solo el primero: Open Library mete a traductores como «autores»
    author: d.author_name?.[0] ?? '',
    isbn: d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0] ?? null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    coverSource: d.cover_i ? 'Open Library' : null,
    synopsis: null,
    synopsisSource: null,
    year: d.first_publish_year ?? null,
    pageCount: d.number_of_pages_median ?? null,
    olWorkKey: d.key,
  }
}

async function json<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Busca por texto libre o ISBN. Google Books primero (mejor cobertura de
 * ediciones en español y sinopsis); Open Library completa o sustituye si
 * Google no devuelve nada. Nunca lanza: sin red → lista vacía.
 */
export async function searchExternalBooks(
  query: string,
  signal?: AbortSignal,
): Promise<ExternalBook[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const isbn = asIsbn(q)
  const results: ExternalBook[] = []

  const gq = isbn ? `isbn:${isbn}` : q
  const g = await json<{ items?: GoogleVolume[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gq)}&maxResults=8&printType=books`,
    signal,
  )
  for (const v of g?.items ?? []) {
    const b = fromGoogle(v)
    if (b) results.push(b)
  }

  if (results.length < 3) {
    const url = isbn
      ? `https://openlibrary.org/search.json?isbn=${isbn}&limit=5&fields=key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median`
      : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median`
    const ol = await json<{ docs?: OlDoc[] }>(url, signal)
    for (const d of ol?.docs ?? []) {
      const b = fromOpenLibrary(d)
      if (b) results.push(b)
    }
  }

  // Portada por ISBN verificada como último recurso (patrón del alta v1)
  if (isbn && results.length === 0) {
    try {
      const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
      const res = await fetch(url, { method: 'HEAD', signal })
      if (res.ok)
        results.push({
          key: `isbn:${isbn}`,
          title: '',
          author: '',
          isbn,
          coverUrl: url,
          coverSource: 'Open Library',
          synopsis: null,
          synopsisSource: null,
          year: null,
          pageCount: null,
          olWorkKey: null,
        })
    } catch {
      /* nada */
    }
  }

  // Deduplicado en cliente por título+autor normalizados: las distintas
  // ediciones de un mismo libro son ruido aquí (se queda la primera, que
  // suele ser la mejor documentada).
  const seen = new Set<string>()
  return results.filter((b) => {
    const k = `${normalize(b.title)}|${normalize(b.author)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** minúsculas, sin acentos, sin subtítulo, espacios colapsados */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s[—:-]\s/)[0]
    .replace(/[^a-z0-9\u0370-\uffff]+/g, ' ')
    .trim()
}

/** Completa la sinopsis de un resultado de Open Library (ficha de la obra). */
export async function enrichSynopsis(book: ExternalBook): Promise<ExternalBook> {
  if (book.synopsis || !book.olWorkKey) return book
  const work = await json<{ description?: string | { value?: string } }>(
    `https://openlibrary.org${book.olWorkKey}.json`,
  )
  const d = work?.description
  const text = typeof d === 'string' ? d : (d?.value ?? null)
  return text ? { ...book, synopsis: text, synopsisSource: 'Open Library' } : book
}

/** Enlace de compra por defecto: búsqueda en Amazon.es por ISBN o título. */
export function defaultBuyUrl(book: Pick<ExternalBook, 'isbn' | 'title' | 'author'>) {
  const k = book.isbn ?? `${book.title} ${book.author}`.trim()
  return k ? `https://www.amazon.es/s?k=${encodeURIComponent(k)}` : ''
}
