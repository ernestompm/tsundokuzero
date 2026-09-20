import { Avatar } from './ui'
import './alapar.css'

/**
 * «Vais a la par».
 *
 * Si alguien del club está EXACTAMENTE en tu capítulo, se dice. No es un
 * dato que haga falta para nada: es que leer acompañado consiste
 * literalmente en esto y hasta ahora no se notaba en ninguna parte.
 *
 * Aparece sola, dura lo que dure la coincidencia y desaparece en cuanto
 * uno de los dos avanza. Esa es la gracia: pasa poco.
 *
 * No cuesta ni una consulta — el mapa del libro ya trae por dónde va cada
 * uno.
 */
export default function ALaPar({
  gente,
  chapter,
}: {
  gente: { id: string; name: string; avatar: string | null }[]
  chapter: number
}) {
  if (gente.length === 0 || chapter < 1) return null

  const nombres = gente.map((g) => g.name.split(/\s+/)[0])
  const quien =
    nombres.length === 1
      ? nombres[0]
      : nombres.length === 2
        ? `${nombres[0]} y ${nombres[1]}`
        : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`

  return (
    <p className="alapar" role="status">
      <span className="alapar__caras" aria-hidden="true">
        {gente.slice(0, 3).map((g) => (
          <Avatar key={g.id} name={g.name} url={g.avatar} size={26} />
        ))}
      </span>
      <span className="alapar__txt body-small">
        <b>{quien}</b>
        {gente.length === 1 ? ' va' : ' van'} justo por aquí, en el capítulo{' '}
        {chapter}.
      </span>
    </p>
  )
}
