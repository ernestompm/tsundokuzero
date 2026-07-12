import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * true cuando .env.local tiene las credenciales del proyecto Supabase.
 * Mientras no exista el proyecto, la app arranca en modo "pendiente de
 * configuración" en lugar de romperse.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'https://pending.supabase.co',
  anonKey ?? 'pending-anon-key',
)
