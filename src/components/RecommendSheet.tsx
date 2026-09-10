import { useEffect, useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import { useModalBehavior } from './modal'
import { Avatar } from './ui'
import './ComposeSheet.css'
import './recommend.css'

interface Persona {
  id: string
  name: string
  username: string
  avatar: string | null
  /** ya lo tiene en su estantería: no hace falta recomendárselo */
  yaLoTiene: boolean
  /** ya se lo recomendaste antes */
  yaEnviada: boolean
}

/**
 * «Marina, este te va a encantar».
 *
 * La primera acción de esta app de una persona hacia otra persona. Todo
 * lo demás gira alrededor del libro del mes; esto va de dos personas que
 * se conocen los gustos.
 *
 * A quien ya lo tiene en su estantería no se le puede recomendar: la
 * gracia es descubrirle algo, no repetirle lo que ya sabe.
 */
export default function RecommendSheet({
  open,
  bookId,
  bookTitle,
  onClose,
  onSent,
}: {
  open: boolean
  bookId: string
  bookTitle: string
  onClose: () => void
  onSent?: (nombre: string) => void
}) {
  const { session } = useAuth()
  const ref = useModalBehavior(open, onClose)
  const [gente, setGente] = useState<Persona[] | null>(null)
  const [elegida, setElegida] = useState<Persona | null>(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !session) return
    let cancelado = false
    setElegida(null)
    setNota('')
    setError(null)
    const load = async () => {
      const { data: mios } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', session.user.id)
      const clubes = (mios ?? []).map((m) => m.club_id)
      if (clubes.length === 0) {
        if (!cancelado) setGente([])
        return
      }
      const { data: miembros } = await supabase
        .from('club_members')
        .select('user_id')
        .in('club_id', clubes)
      const ids = [...new Set((miembros ?? []).map((m) => m.user_id))].filter(
        (id) => id !== session.user.id,
      )
      if (ids.length === 0) {
        if (!cancelado) setGente([])
        return
      }
      const [{ data: perfiles }, { data: progreso }, { data: enviadas }] =
        await Promise.all([
          supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids),
          supabase.from('reading_progress').select('user_id').eq('book_id', bookId).in('user_id', ids),
          supabase
            .from('recommendations')
            .select('to_user')
            .eq('from_user', session.user.id)
            .eq('book_id', bookId),
        ])
      if (cancelado) return
      const tienen = new Set((progreso ?? []).map((p) => p.user_id))
      const ya = new Set((enviadas ?? []).map((r) => r.to_user))
      setGente(
        (perfiles ?? [])
          .map((p) => ({
            id: p.id,
            name: p.display_name,
            username: p.username,
            avatar: p.avatar_url,
            yaLoTiene: tienen.has(p.id),
            yaEnviada: ya.has(p.id),
          }))
          .sort((a, b) => Number(a.yaLoTiene) - Number(b.yaLoTiene)),
      )
    }
    void load()
    return () => {
      cancelado = true
    }
  }, [open, session, bookId])

  if (!open) return null

  const enviar = async () => {
    if (!elegida) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('recommend_book', {
      p_book: bookId,
      p_to: elegida.id,
      p_note: nota.trim() || null,
    })
    if (error) {
      setError(friendlyError(error, 'No se pudo enviar la recomendación.'))
      setBusy(false)
      return
    }
    setBusy(false)
    onSent?.(elegida.name.split(/\s+/)[0])
    onClose()
  }

  const disponibles = (gente ?? []).filter((p) => !p.yaLoTiene)

  return (
    <div className="sheet-scrim" role="presentation" onClick={onClose}>
      <div
        ref={ref}
        className="sheet recom"
        role="dialog"
        aria-modal="true"
        aria-label={`Recomendar ${bookTitle}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" aria-hidden />

        {elegida ? (
          /* ---- Paso 2: el mensaje ---- */
          <>
            <div className="sheet__head">
              <button type="button" className="recom__back label-large" onClick={() => setElegida(null)}>
                <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                Elegir a otra persona
              </button>
            </div>

            <div className="recom__quien">
              <Avatar name={elegida.name} url={elegida.avatar} size={44} />
              <span>
                <span className="title-medium serif">
                  Para {elegida.name.split(/\s+/)[0]}
                </span>
                <span className="body-small on-surface-variant" style={{ display: 'block' }}>
                  Le llegará un aviso con «{bookTitle}»
                </span>
              </span>
            </div>

            <label className="label-medium recom__campo">
              ¿Por qué se lo recomiendas? Opcional
              <textarea
                className="tz-input body-medium"
                rows={3}
                maxLength={300}
                autoFocus
                placeholder={`Este te va a encantar…`}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </label>

            {error && <p className="sheet__error body-medium">{error}</p>}

            <div className="sheet__actions">
              <md-text-button onClick={onClose}>Cancelar</md-text-button>
              <span style={{ flex: 1 }} />
              <md-filled-button disabled={busy || undefined} onClick={() => void enviar()}>
                {busy ? 'Enviando…' : 'Recomendárselo'}
              </md-filled-button>
            </div>
          </>
        ) : (
          /* ---- Paso 1: a quién ---- */
          <>
            <div className="sheet__head">
              <h2 className="title-large serif">¿A quién se lo recomiendas?</h2>
            </div>
            <p className="body-small on-surface-variant recom__pista">
              A la gente de tu club. Quien ya lo tiene en su estantería no sale: la
              gracia es descubrirle algo.
            </p>

            {gente === null ? (
              <p className="body-medium on-surface-variant recom__pista">Cargando…</p>
            ) : disponibles.length === 0 ? (
              <p className="body-medium on-surface-variant recom__pista">
                {gente.length === 0
                  ? 'Todavía no hay nadie más en tu club.'
                  : 'Todo el club lo tiene ya en su estantería.'}
              </p>
            ) : (
              <div className="recom__gente">
                {disponibles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="recom__persona"
                    onClick={() => setElegida(p)}
                  >
                    <Avatar name={p.name} url={p.avatar} size={40} />
                    <span className="recom__persona-txt">
                      <span className="title-small">{p.name}</span>
                      <span className="body-small on-surface-variant">
                        {p.yaEnviada ? 'Ya se lo recomendaste, se lo recordarás' : `@${p.username}`}
                      </span>
                    </span>
                    <span className="material-symbols-rounded recom__chev" aria-hidden="true">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="sheet__actions">
              <span style={{ flex: 1 }} />
              <md-text-button onClick={onClose}>Cerrar</md-text-button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
