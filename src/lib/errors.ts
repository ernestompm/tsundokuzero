/**
 * Catálogo central de errores (auditoría UX A-04).
 *
 * Traduce los mensajes técnicos de Supabase/PostgREST a español claro y
 * evita que diagnósticos internos (RLS, migraciones, columnas) lleguen al
 * usuario final. El mensaje crudo se conserva en consola para depurar.
 */

const FALLBACK = 'Algo no ha ido bien. Inténtalo de nuevo en unos segundos.'

const MAP: [RegExp, string][] = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [
    /email not confirmed/i,
    'Tu correo aún no está verificado. Revisa tu bandeja de entrada.',
  ],
  [/user already registered/i, 'Ya existe una cuenta con ese correo.'],
  [/password should be/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [
    /same password|different from the old/i,
    'La contraseña nueva debe ser distinta de la actual.',
  ],
  [
    /rate limit|too many requests|security purposes/i,
    'Demasiados intentos. Espera un minuto y vuelve a probar.',
  ],
  [
    /failed to fetch|networkerror|load failed|network request/i,
    'No hay conexión. Comprueba tu red e inténtalo otra vez.',
  ],
  [
    /row-level security|permission denied|not allowed|violates/i,
    'No tienes permiso para hacer esto.',
  ],
  [/duplicate key/i, 'Eso ya existe: revisa que no esté repetido.'],
  [/jwt|refresh token|session/i, 'Tu sesión ha caducado. Vuelve a entrar.'],
]

/**
 * Convierte cualquier error en un mensaje apto para el usuario.
 * `fallback` permite contextualizar («No se pudo publicar…») manteniendo
 * la traducción de los casos conocidos.
 */
export function friendlyError(err: unknown, fallback = FALLBACK): string {
  const raw =
    typeof err === 'string'
      ? err
      : ((err as { message?: string } | null)?.message ?? '')
  if (raw) console.error('[tz] error:', raw)
  for (const [re, msg] of MAP) if (re.test(raw)) return msg
  return fallback
}
