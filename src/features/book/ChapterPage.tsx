import { useNavigate, useParams } from 'react-router-dom'
import '@material/web/button/text-button.js'
import { Card } from '../../components/ui'

export default function ChapterPage() {
  const { number } = useParams()
  const navigate = useNavigate()

  return (
    <section>
      <md-text-button onClick={() => navigate('/book')}>
        <span slot="icon" className="material-symbols-rounded">
          arrow_back
        </span>
        Libro
      </md-text-button>
      <h1 className="headline-small serif" style={{ margin: '8px 0 12px' }}>
        Capítulo {number}
      </h1>
      <Card tone="soft">
        <p className="body-medium">
          El hilo de conversación de este capítulo (comentarios, teorías y
          preguntas ancladas a tu punto de lectura, con el composer) llega en la
          siguiente entrega.
        </p>
      </Card>
    </section>
  )
}
