import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/switch/switch.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { disablePush, enablePush, pushEnabled, pushSupported } from '../../lib/push'
import { useConfirm } from '../../components/ConfirmProvider'
import { timeAgo } from '../../lib/time'
import './profile.css'

interface IdeaRow {
  id: string
  bookId: string
  bookTitle: string
  chapterNumber: number
  body: string
  createdAt: string
}

interface PostRow {
  id: string
  title: string | null
  body: string
  isClub: boolean
  createdAt: string
}

/** Centro de avisos: qué tipos de notificación recibe el usuario. */
type NotifPrefs = {
  reply: boolean
  follow: boolean
  poll: boolean
  unlock: boolean
  book_done: boolean
  reaction: boolean
  new_idea: boolean
}

const NOTIF_DEFAULTS: NotifPrefs = {
  reply: true,
  follow: true,
  poll: true,
  unlock: true,
  book_done: true,
  reaction: true,
  new_idea: true,
}

const NOTIF_OPTIONS: { key: keyof NotifPrefs; label: string; hint: string }[] = [
  {
    key: 'reply',
    label: 'Respuestas a tus mensajes',
    hint: 'Cuando alguien responde a una idea o comentario tuyo.',
  },
  {
    key: 'reaction',
    label: 'Reacciones a tus ideas',
    hint: 'Cuando alguien reacciona ❤️🔥😮💡 a algo que has escrito.',
  },
  {
    key: 'new_idea',
    label: 'Ideas de gente que sigues',
    hint: 'Cuando alguien a quien sigues comparte un pensamiento nuevo.',
  },
  {
    key: 'unlock',
    label: 'Respuestas que se desbloquean',
    hint: 'Cuando llegas al capítulo y por fin puedes leer una respuesta.',
  },
  {
    key: 'follow',
    label: 'Nuevos seguidores',
    hint: 'Cuando alguien empieza a seguirte.',
  },
  {
    key: 'poll',
    label: 'Votaciones del club',
    hint: 'Cuando se abre una votación para elegir libro.',
  },
  {
    key: 'book_done',
    label: 'Libro terminado por el club',
    hint: 'Cuando todo el club acaba la lectura del mes.',
  },
]

