import { useEffect, useState } from 'react'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import MentionText from './MentionText'
import './swear.css'

/**
 * Una respuesta que está cerrada para ti pero cuyo autor JURÓ que no
 * destripa nada (migr. 037).
 *
 * No se abre sola: se te cuenta quién respondió, desde dónde y qué
 * historial de juramentos tiene, y decides tú. Ese es el punto — la
 * inmediatez no puede costarte el libro sin tu permiso.
 *
 * El historial es lo que hace que el juramento pese: se ve cuántas veces
 * ha jurado esa persona y cuántas se lo han denunciado. Un juramento que
 * no se puede romper no vale nada.
 */
export default function SwornReply({
  commentId,
  authorId,
  authorName,
  authorChapter,
  onReported,
}: {
  commentId: string
  authorId: string
  authorName: string
  /** capítulo desde el que se escribió la respuesta */
  authorChapter: number
  onReported?: () => void
}) {
  const [historial, setHistorial] = useState<{ jurados: number; fallos: number } | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denunciada, setDenunciada] = useState(false)

  useEffect(() => {
    let cancelado = false
    void supabase.rpc('record_jurado', { p_user: authorId }).then(({ data }) => {
      const fila = Array.isArray(data) ? data[0] : data
      if (!cancelado && fila) setHistorial(fila as { jurados: number; fallos: number })
    })
    return () => {
      cancelado = true
    }
  }, [authorId])

  const abrir = async () => {
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('reveal_comment', {
      p_comment: commentId,
    })
    if (err) setError(friendlyError(err, 'No se ha podido abrir la respuesta.'))
    else setBody((data as string | null) ?? '')
    setBusy(false)
  }

  const denunciar = async () => {
    setBusy(true)
    const { error: err } = await supabase.from('reports').insert({
      reported_user_id: authorId,
      target_type: 'comment',
      target_id: commentId,
      reason: 'spoiler',
      excerpt: (body ?? '').slice(0, 300),
      details: 'Juró que no había spoiler y lo había.',
    })
    if (err) setError(friendlyError(err, 'No se ha podido enviar la denuncia.'))
    else {
      setDenunciada(true)
      onReported?.()
    }
    setBusy(false)
  }

  /* ---------- Ya abierta ---------- */
  if (body !== null) {
    return (
      <div className="jurada">
        <span className="body-small jurada-sello">
          <span className="material-symbols-rounded" aria-hidden="true">lock_open</span>
          {authorName} respondió desde el capítulo {authorChapter} y juró que no
          había spoiler
        </span>
        <p className="body-medium" style={{ marginTop: 4 }}>
          <MentionText text={body} />
        </p>
        <div className="jurada__acciones">
          {denunciada ? (
            <span className="body-small on-surface-variant">
              Gracias. Queda anotado en su historial.
            </span>
          ) : (
            <button
              type="button"
              className="jurada__denuncia body-small"
              disabled={busy}
              onClick={() => void denunciar()}
            >
              Esto tenía spoiler
            </button>
          )}
        </div>
        {error && <span className="body-small jurada__error">{error}</span>}
      </div>
    )
  }

  /* ---------- Cerrada, esperando tu sí ---------- */
  const fiable = historial && historial.jurados > 0 && historial.fallos === 0

  return (
    <div className="jurada">
      <p className="body-small jurada__head">
        <span className="material-symbols-rounded" aria-hidden="true">lock_open</span>
        <span>
          <span className="jurada__quien">{authorName}</span> respondió desde el
          capítulo {authorChapter} y jura que no destripa nada.
        </span>
      </p>

      {historial && historial.jurados > 1 && (
        <span
          className={`body-small jurada__historial${historial.fallos > 0 ? ' roto' : ''}`}
        >
          {fiable
            ? `Ha jurado ${historial.jurados} veces y nunca ha fallado.`
            : `Ha jurado ${historial.jurados} veces y ${
                historial.fallos === 1
                  ? 'una se le denunció por spoiler'
                  : `${historial.fallos} se le denunciaron por spoiler`
              }.`}
        </span>
      )}

      <div className="jurada__acciones">
        <md-text-button disabled={busy || undefined} onClick={() => void abrir()}>
          Abrir su respuesta
        </md-text-button>
        <span className="body-small on-surface-variant">
          O déjala y se abrirá sola al llegar al {authorChapter}.
        </span>
      </div>
      {error && <span className="body-small jurada__error">{error}</span>}
    </div>
  )
}
