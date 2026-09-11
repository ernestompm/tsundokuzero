import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/iconbutton/icon-button.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../auth/AuthContext'
import { useModalBehavior } from './modal'
import { Chip } from './ui'
import type { DevNote } from '../lib/database.types'
import './devnote.css'

const TIPOS: { id: DevNote['kind']; label: string; pista: string }[] = [
  { id: 'fallo', label: 'Algo falla', pista: '¿Qué hiciste y qué pasó en vez de lo que esperabas?' },
  { id: 'idea', label: 'Se me ocurre', pista: '¿Qué echas de menos aquí?' },
  { id: 'texto', label: 'Está mal dicho', pista: '¿Qué frase chirría y cómo la dirías tú?' },
]

const ESTADO: Record<DevNote['status'], string> = {
  open: 'Pendiente',
  doing: 'En ello',
  done: 'Hecho',
  wontfix: 'Descartado',
}

/**
 * Notas de desarrollo de los probadores (migr. 038).
 *
 * Solo lo ve quien está marcado como probador: esto no es un buzón de
 * sugerencias abierto, es un canal corto con la gente de confianza que
 * está rompiendo la app a propósito.
 *
 * La nota se guarda con la RUTA desde la que se escribió. Sin eso, la
 * mitad de los avisos son «el botón no va» y no hay manera de saber cuál
 * era el botón.
 */
export default function DevNoteSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { session } = useAuth()
  const location = useLocation()
  const [kind, setKind] = useState<DevNote['kind']>('fallo')
  const [body, setBody] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)
  const [mias, setMias] = useState<DevNote[]>([])

  const sheetRef = useModalBehavior(open, onClose)

  useEffect(() => {
    if (!open) return
    setEnviada(false)
    setError(null)
    void supabase
      .from('dev_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setMias((data as DevNote[] | null) ?? []))
  }, [open])

  if (!open) return null

  const enviar = async () => {
    if (!session) return
    setEnviando(true)
    setError(null)
    const { error: err } = await supabase.from('dev_notes').insert({
      author_id: session.user.id,
      kind,
      body: body.trim(),
      // La pantalla desde la que se escribió, que es media nota
      path: `${location.pathname}${location.search}`.slice(0, 200),
    })
    if (err) setError(friendlyError(err, 'No se ha podido enviar la nota.'))
    else {
      setBody('')
      setEnviada(true)
    }
    setEnviando(false)
  }

  const tipo = TIPOS.find((t) => t.id === kind)!

  return (
    <div className="sheet-scrim" ref={sheetRef} onClick={onClose}>
      <div
        className="sheet devnote"
        role="dialog"
        aria-modal="true"
        aria-label="Nota de desarrollo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2 className="title-large serif">Cuéntamelo</h2>
        </div>
        <p className="body-small on-surface-variant devnote__ruta">
          Desde <code>{location.pathname}</code> · va directo a Ernesto
        </p>

        {enviada ? (
          <div className="devnote__gracias">
            <p className="body-large">Anotado. Gracias.</p>
            <p className="body-medium on-surface-variant">
              Lo verás aquí abajo con su estado cuando se toque.
            </p>
            <md-text-button onClick={() => setEnviada(false)}>
              Contar otra cosa
            </md-text-button>
          </div>
        ) : (
          <>
            <div className="sheet__kinds">
              {TIPOS.map((t) => (
                <Chip key={t.id} active={kind === t.id} onClick={() => setKind(t.id)}>
                  {t.label}
                </Chip>
              ))}
            </div>

            <textarea
              className="sheet__input body-large"
              rows={4}
              autoFocus
              maxLength={2000}
              placeholder={tipo.pista}
              aria-label="Tu nota de desarrollo"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            {error && <p className="sheet__error body-medium">{error}</p>}

            <div className="sheet__actions">
              <span style={{ flex: 1 }} />
              <md-text-button onClick={onClose}>Cerrar</md-text-button>
              <md-filled-button
                disabled={!body.trim() || enviando || undefined}
                onClick={() => void enviar()}
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </md-filled-button>
            </div>
          </>
        )}

        {mias.length > 0 && (
          <>
            <p className="label-medium devnote__titulo">Lo que has contado</p>
            <ul className="devnote__lista">
              {mias.map((n) => (
                <li key={n.id} className="devnote__item">
                  <span className={`devnote__estado label-small ${n.status}`}>
                    {ESTADO[n.status]}
                  </span>
                  <span className="body-small devnote__texto">{n.body}</span>
                  {n.reply && (
                    <span className="body-small devnote__respuesta">
                      Ernesto: {n.reply}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
