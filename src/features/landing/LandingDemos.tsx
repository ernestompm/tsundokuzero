import { useState } from 'react'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import BookMap, { type MapReader } from '../book/BookMap'
import { RatingBarsCompare } from '../../components/RatingBars'
import { BadgeRow } from '../../components/Badges'
import { Avatar, BookCover } from '../../components/ui'
import Stars from '../../components/Stars'
import './landingdemos.css'

/* ================================================================
   1 · EL MAPA DEL LIBRO
   Se enseña el componente REAL de la app, no un dibujo. Mueves tu
   capítulo y ves cómo se levanta la niebla: es exactamente lo que
   pasa dentro.
   ================================================================ */

const LECTORES: MapReader[] = [
  { id: 'e', name: 'Tú', avatar: null, chapter: 0, isMe: true },
  { id: 'm', name: 'Marina Álvarez', avatar: null, chapter: 21, isMe: false },
  { id: 'c', name: 'Carlos Ruiz', avatar: null, chapter: 21, isMe: false },
  { id: 'l', name: 'Lucía Prat', avatar: null, chapter: 46, isMe: false },
  { id: 'j', name: 'Jorge Sanz', avatar: null, chapter: 6, isMe: false },
]

const CALOR = new Map<number, number>([
  [2, 3], [4, 7], [5, 2], [8, 11], [12, 4], [14, 9], [18, 3],
  [21, 6], [24, 2], [28, 8], [31, 14], [35, 5], [40, 9], [44, 3],
])

export function MapaDemo() {
  const [cap, setCap] = useState(14)
  const lectores = LECTORES.map((l) => (l.isMe ? { ...l, chapter: cap } : l))

  return (
    <section className="ldemo" data-reveal>
      <div className="ldemo__cabecera">
        <span className="label-medium ldemo__kicker">El mapa del libro</span>
        <h2 className="ldemo__titulo serif">
          Ves a todo tu club repartido por el libro.
        </h2>
        <p className="body-large ldemo__sub">
          Y ves dónde ha ardido la conversación, pero <b>solo por donde ya has
          pasado</b>. Lo de delante está en niebla, porque saber que en el
          capítulo 31 hay treinta mensajes ya sería contarte algo.
        </p>
      </div>

      <div className="ldemo__caja">
        <BookMap totalChapters={48} myChapter={cap} heat={CALOR} readers={lectores} />

        <label className="ldemo__control label-medium">
          Mueve tu capítulo y mira cómo se ilumina
          <input
            type="range"
            min={0}
            max={48}
            value={cap}
            aria-label="Tu capítulo en la demostración del mapa"
            onChange={(e) => setCap(Number(e.target.value))}
          />
          <span className="ldemo__valor">Capítulo {cap} de 48</span>
        </label>
      </div>
    </section>
  )
}

/* ================================================================
   2 · EL ESTRENO
   Las reseñas del club no se abren una a una: se abren TODAS a la
   vez cuando termina la última persona.
   ================================================================ */

const RESENAS = [
  { quien: 'Marina', nota: 5, texto: 'Me ha dejado tocada una semana. El final lo cambia todo.' },
  { quien: 'Carlos', nota: 3, texto: 'Bien escrito, pero se me hizo largo a partir de la mitad.' },
  { quien: 'Lucía', nota: 5, texto: 'Mi libro del año. Lo he vuelto a empezar al terminarlo.' },
  { quien: 'Jorge', nota: 4, texto: 'No esperaba llorar con un libro sobre una biblioteca.' },
]

export function EstrenoDemo() {
  const [abierto, setAbierto] = useState(false)

  return (
    <section className="ldemo" data-reveal>
      <div className="ldemo__cabecera">
        <span className="label-medium ldemo__kicker">El estreno</span>
        <h2 className="ldemo__titulo serif">
          Nadie lee una reseña antes de tiempo.
        </h2>
        <p className="body-large ldemo__sub">
          Las reseñas del club se abren <b>todas a la vez</b>, cuando termina la
          última persona. Nadie escribe condicionado por lo que dijo otro, y
          terminar un libro pasa a ser una fecha de todos.
        </p>
      </div>

      <div className="ldemo__caja">
        <div className={`lestreno${abierto ? ' abierto' : ''}`}>
          {RESENAS.map((r) => (
            <article key={r.quien} className="lestreno__card">
              <div className="lestreno__head">
                <Avatar name={r.quien} size={30} />
                <span className="title-small">{r.quien}</span>
                {abierto && <Stars value={r.nota} size={14} />}
              </div>
              {abierto ? (
                <p className="body-medium lestreno__texto">{r.texto}</p>
              ) : (
                <p className="body-medium lestreno__sello">
                  <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                  Sellada hasta que termine el club
                </p>
              )}
            </article>
          ))}
        </div>

        <div className="ldemo__control ldemo__control--boton">
          {abierto ? (
            <>
              <span className="body-medium lestreno__aviso">
                El club ha terminado. Se abren las cuatro reseñas a la vez.
              </span>
              <md-outlined-button onClick={() => setAbierto(false)}>
                Volver a empezar
              </md-outlined-button>
            </>
          ) : (
            <md-filled-button onClick={() => setAbierto(true)}>
              Que termine el último lector
            </md-filled-button>
          )}
        </div>
      </div>
    </section>
  )
}

/* ================================================================
   3 · LA MENCIÓN QUE ESPERA
   Alguien te nombra cuarenta capítulos por delante. No se pierde y
   no te destripa nada: te llega cuando llegas.
   ================================================================ */

