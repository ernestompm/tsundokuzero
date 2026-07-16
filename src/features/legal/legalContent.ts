/**
 * Textos legales de la app (auditoría legal P0-1/P0-2).
 *
 * La fuente de verdad son los markdown de docs/legal/ — aquí solo se
 * importan (?raw) y se registran. Al cambiar SUSTANCIALMENTE los términos
 * o la privacidad, sube TERMS_VERSION: los usuarios existentes verán la
 * pantalla de re-aceptación (TermsGate) y quedará constancia con fecha
 * en la tabla `consents` (RGPD arts. 5.2 y 7).
 */
import avisoLegalRaw from '../../../docs/legal/01-aviso-legal.md?raw'
import privacidadRaw from '../../../docs/legal/02-politica-privacidad.md?raw'
import cookiesRaw from '../../../docs/legal/03-politica-cookies.md?raw'
import terminosRaw from '../../../docs/legal/04-terminos-condiciones.md?raw'

/** Versión vigente de términos+privacidad registrada en `consents`. */
export const TERMS_VERSION = 1

export interface LegalDoc {
  slug: string
  /** título de página (el H1 del markdown se descarta al renderizar) */
  title: string
  /** etiqueta corta para navegación y footers */
  short: string
  body: string
}

/** Quita el `# Título` inicial: la página pone el suyo propio. */
function stripH1(md: string): string {
  return md.replace(/^#\s+[^\n]+\n/, '')
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terminos: {
    slug: 'terminos',
    title: 'Términos y condiciones',
    short: 'Términos',
    body: stripH1(terminosRaw),
  },
  privacidad: {
    slug: 'privacidad',
    title: 'Política de privacidad',
    short: 'Privacidad',
    body: stripH1(privacidadRaw),
  },
  cookies: {
    slug: 'cookies',
    title: 'Política de cookies',
    short: 'Cookies',
    body: stripH1(cookiesRaw),
  },
  'aviso-legal': {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    short: 'Aviso legal',
    body: stripH1(avisoLegalRaw),
  },
}

export const LEGAL_ORDER = ['terminos', 'privacidad', 'cookies', 'aviso-legal']

/* ===== Datos del titular (tabla app_settings, migr. 019) =====
 * Los textos llevan tokens que se sustituyen al renderizar con lo que el
 * super admin rellena en Administración → Legal. Si un dato falta, el
 * token queda visible: señal inequívoca de que hay que completarlo. */

export const LEGAL_SETTING_KEYS = {
  ownerName: 'legal.owner_name',
  nif: 'legal.nif',
  address: 'legal.address',
  contactEmail: 'legal.contact_email',
  privacyEmail: 'legal.privacy_email',
  registry: 'legal.registry',
  updatedAt: 'legal.updated_at',
} as const

export type LegalSettings = Partial<
  Record<keyof typeof LEGAL_SETTING_KEYS, string>
>

/** app_settings (key → value) → LegalSettings tipado. */
export function settingsFromRows(
  rows: { key: string; value: string }[],
): LegalSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const out: LegalSettings = {}
  for (const [field, key] of Object.entries(LEGAL_SETTING_KEYS)) {
    const v = byKey.get(key)?.trim()
    if (v) out[field as keyof typeof LEGAL_SETTING_KEYS] = v
  }
  return out
}

/** fecha ISO (yyyy-mm-dd) → «16 de julio de 2026» */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
}

/** Sustituye los tokens del texto legal por los datos del titular. */
export function fillLegalBody(body: string, s: LegalSettings): string {
  let out = body

  // La línea de inscripción registral solo aplica a sociedades:
  // sin valor, desaparece entera (una persona física no la necesita).
  out = s.registry
    ? out.replace('[INSCRIPCIÓN REGISTRAL]', s.registry)
    : out.replace(/^.*\[INSCRIPCIÓN REGISTRAL\].*\n?/m, '')

  const pairs: [string, string | undefined][] = [
    ['[NOMBRE O RAZÓN SOCIAL]', s.ownerName],
    ['[NIF]', s.nif],
    ['[DOMICILIO]', s.address],
    ['[EMAIL DE CONTACTO]', s.contactEmail],
    // sin buzón específico de privacidad, se usa el de contacto
    ['[EMAIL DE PRIVACIDAD]', s.privacyEmail ?? s.contactEmail],
    ['[FECHA DE PUBLICACIÓN]', s.updatedAt ? formatDate(s.updatedAt) : undefined],
  ]
  for (const [token, value] of pairs) {
    if (value) out = out.split(token).join(value)
  }
  return out
}
