import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/switch/switch.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'

interface AdminUser {
  id: string
  username: string
  display_name: string
  email: string
  is_super_admin: boolean
  club_role: string | null
  created_at: string
}

export default function AdminPage() {
  const { session, isSuperAdmin, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    else setUsers((data as AdminUser[] | null) ?? [])
  }, [])

  useEffect(() => {
    if (isSuperAdmin) void load()
  }, [isSuperAdmin, load])

  if (loading) return null
  if (!isSuperAdmin) return <Navigate to="/" replace />

  const toggleAdmin = async (u: AdminUser) => {
    setSavingId(u.id)
    setError(null)
    const { error } = await supabase.rpc('admin_set_super_admin', {
      target: u.id,
      value: !u.is_super_admin,
    })
    if (error) setError(error.message)
    else await load()
    setSavingId(null)
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 className="headline-small">Gestión de usuarios</h2>
        <p className="body-medium on-surface-variant">
          Panel de super administración. Los cambios de rol se aplican cuando el
          usuario vuelve a iniciar sesión.
        </p>
      </div>

      {error && (
        <p
          className="body-medium"
          style={{
            background: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            padding: '12px 16px',
            borderRadius: 'var(--md-sys-shape-corner-medium)',
          }}
        >
          {error}
        </p>
      )}

      {users === null ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
          <md-circular-progress indeterminate />
        </div>
      ) : users.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Todavía no hay usuarios registrados.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <li
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--md-sys-shape-corner-large)',
                background: 'var(--md-sys-color-surface-container)',
              }}
            >
              <div
                aria-hidden
                className="label-large"
                style={{
                  width: 40,
                  height: 40,
                  flex: 'none',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                }}
              >
                {u.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title-small">
                  {u.display_name}{' '}
                  {u.club_role === 'captain' && (
                    <span
                      className="label-small"
                      style={{ color: 'var(--md-sys-color-primary)' }}
                    >
                      ★ capitán
                    </span>
                  )}
                </div>
                <div
                  className="body-small on-surface-variant"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  @{u.username} · {u.email}
                </div>
              </div>
              <label
                className="label-medium"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <md-switch
                  aria-label={`Super admin: ${u.display_name}`}
                  selected={u.is_super_admin || undefined}
                  disabled={
                    savingId === u.id || u.id === session?.user.id || undefined
                  }
                  onChange={() => void toggleAdmin(u)}
                />
                admin
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
