import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import { useAuth } from '../../auth/AuthContext'
import { BookCover } from '../../components/ui'
import './landing.css'

/**
 * Landing pública: el escaparate de Tsundoku Zero para quien llega sin
 * sesión. Su pieza central es la DEMO del candado: mueves tu progreso
 * y ves desbloquearse la conversación. Con sesión redirige al feed.
 */

const FEATURES = [
  {
    icon: 'lock',
    title: 'Spoilers imposibles',
    body: 'Cada mensaje queda anclado al capítulo en que se escribió. Si aún no has llegado, ni siquiera viaja a tu pantalla: se libera cuando tú llegas.',
  },
  {
    icon: 'forum',
    title: 'Conversación por capítulos',
    body: 'Teorías, preguntas y reacciones en el punto exacto del libro. Hilos, respuestas y reacciones, como en tu red social favorita.',
  },
  {
    icon: 'notifications',
    title: 'Respuestas que se desbloquean',
    body: 'Alguien que va por delante te contesta hoy; tú lo lees al llegar a su capítulo, con aviso incluido. Leer se vuelve abrir regalos.',
  },
  {
    icon: 'how_to_vote',
    title: 'El club vota el siguiente',
    body: 'Votaciones con los candidatos del catálogo, su sinopsis y su portada. El libro ganador pasa a ser la lectura del mes, solo.',
  },
  {
    icon: 'star',
    title: 'Reseñas selladas',
    body: 'Las reseñas y estrellas del final solo se abren cuando TÚ terminas el libro. Nada de opiniones que condicionan a mitad de lectura.',
  },
  {
    icon: 'auto_stories',
    title: 'Tu ritmo, tus libros',
    body: 'Lleva el libro del club y tus lecturas personales a la vez, con tu progreso en cada una. Tu biblioteca, tus estanterías, tu paso.',
  },
]

const STEPS = [
  {
    title: 'Entra con tu invitación',
    body: 'Tsundoku Zero funciona por clubes: alguien de tu club te pasa el código y en un minuto estás dentro.',
  },
  {
    title: 'Marca por dónde vas',
    body: 'Fija tu capítulo actual. Ese gesto decide qué conversaciones ves — y protege las demás.',
  },
  {
    title: 'Comparte sin miedo',
    body: 'Escribe esa teoría loca en cuanto se te ocurra. Solo la leerá quien ya haya llegado.',
  },
]

const MARQUEE_BOOKS = [
  { title: 'La Biblioteca de la Medianoche', author: 'Matt Haig' },
  { title: 'Stoner', author: 'John Williams' },
  { title: 'El extranjero', author: 'Albert Camus' },
  { title: 'La muerte de Iván Ilich', author: 'Lev Tolstói' },
  { title: 'Los detectives salvajes', author: 'Roberto Bolaño' },
  { title: 'Piranesi', author: 'Susanna Clarke' },
]

/* ============ Demo interactiva del candado ============ */

const DEMO_MESSAGES = [
  {
    cap: 2,
    who: 'Marina',
    text: 'El prólogo ya me ha roto un poquito. 🥺',
  },
  {
    cap: 5,
    who: 'Carlos',
    text: 'Teoría: la biblioteca es un multiverso y cada libro es una vida. 💡',
  },
  {
    cap: 8,
    who: 'Pau',
    text: 'LO DEL CAPÍTULO 8 NO ME LO ESPERABA. Necesito hablarlo YA. 😱',
  },
]

function GateDemo() {
  const [chapter, setChapter] = useState(3)
  return (
    <div className="landing-demo" data-reveal>
      <span className="label-medium landing-kicker">Pruébalo ahora mismo</span>
      <h2 className="landing-demo__title serif">
        Mueve tu progreso y mira qué pasa
      </h2>
      <div className="landing-demo__slider">
        <span className="label-large landing-demo__cap serif">
          Cap. {chapter}
        </span>
        <input
          type="range"
          className="progress-slider"
          min={1}
          max={10}
          value={chapter}
          aria-label="Tu capítulo actual (demo)"
          onChange={(e) => setChapter(Number(e.target.value))}
        />
      </div>
      <div className="landing-demo__feed">
        {DEMO_MESSAGES.map((m) =>
          chapter >= m.cap ? (
            <div key={m.cap} className="landing-demo__msg">
              <span className="landing-demo__who serif">{m.who}</span>
              <span className="landing-demo__capchip label-small">
                cap. {m.cap}
              </span>
              <p className="body-medium">{m.text}</p>
            </div>
          ) : (
            <div key={m.cap} className="landing-demo__msg locked" aria-hidden>
              <span className="landing-demo__who serif">{m.who}</span>
              <span className="landing-demo__capchip label-small">
                cap. {m.cap}
              </span>
              <p className="body-medium landing-demo__blur">{m.text}</p>
              <span className="landing-demo__lock body-small">
                <span className="material-symbols-rounded">lock</span>
                Se desbloquea en el cap. {m.cap}
              </span>
            </div>
          ),
        )}
      </div>
      <p className="body-small on-surface-variant landing-demo__note">
        Y esto es solo la demo: en la app real el texto bloqueado{' '}
        <b>ni siquiera viaja a tu dispositivo</b>. Lo garantiza el servidor,
        no un efecto visual.
      </p>
    </div>
  )
}