export function MencionDemo() {
  const [cap, setCap] = useState(12)
  const llegado = cap >= 40
  const faltan = Math.max(0, 40 - cap)

  return (
    <section className="ldemo" data-reveal>
      <div className="ldemo__cabecera">
        <span className="label-medium ldemo__kicker">Menciones que esperan</span>
        <h2 className="ldemo__titulo serif">
          «Carlos, esto me ha recordado a ti.»
        </h2>
        <p className="body-large ldemo__sub">
          Nombras a alguien con una arroba. Si va por detrás de ti, le decimos{' '}
          <b>quién y dónde, nunca qué</b>. El mensaje se le abre solo cuando
          llega a ese capítulo.
        </p>
      </div>

      <div className="ldemo__caja">
        <div className={`lmencion${llegado ? ' abierta' : ''}`}>
          <span className="lmencion__icono material-symbols-rounded" aria-hidden="true">
            {llegado ? 'lock_open' : 'lock'}
          </span>
          <div className="lmencion__txt">
            {llegado ? (
              <>
                <span className="title-small">Marina te mencionó</span>
                <span className="body-medium">
                  «@carlos esto me ha recordado a lo que dijiste en el 12, mira el
                  final de este capítulo.»
                </span>
                <span className="body-small lmencion__pie">Capítulo 40 · ya puedes leerlo</span>
              </>
            ) : (
              <>
                <span className="title-small">
                  Marina te ha mencionado en el capítulo 40
                </span>
                <span className="body-medium">
                  Te {faltan === 1 ? 'falta 1 capítulo' : `faltan ${faltan} capítulos`} para
                  poder leerlo.
                </span>
                <span className="body-small lmencion__pie">
                  No sabes qué dijo. Solo que pensó en ti.
                </span>
              </>
            )}
          </div>
        </div>

        <label className="ldemo__control label-medium">
          Sigue leyendo y mira qué pasa al llegar al 40
          <input
            type="range"
            min={0}
            max={48}
            value={cap}
            aria-label="Tu capítulo en la demostración de menciones"
            onChange={(e) => setCap(Number(e.target.value))}
          />
          <span className="ldemo__valor">Vas por el capítulo {cap}</span>
        </label>
      </div>
    </section>
  )
}

/* ================================================================
   4 · LO QUE TE LLEVAS
   Trozos reales de la app, con sus componentes de verdad.
   ================================================================ */

const CLUB_DIMS = { d_think: 4.3, d_flow: 4.1, d_feel: 4.6, d_recommend: 4.2 }
const MIS_DIMS = { d_think: 5, d_flow: 3, d_feel: 5, d_recommend: 4 }

const INSIGNIAS = [
  { id: 'f', icon: 'auto_stories', nombre: 'Fundador', detalle: 'De los primeros del club', tono: 'oro' as const },
  { id: 'l', icon: 'menu_book', nombre: 'Cinco libros', detalle: 'Cinco terminados con el club', tono: 'salvia' as const },
  { id: 'p', icon: 'local_fire_department', nombre: 'Va por delante', detalle: 'Primero en terminar tres veces', tono: 'salvia' as const },
]

export function MockupsDemo() {
  return (
    <section className="ldemo ldemo--mocks" data-reveal>
      <div className="ldemo__cabecera">
        <span className="label-medium ldemo__kicker">Por dentro</span>
        <h2 className="ldemo__titulo serif">Trozos de verdad de la app.</h2>
        <p className="body-large ldemo__sub">
          Esto no son dibujos: son las mismas piezas que vas a usar dentro.
        </p>
      </div>

      <div className="lmocks">
        {/* Valoración por dimensiones */}
        <article className="lmock">
          <h3 className="title-small lmock__titulo">Por qué gustó, no solo cuánto</h3>
          <p className="body-small on-surface-variant lmock__sub">
            La barra es la media del club. La marca eres tú.
          </p>
          <RatingBarsCompare mine={MIS_DIMS} club={CLUB_DIMS} />
        </article>

        {/* Recomendación recibida */}
        <article className="lmock">
          <h3 className="title-small lmock__titulo">Alguien te recomienda algo</h3>
          <div className="lmock__reco">
            <BookCover title="Stoner" author="John Williams" size="md" />
            <div>
              <span className="body-small on-surface-variant">
                <b>Marina</b> te lo recomienda
              </span>
              <span className="title-small serif lmock__libro">Stoner</span>
              <p className="body-small lmock__nota">
                «Sé que odias las novelas de campus, pero esta va de otra cosa.»
              </p>
            </div>
          </div>
        </article>

        {/* Insignias */}
        <article className="lmock">
          <h3 className="title-small lmock__titulo">Insignias que se ganan leyendo</h3>
          <p className="body-small on-surface-variant lmock__sub">
            Ninguna se consigue por abrir la aplicación.
          </p>
          <BadgeRow badges={INSIGNIAS} />
        </article>

        {/* Afinidad */}
        <article className="lmock">
          <h3 className="title-small lmock__titulo">En qué os parecéis leyendo</h3>
          <p className="body-medium lmock__afinidad">
            Habéis terminado 7 libros los dos. Tú eres más generoso: le pones 0,4
            estrellas más de media. Donde más os separáis: a ti se te van solos y
            a Carlos le cuestan más.
          </p>
          <p className="body-small on-surface-variant">
            Y el libro en el que no os ponéis de acuerdo, que es del que más se habla.
          </p>
        </article>
      </div>
    </section>
  )
}
