import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { partirMenciones } from '../lib/mentions'
import './mentions.css'

/**
 * Pinta un texto respetando los saltos de línea y convirtiendo las
 * menciones en enlaces al perfil de esa persona.
 *
 * Sin `innerHTML` en ningún momento: el texto lo escribe gente y aquí
 * solo se parte y se pinta como nodos de React, así que no hay forma de
 * colar marcado.
 */
export default function MentionText({
  text,
  className,
}: {
  /** null cuando el mensaje está bloqueado por el candado */
  text: string | null
  className?: string
}) {
  const trozos = partirMenciones(text ?? '')
  return (
    <span className={className}>
      {trozos.map((t, i) =>
        t.tipo === 'mencion' ? (
          <Link
            key={i}
            to={`/u/${t.valor}`}
            className="mencion"
            onClick={(e) => e.stopPropagation()}
          >
            @{t.valor}
          </Link>
        ) : (
          <Fragment key={i}>{t.valor}</Fragment>
        ),
      )}
    </span>
  )
}