export default function LandingPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  // Aparición suave de las secciones al hacer scroll
  useEffect(() => {
    const els = document.querySelectorAll('.landing [data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Con sesión, el escaparate sobra: directo al feed
  if (!loading && session) return <Navigate to="/" replace />

  return (
    <div className="landing">
      {/* ===== Barra superior ===== */}
      <header className="landing-bar">
        <span className="landing-logo">
          <span className="landing-logo__mark" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="landing-logo__word">
            Tsundoku <em>Zero</em>
          </span>
        </span>
        <md-outlined-button onClick={() => navigate('/login')}>
          Entrar
        </md-outlined-button>
      </header>

      {/* ===== Héroe ===== */}
      <section className="landing-hero">
        <div className="landing-hero__text">
          <span className="label-medium landing-kicker">
            Tu club de lectura, sin spoilers
          </span>
          <h1 className="landing-hero__title serif">
            Leer acompañado,
            <br />
            <em>sin que nadie te destripe el final.</em>
          </h1>
          <p className="body-large landing-hero__sub">
            La red social donde tu club comenta cada libro capítulo a
            capítulo. Cada conversación se desbloquea a <b>tu</b> ritmo:
            escribir sin miedo, leer sin sustos.
          </p>
          <div className="landing-hero__cta">
            <md-filled-button onClick={() => navigate('/login')}>
              Entrar con mi invitación
            </md-filled-button>
            <span className="body-small on-surface-variant">
              ¿Sin código? Pídeselo a tu club.
            </span>
          </div>
        </div>
        <div className="landing-hero__art" aria-hidden>
          <div className="landing-fan">
            <div className="landing-fan__item landing-fan__item--a">
              <BookCover title="Stoner" author="John Williams" size="lg" />
            </div>
            <div className="landing-fan__item landing-fan__item--b">
              <BookCover
                title="La Biblioteca de la Medianoche"
                author="Matt Haig"
                size="xl"
              />
            </div>
            <div className="landing-fan__item landing-fan__item--c">
              <BookCover title="El extranjero" author="Albert Camus" size="lg" />
            </div>
          </div>
          <div className="landing-bubble landing-bubble--locked body-small">
            <span className="material-symbols-rounded">lock</span>
            Desbloquearás esta idea al llegar al capítulo 24
          </div>
          <div className="landing-bubble body-small">
            «¿Nadie va a hablar del gato? 🐈» — cap. 6
          </div>
        </div>
      </section>

      {/* ===== Cifras de la casa ===== */}
      <div className="landing-stats" data-reveal>
        <div className="landing-stat">
          <span className="landing-stat__num serif">0</span>
          <span className="label-medium">spoilers posibles</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat__num serif">100%</span>
          <span className="label-medium">a tu ritmo</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat__num serif">∞</span>
          <span className="label-medium">teorías locas</span>
        </div>
      </div>

      {/* ===== Demo interactiva ===== */}
      <GateDemo />

      {/* ===== Manifiesto ===== */}
      <p className="landing-manifesto serif" data-reveal>
        Los libros se disfrutan más cuando se comparten —
        <br />y se estropean cuando alguien se adelanta.
        <br />
        <em>Arreglamos lo segundo para que hagas mucho lo primero.</em>
      </p>

      {/* ===== Qué hay dentro ===== */}
      <section className="landing-section" data-reveal>
        <h2 className="landing-section__title serif">Qué hay dentro</h2>
        <div className="landing-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-card">
              <span className="landing-card__icon material-symbols-rounded">
                {f.icon}
              </span>
              <h3 className="title-medium serif">{f.title}</h3>
              <p className="body-medium on-surface-variant">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Cinta de portadas ===== */}
      <div className="landing-marquee" aria-hidden>
        <div className="landing-marquee__track">
          {[...MARQUEE_BOOKS, ...MARQUEE_BOOKS].map((b, i) => (
            <div key={i} className="landing-marquee__item">
              <BookCover title={b.title} author={b.author} size="lg" />
            </div>
          ))}
        </div>
      </div>

      {/* ===== Cómo funciona ===== */}
      <section className="landing-section" data-reveal>
        <h2 className="landing-section__title serif">Cómo funciona</h2>
        <ol className="landing-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="landing-step">
              <span className="landing-step__num serif">{i + 1}</span>
              <div>
                <h3 className="title-medium serif">{s.title}</h3>
                <p className="body-medium on-surface-variant">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== CTA final ===== */}
      <section className="landing-final" data-reveal>
        <h2 className="landing-final__title serif">El libro no avanza solo.</h2>
        <md-filled-button onClick={() => navigate('/login')}>
          Entrar en Tsundoku Zero
        </md-filled-button>
      </section>

      {/* ===== Pie ===== */}
      <footer className="landing-foot">
        <nav className="landing-foot__links" aria-label="Información legal">
          <Link to="/legal/terminos">Términos</Link>
          <Link to="/legal/privacidad">Privacidad</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/aviso-legal">Aviso legal</Link>
          <Link to="/legal/transparencia">Transparencia</Link>
        </nav>
        <p className="body-small on-surface-variant">
          © 2026 Tsundoku Zero · v{__APP_VERSION__} beta · Hecho para leer
          mejor acompañado
        </p>
      </footer>
    </div>
  )
}
