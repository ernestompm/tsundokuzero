import { Link, Navigate, useNavigate } from 'react-router-dom'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import { useAuth } from '../../auth/AuthContext'
import { BookCover } from '../../components/ui'
import './landing.css'

/**
 * Landing pública: el escaparate de Tsundoku Zero para quien llega sin
 * sesión. Toda la información de la app y un único destino: /login.
 * Con sesión iniciada redirige al feed (el marketing no molesta dentro).
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

export default function LandingPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

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
            Leer acompañado, otra vez un placer.
          </h1>
          <p className="body-large landing-hero__sub">
            Tsundoku Zero es la red social donde tu club comenta cada libro
            capítulo a capítulo — y donde es <b>imposible</b> que te destripen
            el final, porque cada conversación se desbloquea a tu ritmo.
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

      {/* ===== Manifiesto ===== */}
      <p className="landing-manifesto serif">
        Los libros se disfrutan más cuando se comparten —
        <br />y se estropean cuando alguien se adelanta.
        <br />
        <em>Arreglamos lo segundo para que hagas mucho lo primero.</em>
      </p>

      {/* ===== Qué hay dentro ===== */}
      <section className="landing-section">
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

      {/* ===== Cómo funciona ===== */}
      <section className="landing-section">
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
      <section className="landing-final">
        <h2 className="landing-final__title serif">
          El libro no avanza solo.
        </h2>
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
