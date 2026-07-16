import RichText from '../../components/RichText'
import './author.css'

/**
 * /preview/author — revisión de diseño de la ficha de autor con texto
 * rico, sin login. Muestra todos los formatos que admite la biografía.
 */
const SAMPLE_BIO = `Matt Haig es un escritor británico situado entre la ficción especulativa, la fábula filosófica y la literatura de consuelo. Sus historias suelen partir de una idea fantástica —una biblioteca con vidas alternativas, un extraterrestre que observa a los humanos— para hablar de problemas profundamente cotidianos.

## Cómo escribe

### Ideas fantásticas al servicio de preguntas humanas

Utiliza un elemento extraordinario como una especie de experimento filosófico:

> ¿Qué pasaría si pudiéramos vivir todas las vidas que descartamos?

La fantasía es el mecanismo; el verdadero asunto es siempre emocional. Procura rodear los elementos fantásticos de detalles reales para que la historia resulte emocionalmente verosímil.

### Oscuridad que termina buscando la luz

Sus personajes suelen comenzar en un lugar de:

- soledad
- duelo
- ansiedad o depresión
- arrepentimiento

## Principales influencias

- **Stephen King**, que despertó su deseo de escribir
- **Emily Dickinson**, cuya poesía le dio esperanza durante su enfermedad
- **Italo Calvino**, por su imaginación y cualidad meditativa

## Sus libros más representativos

| Libro | Qué encontrarás |
| --- | --- |
| Razones para seguir viviendo | Su experiencia real con la depresión y la recuperación. |
| Los humanos | Una mirada divertida y afectuosa sobre nuestra especie. |
| La biblioteca de la medianoche | Arrepentimiento, vidas alternativas y aceptación. |

## En una frase

**Matt Haig escribe fábulas contemporáneas sobre personas que han perdido la esperanza y descubren que la vida no necesita ser perfecta para merecer la pena.**`

export default function AuthorPreview() {
  return (
    <section className="author">
      <header className="author-head">
        <span className="author-head__initial serif" aria-hidden>
          M
        </span>
        <h1 className="headline-medium serif">Matt Haig</h1>
        <p className="body-medium on-surface-variant">Reino Unido · n. 1975</p>
      </header>
      <RichText text={SAMPLE_BIO} className="author-bio" />
    </section>
  )
}
