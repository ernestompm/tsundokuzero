import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/switch/switch.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, BookCover } from '../../components/ui'
import BookForm from '../../components/BookForm'
import PageHeader from '../../components/PageHeader'
import { timeAgo } from '../../lib/time'
import { KIND_LABEL } from '../book/chapterTypes'
import {
  LEGAL_SETTING_KEYS,
  LEGAL_ORDER,
  LEGAL_DOCS,
} from '../legal/legalContent'
import type { Book, DiscussionKind, Report } from '../../lib/database.types'
import './admin.css'

type Tab = 'summary' | 'users' | 'content' | 'reports' | 'books' | 'legal'

export default function AdminPage() {
  const { isSuperAdmin, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('summary')

  if (loading) return null
  if (!isSuperAdmin) return <Navigate to="/" replace />

  return (
    <section className="admin">
      <PageHeader title="Administración" sub="Resumen, usuarios, moderación y catálogo" />
      <div className="admin-tabs">
        {(
          [
            ['summary', 'Resumen'],
            ['users', 'Usuarios'],
            ['content', 'Moderación'],
            ['reports', 'Denuncias'],
            ['books', 'Libros'],
            ['legal', 'Legal'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab label-large${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'content' && <ContentTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'books' && <BooksTab />}
      {tab === 'legal' && <LegalTab />}
    </section>
  )
}

/* ===================== Resumen ===================== */

interface AdminStats {
  users: number
  ideas: number
  replies: number
  books: number
  ideas_week: number
  new_users_week: number
}

function SummaryTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error }) => {
      if (error) setError(error.message)
      else setStats(((data as AdminStats[] | null) ?? [])[0] ?? null)
    })
  }, [])

  if (!stats) return <Spinner error={error} />

  const tiles = [
    { icon: 'group', value: stats.users, label: 'usuarios', sub: `+${stats.new_users_week} esta semana` },
    { icon: 'forum', value: stats.ideas, label: 'ideas', sub: `+${stats.ideas_week} esta semana` },
    { icon: 'chat_bubble', value: stats.replies, label: 'respuestas', sub: '' },
    { icon: 'menu_book', value: stats.books, label: 'libros', sub: '' },
  ]

  return (
    <div className="admin-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="admin-tile">
          <span className="material-symbols-rounded admin-tile__icon">
            {t.icon}
          </span>
          <span className="headline-medium admin-tile__value">{t.value}</span>
          <span className="body-small on-surface-variant">{t.label}</span>
          {t.sub && (
            <span className="label-small admin-tile__sub">{t.sub}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Usuarios ===================== */

interface AdminUser {
  id: string
  username: string
  display_name: string
  email: string
  is_super_admin: boolean
  club_role: string | null
  created_at: string
}

function UsersTab() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // Código de invitación (validado en servidor, migr. 020)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    else setUsers((data as AdminUser[] | null) ?? [])

    const { data: code, error: codeError } = await supabase.rpc(
      'admin_get_invite_code',
    )
    if (codeError) {
      setInviteMsg(
        /admin_get_invite_code|function/i.test(codeError.message)
          ? 'Falta ejecutar la migración 020 (invitación en servidor).'
          : codeError.message,
      )
    } else {
      setInviteCode((code as string | null) ?? '')
      if (!code)
        setInviteMsg(
          '⚠️ Sin código configurado: nadie nuevo puede completar el registro.',
        )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveInviteCode = async () => {
    setInviteBusy(true)
    setInviteMsg(null)
    const { error } = await supabase.rpc('admin_set_invite_code', {
      code: inviteCode.trim(),
    })
    setInviteBusy(false)
    setInviteMsg(
      error
        ? error.message
        : inviteCode.trim()
          ? '✅ Código guardado. Recuerda actualizar VITE_INVITE_CODE en Vercel para que el formulario de alta pida el mismo.'
          : '⚠️ Código vacío: el registro queda cerrado.',
    )
  }

  const toggleAdmin = async (u: AdminUser) => {
    setSavingId(u.id)
    const { error } = await supabase.rpc('admin_set_super_admin', {
      target: u.id,
      value: !u.is_super_admin,
    })
    if (error) setError(error.message)
    else await load()
    setSavingId(null)
  }

  const expel = async (u: AdminUser) => {
    if (
      !window.confirm(
        `¿Expulsar a ${u.display_name} (@${u.username})? Se borra su cuenta y TODO su contenido. No se puede deshacer.`,
      )
    )
      return
    setSavingId(u.id)
    const { error } = await supabase.rpc('admin_delete_user', { target: u.id })
    if (error) setError(error.message)
    else await load()
    setSavingId(null)
  }

  if (users === null) return <Spinner error={error} />

  const q = search.trim().toLowerCase()
  const visible = q
    ? users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    : users

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}

      {/* Invitación validada en servidor (P1-7) */}
      <div className="admin-card">
        <span className="label-medium">Código de invitación</span>
        <p className="body-small on-surface-variant" style={{ margin: '4px 0 8px' }}>
          Se exige en servidor al completar el registro. Vacío = registro
          cerrado.
        </p>
        <div className="admin-book__row">
          <input
            className="admin-input body-medium"
            placeholder="p. ej. tsundoku-2026"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <md-outlined-button
            disabled={inviteBusy || undefined}
            onClick={() => void saveInviteCode()}
          >
            Guardar
          </md-outlined-button>
        </div>
        {inviteMsg && <p className="body-small" style={{ marginTop: 6 }}>{inviteMsg}</p>}
      </div>

      <input
        className="admin-search body-medium"
        placeholder="Buscar por nombre, @usuario o email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visible.length === 0 && (
        <p className="body-medium on-surface-variant">Sin resultados.</p>
      )}
      {visible.map((u) => (
        <div key={u.id} className="admin-row">
          <Avatar name={u.display_name} size={40} />
          <div className="admin-row__main">
            <span className="title-small">
              {u.display_name}{' '}
              {u.club_role === 'captain' && (
                <span className="label-small" style={{ color: 'var(--md-sys-color-primary)' }}>
                  ★ capitán
                </span>
              )}
            </span>
            <span className="body-small on-surface-variant admin-ellipsis">
              @{u.username} · {u.email} · {timeAgo(u.created_at)}
            </span>
          </div>
          <label className="admin-switch label-small">
            <md-switch
              aria-label={`Admin: ${u.display_name}`}
              selected={u.is_super_admin || undefined}
              disabled={savingId === u.id || u.id === session?.user.id || undefined}
              onChange={() => void toggleAdmin(u)}
            />
            admin
          </label>
          {u.id !== session?.user.id && (
            <button
              className="admin-danger"
              disabled={savingId === u.id}
              onClick={() => void expel(u)}
            >
              <span className="material-symbols-rounded">person_remove</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Moderación ===================== */

interface ModItem {
  id: string
  body: string
  kind: DiscussionKind
  chapter_number: number
  created_at: string
  is_club: boolean
  book_title: string
  author_name: string
  author_id: string
  comment_count: number
}

function ContentTab() {
  const [items, setItems] = useState<ModItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_discussions')
    if (error) setError(error.message)
    else setItems((data as ModItem[] | null) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveEdit = async (id: string) => {
    const { error } = await supabase.rpc('admin_update_discussion', {
      target: id,
      new_body: draft.trim(),
    })
    if (error) setError(error.message)
    setEditingId(null)
    await load()
  }

  const remove = async (item: ModItem) => {
    if (
      !window.confirm(
        `¿Eliminar esta publicación de ${item.author_name} y sus ${item.comment_count} respuestas?`,
      )
    )
      return
    const { error } = await supabase.rpc('admin_delete_discussion', {
      target: item.id,
    })
    if (error) setError(error.message)
    await load()
  }

  if (items === null) return <Spinner error={error} />

  const q = search.trim().toLowerCase()
  const visible = q
    ? items.filter(
        (i) =>
          i.body.toLowerCase().includes(q) ||
          i.author_name.toLowerCase().includes(q) ||
          i.book_title.toLowerCase().includes(q),
      )
    : items

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}
      <p className="body-small on-surface-variant">
        Ves TODO el contenido (sin spoiler gate): esta vista es solo para
        moderar. {items.length} publicaciones.
      </p>
      <input
        className="admin-search body-medium"
        placeholder="Buscar por texto, autor o libro…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visible.map((i) => (
        <div key={i.id} className="admin-card">
          <div className="admin-card__meta body-small on-surface-variant">
            <b>{i.author_name}</b> · {i.book_title} · Cap. {i.chapter_number} ·{' '}
            {KIND_LABEL[i.kind]}
            {i.is_club ? ' · Club' : ''} · {timeAgo(i.created_at)} ·{' '}
            {i.comment_count} respuestas
          </div>
          {editingId === i.id ? (
            <>
              <textarea
                className="admin-edit body-medium"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="admin-card__actions">
                <md-text-button onClick={() => setEditingId(null)}>
                  Cancelar
                </md-text-button>
                <md-filled-button
                  disabled={!draft.trim() || undefined}
                  onClick={() => void saveEdit(i.id)}
                >
                  Guardar
                </md-filled-button>
              </div>
            </>
          ) : (
            <>
              <p className="body-medium admin-card__body">{i.body}</p>
              <div className="admin-card__actions">
                <md-text-button
                  onClick={() => {
                    setEditingId(i.id)
                    setDraft(i.body)
                  }}
                >
                  Editar
                </md-text-button>
                <md-text-button onClick={() => void remove(i)}>
                  Eliminar
                </md-text-button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Denuncias (DSA arts. 16-17) ===================== */

const REASON_LABEL: Record<string, string> = {
  illegal: 'Contenido ilegal',
  harassment: 'Acoso u odio',
  spoiler: 'Spoiler malintencionado',
  spam: 'Spam',
  ip: 'Propiedad intelectual',
  other: 'Otro',
}

const TARGET_LABEL: Record<string, string> = {
  discussion: 'idea',
  comment: 'respuesta',
  post: 'entrada de muro',
  review: 'reseña',
  profile: 'perfil',
}

interface ReportRow extends Report {
  reporterName: string
  reportedName: string
}

function ReportsTab() {
  const [items, setItems] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      setError(
        /reports|relation/i.test(error.message)
          ? 'Falta ejecutar la migración 018 en Supabase (tabla de denuncias).'
          : error.message,
      )
      return
    }
    const list = data ?? []
    const ids = [
      ...new Set(
        list.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean),
      ),
    ] as string[]
    const { data: people } = ids.length
      ? await supabase.from('profiles').select('id, display_name').in('id', ids)
      : { data: [] }
    const nameById = new Map((people ?? []).map((p) => [p.id, p.display_name]))
    setItems(
      list.map((r) => ({
        ...r,
        reporterName: r.reporter_id
          ? (nameById.get(r.reporter_id) ?? 'Usuario eliminado')
          : 'Anónimo',
        reportedName: r.reported_user_id
          ? (nameById.get(r.reported_user_id) ?? 'Usuario eliminado')
          : '—',
      })),
    )
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Retira el contenido denunciado y resuelve con motivo (DSA art. 17). */
  const actionReport = async (r: ReportRow) => {
    const note = (notes[r.id] ?? '').trim()
    if (
      !window.confirm(
        `¿Retirar esta ${TARGET_LABEL[r.target_type]} de ${r.reportedName}? El autor recibirá el motivo.`,
      )
    )
      return
    setBusyId(r.id)
    setError(null)
    let e: { message: string } | null = null
    if (r.target_type === 'discussion') {
      e = (await supabase.rpc('admin_delete_discussion', { target: r.target_id })).error
    } else if (r.target_type === 'comment') {
      e = (await supabase.rpc('admin_delete_comment', { target: r.target_id })).error
    } else if (r.target_type === 'post') {
      e = (await supabase.rpc('admin_delete_post', { target: r.target_id })).error
    } else if (r.target_type === 'review') {
      const [book, user] = r.target_id.split(':')
      e = (await supabase.rpc('admin_delete_review', { book, target_user: user })).error
    }
    // 'profile': no hay contenido que borrar; gestionar en la pestaña Usuarios
    if (e) {
      setError(e.message)
      setBusyId(null)
      return
    }
    const { error: e2 } = await supabase.rpc('admin_resolve_report', {
      report: r.id,
      new_status: 'actioned',
      note: note || null,
    })
    if (e2) setError(e2.message)
    setBusyId(null)
    await load()
  }

  const dismissReport = async (r: ReportRow) => {
    setBusyId(r.id)
    setError(null)
    const { error: e } = await supabase.rpc('admin_resolve_report', {
      report: r.id,
      new_status: 'dismissed',
      note: (notes[r.id] ?? '').trim() || null,
    })
    if (e) setError(e.message)
    setBusyId(null)
    await load()
  }

  if (items === null) return <Spinner error={error} />

  const open = items.filter((r) => r.status === 'open')
  const resolved = items.filter((r) => r.status !== 'open')
  const visible = showResolved ? resolved : open

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}
      <p className="body-small on-surface-variant">
        Mecanismo de notificación y acción (DSA art. 16). Al retirar
        contenido, el autor recibe una notificación con el motivo (art. 17).
      </p>
      <div className="admin-tabs" style={{ marginTop: 0 }}>
        <button
          className={`admin-tab label-large${!showResolved ? ' active' : ''}`}
          onClick={() => setShowResolved(false)}
        >
          Abiertas ({open.length})
        </button>
        <button
          className={`admin-tab label-large${showResolved ? ' active' : ''}`}
          onClick={() => setShowResolved(true)}
        >
          Resueltas ({resolved.length})
        </button>
      </div>

      {visible.length === 0 && (
        <p className="body-medium on-surface-variant">
          {showResolved ? 'Nada resuelto todavía.' : 'No hay denuncias pendientes. 🎉'}
        </p>
      )}

      {visible.map((r) => (
        <div key={r.id} className="admin-card">
          <div className="admin-card__meta body-small on-surface-variant">
            <b>{REASON_LABEL[r.reason] ?? r.reason}</b> ·{' '}
            {TARGET_LABEL[r.target_type] ?? r.target_type} de{' '}
            <b>{r.reportedName}</b> · denunciado por {r.reporterName} ·{' '}
            {timeAgo(r.created_at)}
            {r.status !== 'open' &&
              ` · ${r.status === 'actioned' ? 'retirado' : 'desestimado'}`}
          </div>
          {r.excerpt && (
            <p className="body-medium admin-card__body">«{r.excerpt}»</p>
          )}
          {r.details && (
            <p className="body-small on-surface-variant">
              Detalles: {r.details}
            </p>
          )}
          {r.status === 'open' ? (
            <>
              <textarea
                className="admin-edit body-small"
                rows={2}
                placeholder="Motivo para el autor (obligatorio si retiras; DSA art. 17)…"
                value={notes[r.id] ?? ''}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                }
              />
              <div className="admin-card__actions">
                <md-text-button
                  disabled={busyId === r.id || undefined}
                  onClick={() => void dismissReport(r)}
                >
                  Desestimar
                </md-text-button>
                {r.target_type !== 'profile' && (
                  <md-filled-button
                    disabled={
                      busyId === r.id || !(notes[r.id] ?? '').trim() || undefined
                    }
                    onClick={() => void actionReport(r)}
                  >
                    Retirar y avisar
                  </md-filled-button>
                )}
              </div>
            </>
          ) : (
            r.resolution_note && (
              <p className="body-small on-surface-variant">
                Resolución: {r.resolution_note}
              </p>
            )
          )}
        </div>
      ))}
    </div>
  )
}

/* ===================== Legal (datos del titular) ===================== */

const LEGAL_FIELDS: {
  field: keyof typeof LEGAL_SETTING_KEYS
  label: string
  hint?: string
}[] = [
  { field: 'ownerName', label: 'Nombre y apellidos o razón social *' },
  { field: 'nif', label: 'NIF / CIF *' },
  { field: 'address', label: 'Domicilio completo *' },
  {
    field: 'contactEmail',
    label: 'Email de contacto *',
    hint: 'También punto de contacto DSA. Mejor un buzón dedicado (legal@…), no personal.',
  },
  {
    field: 'privacyEmail',
    label: 'Email de privacidad (opcional)',
    hint: 'Si se deja vacío, se usa el de contacto.',
  },
  {
    field: 'registry',
    label: 'Inscripción registral (solo sociedades)',
    hint: 'Registro Mercantil, tomo, folio, hoja. Vacío = la línea no se muestra.',
  },
]

/**
 * Datos del titular para los textos legales (LSSI art. 10; migr. 019).
 * Se guardan en app_settings (lectura pública) y sustituyen los tokens
 * de /legal/* al renderizar. Guardar re-estampa la fecha de publicación.
 */
function LegalTab() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (error) {
          setError(
            /app_settings|relation/i.test(error.message)
              ? 'Falta ejecutar la migración 019 en Supabase (tabla app_settings).'
              : error.message,
          )
        } else {
          const byKey = new Map((data ?? []).map((r) => [r.key, r.value]))
          const v: Record<string, string> = {}
          for (const { field } of LEGAL_FIELDS)
            v[field] = byKey.get(LEGAL_SETTING_KEYS[field]) ?? ''
          setValues(v)
        }
        setLoaded(true)
      })
  }, [])

  const save = async () => {
    const required = ['ownerName', 'nif', 'address', 'contactEmail'] as const
    const missing = required.filter((f) => !(values[f] ?? '').trim())
    if (missing.length) {
      setError('Faltan campos obligatorios (los marcados con *).')
      setNotice(null)
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const today = new Date().toISOString().slice(0, 10)
    const rows = [
      ...LEGAL_FIELDS.map(({ field }) => ({
        key: LEGAL_SETTING_KEYS[field],
        value: (values[field] ?? '').trim(),
      })),
      // guardar = publicar: se estampa la fecha de «Última actualización»
      { key: LEGAL_SETTING_KEYS.updatedAt, value: today },
    ]
    const { error: e } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' })
    setBusy(false)
    if (e) {
      setError(
        /app_settings|relation/i.test(e.message)
          ? 'Falta ejecutar la migración 019 en Supabase (tabla app_settings).'
          : e.message,
      )
      return
    }
    setNotice(
      'Guardado. Los textos legales ya muestran estos datos (fecha de publicación: hoy).',
    )
  }

  if (!loaded) return <Spinner error={error} />

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}
      {notice && <p className="body-small admin-card__body">✅ {notice}</p>}
      <p className="body-small on-surface-variant">
        Identidad del prestador (LSSI art. 10). Estos datos son públicos: se
        insertan en el Aviso legal, la Privacidad, las Cookies y los Términos.
        Mientras falte alguno, en las páginas se ve el token […] sin rellenar.
      </p>
      <div className="admin-card">
        {LEGAL_FIELDS.map(({ field, label, hint }) => (
          <label key={field} className="admin-legal__field label-medium">
            {label}
            <input
              className="admin-input body-medium"
              value={values[field] ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field]: e.target.value }))
              }
            />
            {hint && (
              <span className="body-small on-surface-variant">{hint}</span>
            )}
          </label>
        ))}
        <div className="admin-card__actions">
          <md-filled-button disabled={busy || undefined} onClick={() => void save()}>
            Guardar y publicar
          </md-filled-button>
        </div>
      </div>
      <p className="body-small on-surface-variant">
        Revisa el resultado:{' '}
        {LEGAL_ORDER.map((slug, i) => (
          <span key={slug}>
            {i > 0 && ' · '}
            <a href={`/legal/${slug}`} target="_blank" rel="noreferrer">
              {LEGAL_DOCS[slug].short}
            </a>
          </span>
        ))}
      </p>
    </div>
  )
}

