import { useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { olvidarClub } from '../../lib/clubCache'
import { useAuth } from '../../auth/AuthContext'
import './noclub.css'

/**
 * Lo que ves cuando todavía no estás en ningún club (migr. 038).
 *
 * Antes esto era un callejón sin salida: «cuando se cree el club de
 * lectura, aparecerá aquí», y a esperar. Ahora hay dos puertas:
 *
 *  · el código de seis letras que te pasa quien ya está dentro;
 *  · fundar el tuyo, si Ernesto te ha dado el permiso.
 *
 * El permiso se da a dedo y se gasta al usarlo: no es un botón de
 * «crear club» abierto a cualquiera, que es justo lo que no queremos.
 */
export default function NoClub({ onEntrado }: { onEntrado: () => void }) {
  const { profile, isSuperAdmin, refreshProfile } = useAuth()
  const puedeFundar = !!profile?.can_create_club || isSuperAdmin

  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [fundando, setFundando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entrar = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('join_club', {
      p_code: codigo.trim(),
    })
    setBusy(false)
    if (err) {
      setError(friendlyError(err, 'No se ha podido entrar en el club.'))
      return
    }
    olvidarClub()
    onEntrado()
  }

  const fundar = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('create_club', {
      p_name: nombre.trim(),
    })
    setBusy(false)
    if (err) {
      setError(friendlyError(err, 'No se ha podido fundar el club.'))
      return
    }
    olvidarClub()
    await refreshProfile()
    onEntrado()
  }

  return (
    <section className="noclub">
      <h1 className="headline-small serif">Todavía no estás en ningún club</h1>
      <p className="body-large on-surface-variant">
        Un club de lectura son cuatro o cinco personas leyendo el mismo libro
        a la vez. Sin eso, esto es solo una estantería.
      </p>

      {error && (
        <p className="body-medium noclub__error" role="alert">
          {error}
        </p>
      )}

      <div className="noclub__caja">
        <span className="label-medium noclub__kicker">Tengo un código</span>
        <p className="body-small on-surface-variant">
          Seis letras que te pasa quien ya está dentro.
        </p>
        <div className="noclub__fila">
          <input
            className="tz-input body-large noclub__codigo"
            placeholder="abcdef"
            aria-label="Código del club"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <md-filled-button
            disabled={codigo.trim().length < 4 || busy || undefined}
            onClick={() => void entrar()}
          >
            Entrar
          </md-filled-button>
        </div>
      </div>

      {puedeFundar && (
        <div className="noclub__caja">
          <span className="label-medium noclub__kicker">Fundar el mío</span>
          {fundando ? (
            <>
              <p className="body-small on-surface-variant">
                Serás su capitán. Al crearlo te damos un código para invitar a
                los tuyos.
              </p>
              <div className="noclub__fila">
                <input
                  className="tz-input body-large"
                  placeholder="Nombre del club"
                  aria-label="Nombre del club"
                  maxLength={60}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <md-filled-button
                  disabled={nombre.trim().length < 3 || busy || undefined}
                  onClick={() => void fundar()}
                >
                  Fundar
                </md-filled-button>
              </div>
              <md-text-button onClick={() => setFundando(false)}>
                Mejor no
              </md-text-button>
            </>
          ) : (
            <>
              <p className="body-small on-surface-variant">
                Tienes permiso para fundar un club. Se usa una sola vez.
              </p>
              <md-text-button onClick={() => setFundando(true)}>
                Fundar un club
              </md-text-button>
            </>
          )}
        </div>
      )}

      {!puedeFundar && (
        <p className="body-small on-surface-variant noclub__pie">
          ¿Quieres montar el tuyo? Los clubes se fundan con permiso. Pídelo y
          te lo damos.
        </p>
      )}
    </section>
  )
}
