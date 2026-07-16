import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'

interface AuthState {
  session: Session | null
  /** null mientras el usuario aún no ha completado el onboarding */
  profile: Profile | null
  /** true hasta conocer la sesión inicial (y su perfil, si la hay) */
  loading: boolean
  /** claim is_super_admin del JWT (app_metadata, no editable por el usuario) */
  isSuperAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * 'error' = fallo de red/servidor (NO significa que el perfil no exista).
 * Distinguirlo evita expulsar a onboarding a usuarios ya registrados
 * cuando una petición falla un instante (típico en móvil).
 */
async function fetchProfile(
  userId: string,
): Promise<Profile | null | 'error'> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return error ? 'error' : data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRef = useRef<Profile | null>(null)

  const applyProfile = (p: Profile | null) => {
    profileRef.current = p
    setProfile(p)
  }

  useEffect(() => {
    let cancelled = false

    const loadInitial = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(session)
      if (session) {
        let p = await fetchProfile(session.user.id)
        if (p === 'error') {
          // Reintento breve: un fallo transitorio no debe parecer "sin perfil"
          await new Promise((r) => setTimeout(r, 800))
          p = await fetchProfile(session.user.id)
        }
        if (!cancelled && p !== 'error') applyProfile(p)
      }
      if (!cancelled) setLoading(false)
    }
    void loadInitial()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        applyProfile(null)
        return
      }
      // En refrescos de token del mismo usuario no hace falta re-consultar
      if (
        profileRef.current &&
        profileRef.current.id === newSession.user.id
      )
        return
      // fuera del callback: el SDK no permite awaits dentro
      void fetchProfile(newSession.user.id).then((p) => {
        // En error conservamos lo que hubiera: jamás degradar a "sin perfil"
        if (!cancelled && p !== 'error') applyProfile(p)
      })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    const p = await fetchProfile(session.user.id)
    if (p !== 'error') applyProfile(p)
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const isSuperAdmin = session?.user.app_metadata?.is_super_admin === true

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isSuperAdmin,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
