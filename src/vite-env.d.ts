/// <reference types="vite/client" />

/** Versión de la app (package.json), inyectada por Vite en build. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_INVITE_CODE?: string
  readonly VITE_AUTH_GOOGLE_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
