import { supabase } from './supabase'
import type { Club } from './database.types'

/**
 * Caché del club, en memoria y por sesión de pestaña.
 *
 * Varios componentes del Inicio necesitan la misma fila de `clubs`: la
 * tira de pertenencia quiere el emblema, la próxima lectura quiere el
 * libro y la etiqueta de afiliado, el aviso de novedades comprueba
 * columnas. Cada uno la pedía por su cuenta, así que abrir el Inicio
 * disparaba cuatro consultas idénticas.
 *
 * Aquí se pide UNA vez y todos comparten la promesa. Cualquier cosa que
 * cambie el club llama a `olvidarClub()` para que la siguiente lectura
 * vuelva a ir al servidor.
 */
let pendiente: Promise<Club | null> | null = null

export function clubActual(): Promise<Club | null> {
  if (pendiente) return pendiente
  const p: Promise<Club | null> = (async () => {
    try {
      const { data } = await supabase
        .from('clubs')
        .select('*')
        .order('created_at')
        .limit(1)
        .maybeSingle()
      return (data as Club | null) ?? null
    } catch {
      // Un fallo no debe dejar la caché envenenada
      pendiente = null
      return null
    }
  })()
  pendiente = p
  return p
}

/** Tras cambiar algo del club: la próxima lectura vuelve al servidor. */
export function olvidarClub() {
  pendiente = null
}
