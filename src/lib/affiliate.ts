/**
 * Enlaces de compra con etiqueta de afiliado (migr. 032).
 *
 * La idea es que el club pueda sostenerse sin cobrar a sus miembros: si
 * alguien compra el libro por el enlace, una parte vuelve al club. La
 * etiqueta la pone el administrador en los ajustes del club.
 *
 * Solo se toca Amazon, que es donde apuntan los enlaces que genera la
 * app. Cualquier otra tienda se deja tal cual.
 */
export function conAfiliado(url: string | null, tag: string | null | undefined): string | null {
  if (!url) return null
  if (!tag || !tag.trim()) return url
  try {
    const u = new URL(url)
    if (!/(^|\.)amazon\./i.test(u.hostname)) return url
    // Si ya trae etiqueta, se respeta: puede ser de una campaña concreta
    if (u.searchParams.has('tag')) return url
    u.searchParams.set('tag', tag.trim())
    return u.toString()
  } catch {
    return url
  }
}

/** Aviso obligatorio cuando se usa un enlace de afiliado. */
export const AVISO_AFILIADO =
  'Enlace de afiliado: si compras por aquí, el club se lleva una pequeña comisión sin coste para ti.'
