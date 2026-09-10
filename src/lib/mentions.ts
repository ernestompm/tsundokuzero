import { supabase } from './supabase'

export interface Mencionable {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

/**
 * A quién puedes mencionar: la gente de tu club. Se pide una vez y se
 * comparte, porque el autocompletado se abre muchas veces por sesión y no
 * tiene sentido preguntarlo en cada pulsación.
 */
let pendiente: Promise<Mencionable[]> | null = null

export function mencionables(): Promise<Mencionable[]> {
  if (pendiente) return pendiente
  const p: Promise<Mencionable[]> = (async () => {
    try {
      const { data } = await supabase.rpc('mentionables')
      return (data as Mencionable[] | null) ?? []
    } catch {
      pendiente = null
      return []
    }
  })()
  pendiente = p
  return p
}

/**
 * Formato de usuario fijado en el esquema: minúsculas, dígitos y guion
 * bajo. La arroba tiene que ir al principio o detrás de algo que no sea
 * letra, número ni otra arroba: si no, «hola@dominio.com» se leería como
 * una mención a «dominio».
 */
export const MENCION_RE = /(^|[^\w@])@([a-z0-9_]{3,20})/g

/**
 * Parte un texto en trozos sueltos y menciones, para poder pintar las
 * menciones como enlaces sin usar innerHTML.
 */
export function partirMenciones(
  texto: string,
): { tipo: 'texto' | 'mencion'; valor: string }[] {
  const trozos: { tipo: 'texto' | 'mencion'; valor: string }[] = []
  let ultimo = 0
  const re = new RegExp(MENCION_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    // m[1] es el carácter de delante, que no forma parte de la mención
    const inicio = m.index + m[1].length
    if (inicio > ultimo) trozos.push({ tipo: 'texto', valor: texto.slice(ultimo, inicio) })
    trozos.push({ tipo: 'mencion', valor: m[2] })
    ultimo = inicio + 1 + m[2].length
  }
  if (ultimo < texto.length) trozos.push({ tipo: 'texto', valor: texto.slice(ultimo) })
  return trozos
}

/**
 * ¿Está el cursor escribiendo una mención? Devuelve lo tecleado tras la
 * arroba, o null si no toca sugerir nada.
 */
export function mencionEnCurso(texto: string, caret: number): string | null {
  const antes = texto.slice(0, caret)
  const m = antes.match(/(?:^|\s)@([a-z0-9_]{0,20})$/i)
  return m ? m[1].toLowerCase() : null
}

/** Sustituye la mención a medio escribir por el usuario elegido. */
export function insertarMencion(
  texto: string,
  caret: number,
  username: string,
): { texto: string; caret: number } {
  const antes = texto.slice(0, caret)
  const m = antes.match(/(?:^|\s)@([a-z0-9_]{0,20})$/i)
  if (!m) return { texto, caret }
  const inicio = antes.length - m[1].length - 1
  const nuevo = `${texto.slice(0, inicio)}@${username} ${texto.slice(caret)}`
  return { texto: nuevo, caret: inicio + username.length + 2 }
}
