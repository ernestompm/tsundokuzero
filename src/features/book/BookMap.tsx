import { useId } from 'react'
import { Avatar } from '../../components/ui'
import './bookmap.css'

export interface MapReader {
  id: string
  name: string
  avatar: string | null
  chapter: number
  isMe: boolean
}

/**
 * El mapa del libro: el libro entero de principio a fin, con el club
 * repartido por él y el rastro de por dónde ha ardido la conversación.
 *
 * NIEBLA DE GUERRA. El calor solo se pinta hasta donde has leído tú. Que
 * el capítulo 31 tenga treinta mensajes es en sí mismo un spoiler: te
 * dice que ahí pasa algo. El territorio por delante se queda apagado y se
 * va iluminando según avanzas, que además es más bonito.
 *
 * Las posiciones de la gente sí se ven enteras: saber que Marina va por
 * el 60 no destripa nada y es justo la parte social.
 */
export default function BookMap({
  totalChapters,
  myChapter,
  heat,
  readers,
}: {
  totalChapters: number
  myChapter: number
  /** nº de mensajes por capítulo, indexado por número de capítulo */
  heat: Map<number, number>
  readers: MapReader[]
}) {
  const gradId = useId()
  if (totalChapters < 1) return null

  const explorado = Math.max(0, Math.min(myChapter, totalChapters))
  const pctExplorado = (explorado / totalChapters) * 100
  const maxHeat = Math.max(1, ...[...heat.values()])

  // Solo las conversaciones dentro de tu territorio explorado
  const tramos = Array.from({ length: totalChapters }, (_, i) => {
    const n = i + 1
    const dentro = n <= explorado
    return {
      n,
      dentro,
      calor: dentro ? (heat.get(n) ?? 0) / maxHeat : 0,
      mensajes: dentro ? (heat.get(n) ?? 0) : 0,
    }
  })

  const masCaliente = tramos
    .filter((t) => t.dentro && t.mensajes > 0)
    .sort((a, b) => b.mensajes - a.mensajes)[0]

  // Agrupar lectores que están en el mismo capítulo para que no se pisen
  const porCapitulo = new Map<number, MapReader[]>()
  for (const r of readers) {
    const c = Math.max(0, Math.min(r.chapter, totalChapters))
    const arr = porCapitulo.get(c) ?? []
    arr.push(r)
    porCapitulo.set(c, arr)
  }

  return (
    <div className="bookmap">
      <div className="bookmap__head">
        <h2 className="title-small">El mapa del libro</h2>
        <span className="body-small on-surface-variant">
          {explorado} de {totalChapters} capítulos
        </span>
      </div>

      {/* ---- La barra: territorio explorado con su calor, y niebla ---- */}
      <div className="bookmap__band" role="img"
        aria-label={`Mapa del libro. Vas por el capítulo ${explorado} de ${totalChapters}.`}>
        <svg viewBox={`0 0 ${totalChapters} 10`} preserveAspectRatio="none" className="bookmap__svg">
          <defs>
            {/* El territorio recorrido: salvia, un material callado. Antes
                era el mismo verde que las barras de conversación y no había
                forma de distinguir «por aquí he pasado» de «aquí se ha
                hablado mucho»: los dos eran verde oscuro. */}
            <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--tz-editorial-sage)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--tz-editorial-sage)" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          {/* Niebla: todo el libro apagado por debajo */}
          <rect x="0" y="0" width={totalChapters} height="10" className="bookmap__fog" />

          {/* Territorio explorado */}
          {explorado > 0 && (
            <rect x="0" y="0" width={explorado} height="10" fill={`url(#${gradId})`} />
          )}

          {/* Calor por capítulo, solo en lo explorado */}
          {tramos.map((t) =>
            t.calor > 0 ? (
              <rect
                key={t.n}
                x={t.n - 1}
                y={0}
                width={1}
                height={10}
                className="bookmap__heat"
                style={{ opacity: 0.25 + t.calor * 0.75 }}
              />
            ) : null,
          )}

          {/* Frontera: hasta aquí has llegado */}
          {explorado > 0 && explorado < totalChapters && (
            <rect x={explorado - 0.15} y="0" width="0.3" height="10" className="bookmap__edge" />
          )}
        </svg>

        {/* ---- Quién está dónde ---- */}
        <div className="bookmap__readers">
          {[...porCapitulo.entries()].map(([cap, gente]) => (
            <div
              key={cap}
              className={`bookmap__pin${gente.some((g) => g.isMe) ? ' me' : ''}`}
              style={{ left: `${(cap / totalChapters) * 100}%` }}
              title={`${gente.map((g) => g.name).join(', ')} · capítulo ${cap}`}
            >
              <Avatar name={gente[0].name} url={gente[0].avatar} size={26} />
              {gente.length > 1 && (
                <span className="label-small bookmap__mas">+{gente.length - 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bookmap__pie">
        <span className="bookmap__leyenda">
          {/* Cada muestra va dentro de su etiqueta: al estrechar, la pareja
              muestra+palabra baja junta en vez de partirse por la mitad */}
          <span className="bookmap__item">
            <span className="bookmap__muestra bookmap__muestra--leido" aria-hidden="true" />
            Lo que llevas
          </span>
          <span className="bookmap__item">
            <span className="bookmap__muestra bookmap__muestra--hablado" aria-hidden="true" />
            Donde se ha hablado
          </span>
          <span className="bookmap__item">
            <span className="bookmap__muestra bookmap__muestra--niebla" aria-hidden="true" />
            Lo que te queda
          </span>
        </span>
        <span className="body-small on-surface-variant">
          {pctExplorado >= 100
            ? 'Has recorrido el libro entero.'
            : masCaliente
              ? `Donde más se ha hablado: capítulo ${masCaliente.n}.`
              : 'Todavía no hay conversación en lo que llevas.'}
        </span>
      </div>

      <p className="visually-hidden">
        {readers
          .map((r) => `${r.name} va por el capítulo ${r.chapter}`)
          .join('. ')}
      </p>
    </div>
  )
}