export default function ProfilePage() {
  const { session, profile, isSuperAdmin, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [ideasCount, setIdeasCount] = useState(0)
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [clubId, setClubId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [bioDraft, setBioDraft] = useState('')
  const [writing, setWriting] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postToClub, setPostToClub] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  // Derechos RGPD: supresión (art. 17) y portabilidad (art. 20)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [exporting, setExporting] = useState(false)
  // Cambio de contraseña (auditoría C-01b)
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [passMsg, setPassMsg] = useState<string | null>(null)
  const [passBusy, setPassBusy] = useState(false)
  // Centro de avisos (migr. 018): sin fila guardada, todo activado
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(NOTIF_DEFAULTS)
  // Web Push en ESTE dispositivo (migr. 023)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    void pushEnabled().then(setPushOn)
  }, [])

  const togglePush = async () => {
    if (!session) return
    setPushBusy(true)
    setPushMsg(null)
    if (pushOn) {
      await disablePush()
      setPushOn(false)
      setPushMsg('Push desactivado en este dispositivo.')
    } else {
      const result = await enablePush(session.user.id)
      if (result === 'ok') {
        setPushOn(true)
        setPushMsg('Listo: este dispositivo recibirá avisos push.')
      } else if (result === 'denied') {
        setPushMsg(
          'Has denegado el permiso de notificaciones. Actívalo en los ajustes del navegador y vuelve a intentarlo.',
        )
      } else if (result === 'unsupported') {
        setPushMsg(
          'Este navegador no soporta push. En iPhone: instala la app en tu pantalla de inicio (Compartir → Añadir a pantalla de inicio) y actívalo desde ahí.',
        )
      } else {
        setPushMsg('No se pudo activar el push. Inténtalo de nuevo.')
      }
    }
    setPushBusy(false)
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setNotifPrefs({
            reply: data.reply,
            follow: data.follow,
            poll: data.poll,
            unlock: data.unlock,
            book_done: data.book_done,
            // ?? true: la fila puede ser anterior a la migración 024
            reaction: data.reaction ?? true,
            new_idea: data.new_idea ?? true,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [session])

  /** Enciende/apaga un tipo de aviso (optimista; el filtro real es un
   *  trigger en el servidor, así que aplica a TODO lo que se genere). */
  const toggleNotifPref = async (key: keyof NotifPrefs) => {
    if (!session) return
    const prev = notifPrefs
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    setError(null)
    const { error: e } = await supabase
      .from('notification_prefs')
      .upsert({ user_id: session.user.id, ...next }, { onConflict: 'user_id' })
    if (e) {
      setNotifPrefs(prev) // revertir: no se guardó
      setError(friendlyError(e, 'No se pudo guardar tu preferencia de avisos.'))
    }
  }

  /** Sube la foto de perfil: recorte cuadrado a 512px → Storage → perfil. */
  const changePhoto = async (file: File) => {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      // Recorte centrado y reescalado en el navegador (nada de originales de 12 MB)
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se pudo leer la imagen'))
        img.src = objectUrl
      })
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const size = Math.min(512, side)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas
        .getContext('2d')!
        .drawImage(
          img,
          (img.naturalWidth - side) / 2,
          (img.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size,
        )
      URL.revokeObjectURL(objectUrl)
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, 'image/jpeg', 0.85),
      )
      if (!blob) throw new Error('No se pudo procesar la imagen')

      // Nombre no adivinable (P2-12): el bucket es público, pero la URL
      // solo la conoce quien ve tu perfil — no es derivable del uid.
      const path = `${session.user.id}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      // auditoría A-04: nunca mensajes técnicos ni de migraciones al usuario
      if (upErr)
        throw new Error(friendlyError(upErr, 'No se pudo subir la imagen.'))
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: pub.publicUrl })
        .eq('id', session.user.id)
      if (dbErr)
        throw new Error(
          friendlyError(dbErr, 'No se pudo guardar la foto de perfil.'), // auditoría A-04
        )

      // Minimización: la foto anterior se elimina, no se acumula
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(session.user.id)
      const stale = (existing ?? [])
        .filter((f) => `${session.user.id}/${f.name}` !== path)
        .map((f) => `${session.user.id}/${f.name}`)
      if (stale.length > 0)
        await supabase.storage.from('avatars').remove(stale)

      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la foto')
    }
    setBusy(false)
  }

  const load = useCallback(async () => {
    if (!session) return
    const [
      { count: followersCount },
      { count: followingCount },
      { count: myIdeasCount },
      { data: discussions },
      { data: myPosts },
      { data: club },
    ] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', session.user.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', session.user.id),
      supabase
        .from('discussions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', session.user.id),
      supabase
        .from('discussions')
        .select('id, book_id, chapter_number, body, created_at')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('posts')
        .select('id, title, body, club_id, created_at')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('clubs')
        .select('id')
        .order('created_at')
        .limit(1)
        .maybeSingle(),
    ])
    setFollowers(followersCount ?? 0)
    setFollowing(followingCount ?? 0)
    setIdeasCount(myIdeasCount ?? 0)
    setClubId(club?.id ?? null)
    setPosts(
      (myPosts ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        isClub: p.club_id != null,
        createdAt: timeAgo(p.created_at),
      })),
    )

    const list = discussions ?? []
    const bookIds = [...new Set(list.map((d) => d.book_id))]
    const { data: books } = bookIds.length
      ? await supabase.from('books').select('id, title').in('id', bookIds)
      : { data: [] }
    const titleById = new Map((books ?? []).map((b) => [b.id, b.title]))
    setIdeas(
      list.map((d) => ({
        id: d.id,
        bookId: d.book_id,
        bookTitle: titleById.get(d.book_id) ?? '',
        chapterNumber: d.chapter_number,
        body: d.body,
        createdAt: timeAgo(d.created_at),
      })),
    )
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  /** Ajuste anti-spoiler: ver (o no) respuestas de gente más adelantada. */
  const toggleAheadReplies = async () => {
    if (!session || !profile) return
    setError(null)
    const { error: e } = await supabase
      .from('profiles')
      .update({ show_ahead_replies: !profile.show_ahead_replies })
      .eq('id', session.user.id)
    if (e) {
      // auditoría A-04
      setError(friendlyError(e, 'No se pudo guardar el ajuste. Inténtalo de nuevo.'))
      return
    }
    await refreshProfile()
  }

  const startEdit = () => {
    setNameDraft(profile?.display_name ?? '')
    setBioDraft(profile?.bio ?? '')
    setError(null)
    setEditing(true)
  }

  const publishPost = async () => {
    if (!session) return
    const body = postBody.trim()
    if (!body) return
    setBusy(true)
    const { error } = await supabase.from('posts').insert({
      author_id: session.user.id,
      title: postTitle.trim() || null,
      body,
      club_id: postToClub ? clubId : null,
      visibility: 'followers',
    })
    setBusy(false)
    if (error) {
      setError(friendlyError(error, 'No se pudo publicar la entrada.')) // auditoría A-04
      return
    }
    setPostTitle('')
    setPostBody('')
    setWriting(false)
    await load()
  }

  const deletePost = async (id: string) => {
    // auditoría M-04: diálogo propio en lugar de window.confirm
    const ok = await confirm({
      title: 'Eliminar esta entrada',
      message: 'La entrada desaparecerá de tu muro. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    await supabase.from('posts').delete().eq('id', id)
    await load()
  }

  /** Cambiar contraseña (auditoría C-01b). */
  const changePassword = async () => {
    setPassError(null)
    setPassMsg(null)
    if (newPass.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPass !== newPass2) {
      setPassError('Las contraseñas no coinciden.')
      return
    }
    setPassBusy(true)
    const { error: e } = await supabase.auth.updateUser({ password: newPass })
    setPassBusy(false)
    if (e) {
      setPassError(friendlyError(e, 'No se pudo cambiar la contraseña.'))
      return
    }
    setNewPass('')
    setNewPass2('')
    setPassMsg('Contraseña cambiada.')
  }

  /** Portabilidad (RGPD art. 20): descarga JSON con todos tus datos. */
  const exportData = async () => {
    setExporting(true)
    setError(null)
    const { data, error: e } = await supabase.rpc('export_my_data')
    setExporting(false)
    if (e) {
      // auditoría A-04
      setError(friendlyError(e, 'No se pudo preparar la descarga de tus datos.'))
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tsundoku-zero-datos-${profile?.username ?? 'usuario'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Supresión (RGPD art. 17): borra cuenta, contenido y avatar. */
  const deleteAccount = async () => {
    if (!profile || deleteText.trim() !== profile.username) return
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('delete_own_account')
    if (e) {
      setBusy(false)
      // auditoría A-04
      setError(friendlyError(e, 'No se pudo eliminar la cuenta. Inténtalo de nuevo.'))
      return
    }
    // La cuenta ya no existe: cerrar sesión local e ir al login
    await supabase.auth.signOut().catch(() => {})
    navigate('/login', { replace: true })
  }

  const saveEdit = async () => {
    if (!session) return
    const display_name = nameDraft.trim()
    if (!display_name) {
      setError('El nombre no puede estar vacío.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name, bio: bioDraft.trim() || null })
      .eq('id', session.user.id)
    setBusy(false)
    if (error) {
      setError(friendlyError(error, 'No se pudo guardar el perfil.')) // auditoría A-04
      return
    }
    await refreshProfile()
    setEditing(false)
  }

  return (
    <section className="profile">
      {error && <p className="profile-error body-medium">{error}</p>}
      <div className="profile-head">
        <Avatar
          name={profile?.display_name ?? '·'}
          url={profile?.avatar_url}
          size={72}
        />
        {editing ? (
          <div className="profile-edit">
            {/* Foto de perfil: se sube desde el dispositivo */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void changePhoto(f)
                e.target.value = ''
              }}
            />
            <md-text-button
              disabled={busy || undefined}
              onClick={() => photoInputRef.current?.click()}
            >
              {busy ? 'Subiendo…' : 'Cambiar foto'}
            </md-text-button>
            <p className="body-small on-surface-variant" style={{ margin: 0 }}>
              Tu foto de perfil es públicamente accesible (como en cualquier
              red social). No subas una imagen que no quieras que se vea.
            </p>
            <input
              className="tz-input profile-input body-large"
              placeholder="Nombre visible"
              aria-label="Nombre visible" /* auditoría A-08 */
              value={nameDraft}
              maxLength={50}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <textarea
              className="tz-input profile-input body-medium"
              placeholder="Bio: cuéntanos qué clase de lector eres…"
              aria-label="Bio" /* auditoría A-08 */
              rows={2}
              maxLength={200}
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
            />
            <div className="profile-edit__actions">
              <md-text-button onClick={() => setEditing(false)}>
                Cancelar
              </md-text-button>
              <md-filled-button disabled={busy || undefined} onClick={() => void saveEdit()}>
                Guardar
              </md-filled-button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="headline-small serif">{profile?.display_name}</h1>
            <p className="body-medium on-surface-variant">
              @{profile?.username}
            </p>
            {profile?.bio && (
              <p className="body-medium profile-bio">{profile.bio}</p>
            )}
            <div className="profile-counts label-large">
              <span>
                <b>{following}</b>{' '}
                <span className="on-surface-variant">siguiendo</span>
              </span>
              <span>
                <b>{followers}</b>{' '}
                <span className="on-surface-variant">seguidores</span>
              </span>
              <span>
                <b>{ideasCount}</b>{' '}
                <span className="on-surface-variant">ideas</span>
              </span>
            </div>
            <md-outlined-button onClick={startEdit}>
              Editar perfil
            </md-outlined-button>
          </>
        )}
      </div>

      {/* ===== Configuración ===== */}
      <h2 className="title-small profile-sec">Configuración</h2>
      <div className="profile-settings">
        <label className="profile-setting">
          <span className="profile-setting__text">
            <span className="body-medium">
              Puedo ver las respuestas de personas que van por delante de mí en
              la lectura
            </span>
            <span className="body-small on-surface-variant">
              Desbloquea las respuestas escritas desde capítulos que aún no has
              alcanzado, para que la conversación fluya. Pueden contener
              spoilers. Las ideas de capítulos futuros siguen selladas.
            </span>
          </span>
          <md-switch
            aria-label="Ver respuestas de personas más adelantadas"
            selected={profile?.show_ahead_replies || undefined}
            onChange={() => void toggleAheadReplies()}
          />
        </label>

        {/* ===== Push en este dispositivo (migr. 023) ===== */}
        <div className="profile-setting__divider" role="presentation" />
        <label className="profile-setting">
          <span className="profile-setting__text">
            <span className="body-medium">
              Notificaciones push en este dispositivo
            </span>
            <span className="body-small on-surface-variant">
              Recibe los avisos aunque la app esté cerrada.
              {!pushSupported() &&
                ' En iPhone, primero instala la app en tu pantalla de inicio.'}
            </span>
            {pushMsg && (
              <span className="body-small profile-setting__msg">{pushMsg}</span>
            )}
          </span>
          <md-switch
            aria-label="Notificaciones push en este dispositivo"
            selected={pushOn || undefined}
            disabled={pushBusy || undefined}
            onChange={() => void togglePush()}
          />
        </label>

        {/* ===== Centro de avisos (migr. 018) ===== */}
        <div className="profile-setting__divider" role="presentation" />
        <p className="label-medium profile-setting__group">
          Qué avisos recibes
        </p>
        {NOTIF_OPTIONS.map(({ key, label, hint }) => (
          <label key={key} className="profile-setting profile-setting--compact">
            <span className="profile-setting__text">
              <span className="body-medium">{label}</span>
              <span className="body-small on-surface-variant">{hint}</span>
            </span>
            <md-switch
              aria-label={label}
              selected={notifPrefs[key] || undefined}
              onChange={() => void toggleNotifPref(key)}
            />
          </label>
        ))}
      </div>

      <h2 className="title-small profile-sec">Mi muro</h2>
      {writing ? (
        <div className="post-composer">
          <input
            className="tz-input profile-input body-large"
            placeholder="Título (opcional)"
            aria-label="Título de la entrada (opcional)" /* auditoría A-08 */
            maxLength={120}
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
          />
          <textarea
            className="tz-input profile-input body-medium"
            placeholder="Escribe tu entrada: reseñas, ensayos, tu pila de lectura…"
            aria-label="Texto de la entrada" /* auditoría A-08 */
            rows={5}
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
          />
          <div className="post-composer__row">
            <button
              type="button"
              className={`club-toggle label-medium${postToClub ? ' active' : ''}`}
              onClick={() => setPostToClub((v) => !v)}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                {postToClub ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              Compartir con el club
            </button>
            <span style={{ flex: 1 }} />
            <md-text-button onClick={() => setWriting(false)}>
              Cancelar
            </md-text-button>
            <md-filled-button
              disabled={!postBody.trim() || busy || undefined}
              onClick={() => void publishPost()}
            >
              Publicar
            </md-filled-button>
          </div>
        </div>
      ) : (
        <md-outlined-button onClick={() => setWriting(true)}>
          <span slot="icon" className="material-symbols-rounded" aria-hidden="true">edit</span>
          Nueva entrada
        </md-outlined-button>
      )}

      {posts.length > 0 && (
        <div className="profile-ideas">
          {posts.map((p) => (
            <div key={p.id} className="idea-row" style={{ cursor: 'default' }}>
              {p.title && (
                <span className="title-small serif">{p.title}</span>
              )}
              <span className="body-medium idea-row__body">{p.body}</span>
              <span className="body-small on-surface-variant post-row__meta">
                {p.createdAt}
                {p.isClub ? ' · Club' : ''}
                <button
                  className="feed-action feed-action--danger"
                  onClick={() => void deletePost(p.id)}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                  Eliminar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="title-small profile-sec">Mis últimas ideas</h2>
      {ideas.length === 0 ? (
        <p className="body-medium on-surface-variant">
          Todavía no has compartido ninguna idea. Toca el + y estrena tu voz.
        </p>
      ) : (
        <div className="profile-ideas">
          {ideas.map((i) => (
            <button
              key={i.id}
              className="idea-row"
              onClick={() =>
                navigate(`/book/${i.bookId}/chapter/${i.chapterNumber}`)
              }
            >
              <span className="body-medium idea-row__body">{i.body}</span>
              <span className="body-small on-surface-variant">
                {i.bookTitle} · Cap. {i.chapterNumber} · {i.createdAt}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="profile-actions">
        <Link to="/club" style={{ display: 'block' }}>
          <md-filled-tonal-button style={{ width: '100%' }}>
            <span slot="icon" className="material-symbols-rounded" aria-hidden="true">group</span>
            Mi club
          </md-filled-tonal-button>
        </Link>
        {isSuperAdmin && (
          <Link to="/admin" style={{ display: 'block' }}>
            <md-filled-tonal-button style={{ width: '100%' }}>
              <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
                admin_panel_settings
              </span>
              Administración
            </md-filled-tonal-button>
          </Link>
        )}
        <md-outlined-button onClick={() => void signOut()}>
          Cerrar sesión
        </md-outlined-button>
      </div>

      {/* ===== Cambiar contraseña (auditoría C-01b) ===== */}
      <h2 className="title-small profile-sec">Cambiar contraseña</h2>
      <div className="profile-password">
        <input
          type="password"
          className="tz-input profile-input body-medium"
          placeholder="Nueva contraseña"
          aria-label="Nueva contraseña"
          autoComplete="new-password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
        />
        <input
          type="password"
          className="tz-input profile-input body-medium"
          placeholder="Repite la nueva contraseña"
          aria-label="Repite la nueva contraseña"
          autoComplete="new-password"
          value={newPass2}
          onChange={(e) => setNewPass2(e.target.value)}
        />
        {passError && (
          <p className="profile-error body-small" style={{ margin: 0 }}>
            {passError}
          </p>
        )}
        {passMsg && (
          <p className="body-small" role="status" style={{ margin: 0 }}>
            {passMsg}
          </p>
        )}
        <div className="profile-edit__actions" style={{ justifyContent: 'flex-end' }}>
          <md-outlined-button
            disabled={passBusy || !newPass || !newPass2 || undefined}
            onClick={() => void changePassword()}
          >
            {passBusy ? 'Cambiando…' : 'Cambiar contraseña'}
          </md-outlined-button>
        </div>
      </div>

      {/* ===== Tus datos (RGPD arts. 17 y 20) ===== */}
      <h2 className="title-small profile-sec">Tus datos</h2>
      <div className="profile-data">
        <button
          className="profile-data__row"
          disabled={exporting}
          onClick={() => void exportData()}
        >
          <span className="material-symbols-rounded" aria-hidden="true">download</span>
          <span className="profile-data__text">
            <span className="body-medium">
              {exporting ? 'Preparando…' : 'Descargar mis datos'}
            </span>
            <span className="body-small on-surface-variant">
              Copia en JSON de tu perfil, lecturas, ideas y reseñas
              (portabilidad).
            </span>
          </span>
        </button>

        {confirmingDelete ? (
          <div className="profile-data__danger">
            <p className="body-medium">
              Esto borra <b>para siempre</b> tu cuenta, tu contenido, tu foto
              y tus datos. No se puede deshacer. Escribe{' '}
              <b>{profile?.username}</b> para confirmar:
            </p>
            <input
              className="tz-input profile-input body-medium"
              placeholder={profile?.username ?? ''}
              aria-label="Escribe tu nombre de usuario para confirmar el borrado" /* auditoría A-08 */
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
            />
            <div className="profile-edit__actions">
              <md-text-button
                onClick={() => {
                  setConfirmingDelete(false)
                  setDeleteText('')
                }}
              >
                Cancelar
              </md-text-button>
              <md-filled-button
                class="profile-data__deletebtn"
                disabled={
                  busy || deleteText.trim() !== profile?.username || undefined
                }
                onClick={() => void deleteAccount()}
              >
                Eliminar mi cuenta
              </md-filled-button>
            </div>
          </div>
        ) : (
          <button
            className="profile-data__row profile-data__row--danger"
            onClick={() => setConfirmingDelete(true)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">delete_forever</span>
            <span className="profile-data__text">
              <span className="body-medium">Eliminar mi cuenta</span>
              <span className="body-small on-surface-variant">
                Borra tu cuenta y todo tu contenido de forma permanente
                (derecho de supresión).
              </span>
            </span>
          </button>
        )}
      </div>

      <nav
        className="legal-links label-small"
        aria-label="Información legal"
        style={{ marginTop: 20 }}
      >
        <Link to="/legal/privacidad">Privacidad</Link>
        <Link to="/legal/terminos">Términos</Link>
        <Link to="/legal/cookies">Cookies</Link>
        <Link to="/legal/aviso-legal">Aviso legal</Link>
      </nav>
    </section>
  )
}
