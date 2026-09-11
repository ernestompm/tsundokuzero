import { useCallback, useEffect, useState } from 'react'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './ui'
import './readystrip.css'

interface Persona {
  user_id: string
  display_name: string
  avatar_url: string | null
  listo: boolean
  soy_yo: boolean
}

/**
 * «Ya lo tengo» (migr. 038).
 *
 * Entre que se elige la próxima lectura y se empieza hay un hueco raro:
 * hay que conseguir el libro, y nadie sabe quién lo tiene ya. Se acaba
 * preguntando por WhatsApp uno a uno, que es exactamente lo que esta app
 * existe para no hacer.
 *
 * Aquí cada uno lo dice con un botón, el club ve las caras de quién va
 * y quién falta, y el capitán recibe un aviso cuando lo tienen todos.
 * Las caras importan: «faltan 2» no mueve a nadie, «faltas tú» sí.
 */
export default function ReadyStrip({ bookId }: { bookId: string }) {
  const { session } = useAuth()
  const [gente, setGente] = useState<Persona[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('club_ready', { p_book: bookId })
    setGente((data as Persona[] | null) ?? [])
  }, [bookId])

  useEffect(() => {
    void load()
  }, [load])

  if (!gente || gente.length === 0) return null

  const yo = gente.find((g) => g.soy_yo)
  const listos = gente.filter((g) => g.listo)
  const faltan = gente.filter((g) => !g.listo)
  const todos = faltan.length === 0

  const marcar = async (listo: boolean) => {
    if (!session) return
    setBusy(true)
    if (listo) {
      await supabase.from('book_ready').insert({
        book_id: bookId,
        user_id: session.user.id,
      })
    } else {
      await supabase
        .from('book_ready')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', session.user.id)
    }
    await load()
    setBusy(false)
  }

  return (
    <div className="listos">
      <p className="body-small listos__frase">
        {todos ? (
          <b>Ya lo tenéis todos. Solo falta arrancar.</b>
        ) : yo?.listo ? (
          <>
            Tú ya lo tienes.{' '}
            {faltan.length === 1
              ? `Falta ${faltan[0].display_name}.`
              : `Faltan ${faltan.length} de ${gente.length}.`}
          </>
        ) : listos.length === 0 ? (
          <>Todavía no lo tiene nadie. Sé el primero.</>
        ) : (
          <>
            {listos.length === 1
              ? `${listos[0].display_name} ya lo tiene.`
              : `Ya lo tienen ${listos.length} de ${gente.length}.`}{' '}
            <b>Faltas tú.</b>
          </>
        )}
      </p>

      <div className="listos__caras">
        {gente.map((g) => (
          <span
            key={g.user_id}
            className={`listos__cara${g.listo ? ' si' : ''}`}
            title={`${g.display_name}${g.listo ? ' ya lo tiene' : ' todavía no lo tiene'}`}
          >
            <Avatar name={g.display_name} url={g.avatar_url} size={28} />
          </span>
        ))}
      </div>

      {yo?.listo ? (
        <md-text-button disabled={busy || undefined} onClick={() => void marcar(false)}>
          Va a ser que no
        </md-text-button>
      ) : (
        <md-filled-tonal-button
          disabled={busy || undefined}
          onClick={() => void marcar(true)}
        >
          <span slot="icon" className="material-symbols-rounded" aria-hidden="true">
            check_circle
          </span>
          Ya lo tengo
        </md-filled-tonal-button>
      )}
    </div>
  )
}