/* ===================== Libros ===================== */

function BooksTab() {
  const [books, setBooks] = useState<Book[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('books').select('*').order('title')
    if (error) setError(error.message)
    setBooks(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addChapter = async (bookId: string) => {
    const title = (chapterDrafts[bookId] ?? '').trim()
    if (!title) return
    setBusy(true)
    const { error } = await supabase.rpc('add_book_chapter', {
      book: bookId,
      title,
    })
    if (error) setError(error.message)
    setChapterDrafts((d) => ({ ...d, [bookId]: '' }))
    setBusy(false)
    await load()
  }

  const setClubBook = async (bookId: string) => {
    setBusy(true)
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (club) {
      const { error } = await supabase
        .from('clubs')
        .update({ current_book_id: bookId })
        .eq('id', club.id)
      if (error) setError(error.message)
    }
    setBusy(false)
    await load()
  }

  const saveField = async (
    bookId: string,
    patch: Partial<Pick<Book, 'cover_url' | 'buy_url' | 'synopsis'>>,
  ) => {
    setBusy(true)
    const { error } = await supabase.from('books').update(patch).eq('id', bookId)
    if (error) setError(error.message)
    setBusy(false)
    await load()
  }

  /** Cambia el autor de un libro creando su ficha si hace falta. */
  const saveAuthor = async (bookId: string, name: string) => {
    setBusy(true)
    let { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('name', name)
      .maybeSingle()
    if (!author) {
      const { data: created, error } = await supabase
        .from('authors')
        .insert({ name })
        .select('id')
        .single()
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
      author = created
    }
    const { error } = await supabase
      .from('books')
      .update({ author: name, author_id: author.id })
      .eq('id', bookId)
    if (error) setError(error.message)
    setBusy(false)
    await load()
  }

  if (books === null) return <Spinner error={error} />

  return (
    <div className="admin-list">
      {error && <p className="admin-error body-medium">{error}</p>}

      {/* ---- Alta de libro (guiada, compartida con la capitanía) ---- */}
      {!adding ? (
        <md-filled-button onClick={() => setAdding(true)}>
          <span slot="icon" className="material-symbols-rounded">add</span>
          Añadir un libro nuevo
        </md-filled-button>
      ) : (
        <div className="admin-card">
          <h2 className="title-medium serif" style={{ marginBottom: 10 }}>
            Nuevo libro
          </h2>
          <BookForm
            onCreated={() => {
              setAdding(false)
              void load()
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <h2 className="title-small manage-card__title" style={{ marginTop: 6 }}>
        Catálogo ({books.length})
      </h2>

      {books.map((b) => (
        <div key={b.id} className="admin-card admin-book">
          <BookCover title={b.title} author={b.author} coverUrl={b.cover_url} size="md" />
          <div className="admin-book__main">
            <span className="title-small serif">{b.title}</span>
            <span className="body-small on-surface-variant">
              {b.author} · {b.total_chapters} capítulos
            </span>
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="URL de portada (https://…)"
                defaultValue={b.cover_url ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (b.cover_url ?? ''))
                    void saveField(b.id, { cover_url: e.target.value.trim() || null })
                }}
              />
            </div>
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="Enlace de compra (Amazon…)"
                defaultValue={b.buy_url ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (b.buy_url ?? ''))
                    void saveField(b.id, { buy_url: e.target.value.trim() || null })
                }}
              />
            </div>
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="Autor (crea su página si no existe)"
                defaultValue={b.author}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== b.author)
                    void saveAuthor(b.id, e.target.value.trim())
                }}
              />
            </div>
            <textarea
              className="admin-edit body-small"
              rows={3}
              placeholder="Sinopsis (se muestra en la ficha del libro)"
              defaultValue={b.synopsis ?? ''}
              onBlur={(e) => {
                if (e.target.value !== (b.synopsis ?? ''))
                  void saveField(b.id, { synopsis: e.target.value.trim() || null })
              }}
            />
            <div className="admin-book__row">
              <input
                className="admin-input body-small"
                placeholder="Añadir capítulo por título…"
                value={chapterDrafts[b.id] ?? ''}
                onChange={(e) =>
                  setChapterDrafts((d) => ({ ...d, [b.id]: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && void addChapter(b.id)}
              />
              <md-outlined-button
                disabled={busy || undefined}
                onClick={() => void addChapter(b.id)}
              >
                Añadir
              </md-outlined-button>
            </div>
            <div className="admin-book__row">
              <md-text-button disabled={busy || undefined} onClick={() => void setClubBook(b.id)}>
                Hacer libro del club
              </md-text-button>
            </div>
          </div>
        </div>
      ))}

    </div>
  )
}

function Spinner({ error }: { error: string | null }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
      {error ? (
        <p className="admin-error body-medium">{error}</p>
      ) : (
        <md-circular-progress indeterminate />
      )}
    </div>
  )
}
