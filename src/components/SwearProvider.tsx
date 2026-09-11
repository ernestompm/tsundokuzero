import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import { supabase } from '../lib/supabase'
import { useModalBehavior } from './modal'
import { Avatar } from './ui'
import './swear.css'

/**
 * El juramento (migr. 037).
 *
 * POR QUÉ EXISTE. El candado anti-spoiler tiene un precio que se paga en
 * las respuestas: si vas por el capítulo 30 y contestas a un pensamiento
 * del 12, tu respuesta se sella para todo el que vaya entre medias. Puede
 * tardar semanas en abrirse. Para entonces ya no hay conversación.
 *
 * Casi siempre esa respuesta no destripaba nada. Así que se pregunta:
 * júralo y la gente de detrás podrá abrirla si quiere. Sin juramento, se
 * sella como hasta ahora. No hay opción por defecto ni casilla premarcada:
 * jurar es un acto, no un descuido.
 *
 * Uso:
 *   const jurar = useSwear()
 *   const r = await jurar({ discussionId, chapterNumber })
 *   if (r === 'cancelado') return
 *   await publicar(texto, r === 'jurado')
 *
 * Llámalo SIEMPRE antes de publicar una respuesta, desde donde sea. Quien
 * decide si hay que preguntar es el servidor (`quien_espera`), que sabe
 * por dónde va cada uno; si no hay nadie por detrás resuelve «sellado» sin
 * abrir nada. Al principio esto se filtraba en el cliente comparando
 * capítulos, y el resultado fue que responder desde el Inicio se saltaba
 * el juramento: la misma acción se comportaba distinto según la pantalla.
 */

export type Juramento = 'jurado' | 'sellado' | 'cancelado'

interface Peticion {
  discussionId: string
  /** capítulo del hilo al que se responde, si quien llama lo sabe */
  chapterNumber?: number | null
}

interface Esperando {
  user_id: string
  display_name: string
  avatar_url: string | null
  chapter: number
}

type SwearFn = (p: Peticion) => Promise<Juramento>

const SwearContext = createContext<SwearFn>(() => Promise.resolve('sellado'))

export function useSwear(): SwearFn {
  return useContext(SwearContext)
}

/** Los nombres en cristiano: «Marina», «Marina y Jorge», «Marina, Jorge y 2 más». */
function enumerar(gente: Esperando[]): string {
  const n = gente.map((g) => g.display_name)
  if (n.length === 1) return n[0]
  if (n.length === 2) return `${n[0]} y ${n[1]}`
  return `${n[0]}, ${n[1]} y ${n.length - 2} más`
}

export function SwearProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<Peticion | null>(null)
  const [gente, setGente] = useState<Esperando[]>([])
  const [juro, setJuro] = useState(false)
  const resolver = useRef<((v: Juramento) => void) | null>(null)

  const jurar = useCallback<SwearFn>(
    (p) =>
      new Promise<Juramento>((resolve) => {
        resolver.current?.('cancelado')
        resolver.current = resolve
        setJuro(false)

        // Si no hay nadie por detrás, el juramento no protege a nadie y
        // preguntarlo solo estorba: se publica y ya está.
        void supabase
          .rpc('quien_espera', { p_discussion: p.discussionId })
          .then(({ data }) => {
            const lista = (data ?? []) as Esperando[]
            if (lista.length === 0) {
              resolver.current = null
              resolve('sellado')
              return
            }
            setGente(lista)
            setPeticion(p)
          })
      }),
    [],
  )

  const settle = (v: Juramento) => {
    resolver.current?.(v)
    resolver.current = null
    setPeticion(null)
    setGente([])
  }

  const dialogRef = useModalBehavior(peticion !== null, () => settle('cancelado'))

  return (
    <SwearContext.Provider value={jurar}>
      {children}
      {peticion && (
        <div className="tz-dialog-scrim" onClick={() => settle('cancelado')}>
          <div
            ref={dialogRef}
            className="tz-dialog jura"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jura-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="jura-title" className="title-large serif">
              {gente.length === 1
                ? `${gente[0].display_name} va por detrás de ti`
                : `${enumerar(gente)} van por detrás de ti`}
            </h2>

            <div className="jura__caras">
              {gente.slice(0, 6).map((g) => (
                <span key={g.user_id} className="jura__cara">
                  <Avatar name={g.display_name} url={g.avatar_url} size={32} />
                  <span className="label-small on-surface-variant">
                    Cap. {g.chapter}
                  </span>
                </span>
              ))}
            </div>

            <p className="body-medium on-surface-variant">
              Tu respuesta se les sellará hasta que lleguen a tu capítulo. Si
              no destripa nada, júralo y podrán abrirla cuando quieran.
            </p>

            <label className="jura__juro body-medium">
              <input
                type="checkbox"
                checked={juro}
                onChange={(e) => setJuro(e.target.checked)}
              />
              <span>
                {peticion.chapterNumber != null ? (
                  <>
                    Juro que mi respuesta no cuenta nada de lo que pasa después
                    del capítulo {peticion.chapterNumber}.
                  </>
                ) : (
                  <>
                    Juro que mi respuesta no cuenta nada de lo que pasa por
                    delante de donde va esta gente.
                  </>
                )}
              </span>
            </label>

            <p className="body-small jura__aviso">
              Queda registrado con tu nombre. Si rompes el juramento,
              cualquiera puede denunciarlo y se ve en tu historial.
            </p>

            <div className="tz-dialog__actions jura__acciones">
              <md-text-button type="button" onClick={() => settle('sellado')}>
                Publicar sellada
              </md-text-button>
              <md-filled-button
                type="button"
                autofocus
                disabled={!juro || undefined}
                onClick={() => settle('jurado')}
              >
                Jurar y responder
              </md-filled-button>
            </div>
          </div>
        </div>
      )}
    </SwearContext.Provider>
  )
}
