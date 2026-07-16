import { useState } from 'react'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import { Chip } from './ui'
import { useModalBehavior } from './modal'
import type { ReportReason, ReportTargetType } from '../lib/database.types'
import './ReportButton.css'

const REASONS: [ReportReason, string][] = [
  ['illegal', 'Contenido ilegal'],
  ['harassment', 'Acoso, odio o difamación'],
  ['spoiler', 'Spoiler malintencionado'],
  ['spam', 'Spam o publicidad'],
  ['ip', 'Infringe derechos de autor'],
  ['other', 'Otro motivo'],
]

/**
 * Denunciar contenido (DSA art. 16 — mecanismo de notificación y acción;
 * auditoría P0-5). Autocontenido: inserta en `reports` y confirma.
 * No se muestra sobre contenido propio ni sin sesión.
 */
export default function ReportButton({
  targetType,
  targetId,
  reportedUserId,
  excerpt,
}: {
  targetType: ReportTargetType
  targetId: string
  /** autor del contenido denunciado (recibirá el motivo si se retira) */
  reportedUserId: string
  /** primeros caracteres del contenido, para la cola de moderación */
  excerpt?: string | null
}) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setReason(null)
    setDetails('')
    setState('idle')
    setError(null)
  }

  // auditoría C-02: Escape cierra, focus trap y restauración de foco
  const scrimRef = useModalBehavior(open, close)

  // Nunca sobre lo propio; nunca sin sesión (el preview de diseño no lo pinta)
  if (!session || session.user.id === reportedUserId) return null

  const submit = async () => {
    if (!reason) return
    setState('busy')
    setError(null)
    const { error: e } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      reported_user_id: reportedUserId,
      target_type: targetType,
      target_id: targetId,
      excerpt: excerpt ? excerpt.slice(0, 300) : null,
      reason,
      details: details.trim() || null,
    })
    if (e) {
      setState('idle')
      // auditoría A-04
      setError(friendlyError(e, 'No se pudo enviar la denuncia. Inténtalo de nuevo.'))
      return
    }
    setState('done')
  }

  return (
    <>
      <button
        type="button"
        className="report-btn"
        aria-label="Denunciar"
        title="Denunciar"
        onClick={() => setOpen(true)}
      >
        {/* auditoría A-06: el botón ya tiene aria-label; el icono es decorativo */}
        <span className="material-symbols-rounded" aria-hidden="true">flag</span>
      </button>

      {open && (
        <div className="report-scrim" ref={scrimRef} onClick={close}>
          <div
            className="report-dialog"
            role="dialog"
            aria-modal="true" /* auditoría C-02 */
            aria-label="Denunciar contenido"
            onClick={(e) => e.stopPropagation()}
          >
            {state === 'done' ? (
              <>
                <h2 className="title-medium">Gracias por avisar</h2>
                <p className="body-medium on-surface-variant">
                  Revisaremos esta denuncia con diligencia. Si retiramos el
                  contenido, su autor recibirá el motivo.
                </p>
                <div className="report-dialog__actions">
                  <md-filled-button onClick={close}>Cerrar</md-filled-button>
                </div>
              </>
            ) : (
              <>
                <h2 className="title-medium">¿Qué ocurre con este contenido?</h2>
                {error && <p className="report-dialog__error body-small">{error}</p>}
                <div className="report-dialog__reasons">
                  {REASONS.map(([key, label]) => (
                    <Chip
                      key={key}
                      className="report-reason"
                      active={reason === key}
                      icon={reason === key ? 'check_circle' : 'radio_button_unchecked'}
                      onClick={() => setReason(key)}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
                <textarea
                  className="tz-input report-dialog__details body-medium"
                  rows={2}
                  maxLength={2000}
                  placeholder="Detalles (opcional)"
                  aria-label="Detalles de la denuncia (opcional)" /* auditoría A-08 */
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
                <div className="report-dialog__actions">
                  <md-text-button onClick={close}>Cancelar</md-text-button>
                  <md-filled-button
                    disabled={!reason || state === 'busy' || undefined}
                    onClick={() => void submit()}
                  >
                    Enviar denuncia
                  </md-filled-button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
