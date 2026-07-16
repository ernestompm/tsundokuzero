import { supabase } from './supabase'

/**
 * Bloqueos (P2-13, migr. 020): ids de usuarios que YO he bloqueado.
 * Su contenido se filtra en cliente en feed, capítulos, hilos y
 * notificaciones. Si la migración no está ejecutada, devuelve el
 * conjunto vacío (la app funciona igual, sin bloqueos).
 */
export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
  return new Set((data ?? []).map((b) => b.blocked_id))
}
