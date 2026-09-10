import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../auth/AuthContext'
import { useConfirm } from '../../components/ConfirmProvider'
import { Avatar } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import CaptainCard from './CaptainCard'
import type { Club } from '../../lib/database.types'
import './club.css'

/** Emblemas posibles: pocos y con sentido para un club de lectura. */
const EMBLEMAS = ['📖', '📚', '🕯️', '🦉', '🔖', '🗝️', '🌙', '☕', '🪶', '🧭']
const COLORES = ['#e1e9d8', '#f0e2d7', '#f1e8c8', '#dbe4ee', '#ece0ee', '#fdfdfb']

interface Member {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  role: string
}

/**
 * Administración del club: lo que se toca una vez y se deja quieto.
 * Datos, reparto de la capitanía, miembros e invitación.
 *
 * El día a día de la lectura, votaciones incluidas, vive en /club/capitania.
 * Esta pantalla es solo para administradores; el capitán no la necesita
 * para hacer su trabajo.
 */
export default function ClubAdminPage() {
  const { session, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [codigo, setCodigo] = useState<string | null>(null)
  // Emblema y afiliados (migr. 032)
  const [emblema, setEmblema] = useState('')
  const [color, setColor] = useState('')
  const [tag, setTag] = useState('')
  const [emblemaUrl, setEmblemaUrl] = useState<string | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)
  const [copiado, setCopiado] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data: c } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!c) return
    setClub(c)
    setName(c.name)
    setDescription(c.description ?? '')
    setEmblema(c.emblem ?? '')
    setColor(c.emblem_color ?? '')
    setTag(c.affiliate_tag ?? '')
    setEmblemaUrl(c.emblem_url ?? null)

    const { data: memberRows } = await supabase
      .from('club_members')
      .select('user_id, role')
      .eq('club_id', c.id)
    const roleById = new Map((memberRows ?? []).map((m) => [m.user_id, m.role]))
    const ids = (memberRows ?? []).map((m) => m.user_id)
    const { data: profiles } = ids.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', ids)
      : { data: [] }
    setMembers(
      (profiles ?? [])
        .map((p) => ({ ...p, role: roleById.get(p.id) ?? 'member' }))
        .sort((a) => (a.role === 'captain' ? -1 : 1)),
    )

    // El código de invitación solo lo puede leer un administrador
    const { data: code } = await supabase.rpc('admin_get_invite_code')
    if (typeof code === 'string') setCodigo(code)
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  if (!isSuperAdmin) return <Navigate to="/club" replace />
  if (!club) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <md-circular-progress indeterminate />
      </div>
    )
  }

  const guardarDatos = async () => {
    setBanner(null)
    setBusy(true)
    const { error } = await supabase
      .from('clubs')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        emblem: emblema.trim() || null,
        emblem_color: color.trim() || null,
        affiliate_tag: tag.trim() || null,
      })
      .eq('id', club.id)
    if (error)
      setBanner({
        kind: 'error',
        text: friendlyError(error, 'No se pudieron guardar los datos del club.'),
      })
    else setBanner({ kind: 'info', text: 'Datos del club guardados.' })
    await load()
    setBusy(false)
  }

  /**
   * Sube el escudo del club. Mismo camino que las fotos de perfil:
   * recorte cuadrado en el navegador y al bucket «avatars», bajo la
   * carpeta «clubs», donde solo escriben capitán y administradores
   * (migr. 033).
   */
  const subirEmblema = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setBanner({ kind: 'error', text: 'Elige un archivo de imagen.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setBanner({ kind: 'error', text: 'La imagen no puede pasar de 5 MB.' })
      return
    }
    setBusy(true)
    setBanner(null)
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = objectUrl
      await img.decode()
      const lado = Math.min(img.naturalWidth, img.naturalHeight)
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas
        .getContext('2d')!
        .drawImage(
          img,
          (img.naturalWidth - lado) / 2,
          (img.naturalHeight - lado) / 2,
          lado,
          lado,
          0,
          0,
          size,
          size,
        )
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, 'image/jpeg', 0.88),
      )
      if (!blob) throw new Error('No se pudo procesar la imagen')

      const path = `clubs/${club.id}-${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw new Error(friendlyError(upErr, 'No se pudo subir el emblema.'))

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase
        .from('clubs')
        .update({ emblem_url: pub.publicUrl })
        .eq('id', club.id)
      if (dbErr) throw new Error(friendlyError(dbErr, 'No se pudo guardar el emblema.'))

      // El escudo anterior se borra: no tiene sentido acumularlos
      const { data: antiguos } = await supabase.storage.from('avatars').list('clubs')
      const sobran = (antiguos ?? [])
        .filter((f) => f.name.startsWith(club.id) && `clubs/${f.name}` !== path)
        .map((f) => `clubs/${f.name}`)
      if (sobran.length > 0) await supabase.storage.from('avatars').remove(sobran)

      setBanner({ kind: 'info', text: 'Emblema actualizado.' })
      await load()
    } catch (e) {
      setBanner({
        kind: 'error',
        text: e instanceof Error ? e.message : 'No se pudo cambiar el emblema.',
      })
    }
    setBusy(false)
  }

  const quitarEmblema = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('clubs')
      .update({ emblem_url: null })
      .eq('id', club.id)
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo quitar el emblema.') })
    else setBanner({ kind: 'info', text: 'Emblema quitado. Vuelve a valer el emoji.' })
    setBusy(false)
    await load()
  }

  const expulsar = async (userId: string, quien: string) => {
    const ok = await confirm({
      title: 'Expulsar del club',
      message: `¿Expulsar a ${quien} del club?`,
      confirmLabel: 'Expulsar',
      danger: true,
    })
    if (!ok) return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.rpc('club_kick_member', {
      club: club.id,
      target: userId,
    })
    if (error)
      setBanner({ kind: 'error', text: friendlyError(error, 'No se pudo expulsar al miembro.') })
    await load()
    setBusy(false)
  }

  const invitacion = `${window.location.origin}/welcome`

  const copiar = async () => {
    const texto = codigo
      ? `Únete a ${club.name} en Tsundoku Zero: ${invitacion}\nCódigo de invitación: ${codigo}`
      : `Únete a ${club.name} en Tsundoku Zero: ${invitacion}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setBanner({
        kind: 'info',
        text: 'Tu navegador no deja copiar solo. Selecciona el texto y cópialo a mano.',
      })
    }
  }

  return (
    <section className="club-manage">
      <PageHeader
        title="Administración del club"
        sub={club.name}
        action={
          <md-text-button onClick={() => navigate('/club/capitania')}>Capitanía</md-text-button>
        }
      />

      {banner && (
        <p
          className={`club-banner body-medium${banner.kind === 'error' ? ' club-banner--error' : ''}`}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </p>
      )}

      {/* ---- Datos ---- */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Datos del club</h2>
        <label className="label-medium manage-field">
          Nombre
          <input
            className="tz-input body-medium"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="admin-emblema">
          {emblemaUrl ? (
            <img className="admin-emblema__muestra" src={emblemaUrl} alt="Emblema del club" />
          ) : (
            <span
              className="admin-emblema__muestra"
              aria-hidden="true"
              style={color ? { background: color } : undefined}
            >
              {emblema || '📖'}
            </span>
          )}
          <div className="admin-emblema__opciones">
            <span className="label-medium">Emblema del club</span>

            {/* Una imagen propia manda sobre el emoji */}
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void subirEmblema(f)
                e.target.value = ''
              }}
            />
            <div className="admin-emblema__subir">
              <md-outlined-button
                disabled={busy || undefined}
                onClick={() => fotoRef.current?.click()}
              >
                <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
                  add
                </span>
                {emblemaUrl ? 'Cambiar la imagen' : 'Subir una imagen'}
              </md-outlined-button>
              {emblemaUrl && (
                <md-text-button disabled={busy || undefined} onClick={() => void quitarEmblema()}>
                  Quitarla
                </md-text-button>
              )}
            </div>

            <span className="body-small on-surface-variant">
              {emblemaUrl
                ? 'Se usa la imagen. Si la quitas, vuelve a valer el emoji.'
                : 'O elige un emoji y un color mientras no tengas escudo propio.'}
            </span>
            <div className="admin-emblema__emojis">
              {EMBLEMAS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`admin-emblema__emoji${emblema === e ? ' activo' : ''}`}
                  aria-label={`Elegir ${e} como emblema`}
                  onClick={() => setEmblema(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="admin-emblema__colores">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`admin-emblema__color${color === c ? ' activo' : ''}`}
                  style={{ background: c }}
                  aria-label={`Fondo ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <label className="label-medium manage-field">
          Descripción
          <textarea
            className="tz-input body-medium"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="club-poll__form-actions">
          <md-filled-button disabled={busy || undefined} onClick={() => void guardarDatos()}>
            Guardar
          </md-filled-button>
        </div>
      </div>

      {/* ---- Capitanía: modo, duración y nombramiento ---- */}
      <CaptainCard club={club} members={members} onChanged={() => void load()} />

      {/* ---- Miembros ---- */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Miembros ({members.length})</h2>
        <p className="body-small on-surface-variant">
          Para cambiar de capitán usa la tarjeta de arriba. Aquí solo se expulsa.
        </p>
        <div className="club-members">
          {members.map((m) => (
            <div key={m.id} className="club-member">
              <span className="club-member__id">
                <Avatar name={m.display_name} url={m.avatar_url} size={38} />
                <span className="club-member__names">
                  <span className="title-small">
                    {m.display_name}
                    {m.role === 'captain' && (
                      <span className="label-small" style={{ color: 'var(--md-sys-color-primary)' }}>
                        {' '}★ capitán
                      </span>
                    )}
                  </span>
                  <span className="body-small on-surface-variant">@{m.username}</span>
                </span>
              </span>
              {m.role !== 'captain' && (
                <button
                  className="manage-kick"
                  aria-label={`Expulsar a ${m.display_name}`}
                  disabled={busy}
                  onClick={() => void expulsar(m.id, m.display_name)}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">
                    person_remove
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Afiliados ---- */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Enlaces de compra</h2>
        <p className="body-medium">
          Si pones aquí tu etiqueta de afiliado de Amazon, los botones de conseguir el
          libro la llevarán y el club se lleva una comisión sin coste para nadie. Se
          avisa siempre de que es un enlace de afiliado, que es obligatorio.
        </p>
        <label className="label-medium manage-field">
          Etiqueta de afiliado
          <input
            className="tz-input body-medium"
            placeholder="p. ej. miclub-21"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </label>
        <p className="body-small on-surface-variant">
          Se guarda con el botón de arriba, junto a los datos del club.
        </p>
      </div>

      {/* ---- Invitar ---- */}
      <div className="manage-card">
        <h2 className="title-small manage-card__title">Invitar</h2>
        <p className="body-medium">
          Quien se registre con el código entra directamente en el club.
        </p>
        <div className="admin-invite">
          <span className="admin-invite__dato">
            <span className="label-medium on-surface-variant">Enlace</span>
            <span className="body-medium">{invitacion}</span>
          </span>
          <span className="admin-invite__dato">
            <span className="label-medium on-surface-variant">Código</span>
            <span className="title-medium admin-invite__codigo">{codigo ?? '···'}</span>
          </span>
        </div>
        <div className="club-poll__form-actions">
          <md-outlined-button onClick={() => void copiar()}>
            <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
              send
            </span>
            {copiado ? 'Copiado' : 'Copiar invitación'}
          </md-outlined-button>
        </div>
        <p className="body-small on-surface-variant">
          El código se cambia desde Administración, en la pestaña Usuarios.
        </p>
      </div>
    </section>
  )
}
