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
      // `my_club()` devuelve MI club, no «el primero de la tabla»: desde
      // que se pueden fundar clubes nuevos (migr. 038), lo segundo ya no
      // significa nada. Si la migración aún no está, se cae al método de
      // siempre para no dejar la app en blanco.
      const { data, error } = await supabase.rpc('my_club')
      if (!error) return ((data as Club[] | null) ?? [])[0] ?? null

      const { data: fallback } = await supabase
        .from('clubs')
        .select('*')
        .order('created_at')
        .limit(1)
        .maybeSingle()
      return (fallback as Club | null) ?? null
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
