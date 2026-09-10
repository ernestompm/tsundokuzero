/**
 * Afinidad lectora (migr. 034): convierte los números en una frase que
 * de verdad diga algo.
 *
 * Un porcentaje de compatibilidad no significa nada y todo el mundo lo
 * sabe. «A los dos os remueven los mismos libros, pero a él le cuestan
 * más» sí, y además es una conversación esperando a pasar.
 */

export interface Afinidad {
  finished_together: number
  both_rated: number
  my_avg: number | null
  their_avg: number | null
  dims: Partial<
    Record<'think' | 'flow' | 'feel' | 'recommend', { mine: number; theirs: number }>
  >
  shared_loves: { id: string; title: string }[]
  disagreement: { id: string; title: string; mine: number; theirs: number } | null
}

const DIM_TEXTO: Record<
  string,
  { igual: string; masTu: string; masEl: string }
> = {
  think: {
    igual: 'os hacen pensar lo mismo',
    masTu: 'a ti te hacen pensar más',
    masEl: 'a la otra persona le hacen pensar más',
  },
  flow: {
    igual: 'los leéis con la misma soltura',
    masTu: 'a ti se te van solos y a la otra persona le cuestan más',
    masEl: 'a la otra persona se le van solos y a ti te cuestan más',
  },
  feel: {
    igual: 'os remueven por igual',
    masTu: 'a ti te remueven más',
    masEl: 'a la otra persona le remueven más',
  },
  recommend: {
    igual: 'los recomendáis igual',
    masTu: 'tú los recomiendas más',
    masEl: 'la otra persona los recomienda más',
  },
}

/** La frase principal: en qué os parecéis o en qué no. */
export function frases(a: Afinidad, nombre: string): string[] {
  const out: string[] = []
  const suyo = nombre.split(/\s+/)[0]

  if (a.finished_together > 0) {
    out.push(
      a.finished_together === 1
        ? `Habéis terminado un libro los dos.`
        : `Habéis terminado ${a.finished_together} libros los dos.`,
    )
  }

  if (a.both_rated >= 2 && a.my_avg != null && a.their_avg != null) {
    const dif = a.my_avg - a.their_avg
    if (Math.abs(dif) < 0.25) {
      out.push(`Puntuáis casi igual, sobre ${a.my_avg.toFixed(1)} de media.`)
    } else if (dif > 0) {
      out.push(
        `Tú eres más generoso: le pones ${Math.abs(dif).toFixed(1)} estrellas más que ${suyo} de media.`,
      )
    } else {
      out.push(
        `${suyo} es más generoso: pone ${Math.abs(dif).toFixed(1)} estrellas más que tú de media.`,
      )
    }
  }

  // La dimensión donde más os separáis, que es la interesante
  let peor: { k: string; dif: number } | null = null
  for (const [k, v] of Object.entries(a.dims)) {
    if (!v) continue
    const dif = v.mine - v.theirs
    if (!peor || Math.abs(dif) > Math.abs(peor.dif)) peor = { k, dif }
  }
  if (peor && DIM_TEXTO[peor.k]) {
    const t = DIM_TEXTO[peor.k]
    out.push(
      Math.abs(peor.dif) < 0.4
        ? `En lo que más coincidís: ${t.igual}.`
        : `Donde más os separáis: ${peor.dif > 0 ? t.masTu : t.masEl}.`,
    )
  }

  return out
}

/** ¿Merece la pena enseñar la tarjeta? Con un solo dato, no. */
export function hayAfinidad(a: Afinidad | null): a is Afinidad {
  if (!a) return false
  return a.finished_together > 0 || a.both_rated > 0
}
