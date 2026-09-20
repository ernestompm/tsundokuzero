import type { Badge, MemberStats, Rachas } from './badges'

/**
 * El catálogo con progreso.
 *
 * `badgesDe` dice lo que YA tienes. Eso vale para una ficha, pero no hace
 * que nadie quiera nada: para querer una insignia hay que verla, saber
 * cuánto te falta, y ver que otros la tienen.
 *
 * Aquí está cada insignia con su meta y por dónde vas, para poder pintar
 * la barra. Una vitrina es tanto de lo que hay como de lo que falta.
 */

export interface BadgeMeta extends Badge {
  /** familia: de cada una solo cuenta el escalón más alto alcanzado */
  familia: string
  /** cuánto hace falta */
  meta: number
  /** cuánto llevas */
  llevas: number
  /** qué se cuenta: «libros», «capítulos leídos», «días seguidos»… */
  unidad: string
  conseguida: boolean
}

/** 0–100, con tope. */
export function pctBadge(b: BadgeMeta): number {
  if (b.meta <= 0) return b.conseguida ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((b.llevas / b.meta) * 100)))
}

/** Lo que falta, dicho en corto: «Te faltan 3 libros». */
export function faltaPara(b: BadgeMeta): string {
  const falta = Math.max(0, b.meta - b.llevas)
  if (falta === 0) return 'Conseguida'
  return `${b.llevas} de ${b.meta} · ${b.unidad}`
}

interface Escalon {
  id: string
  icon: string
  nombre: string
  detalle: string
  tono: Badge['tono']
  meta: number
}

interface Familia {
  familia: string
  unidad: string
  llevas: (s: MemberStats, r?: Rachas | null) => number
  escalones: Escalon[]
}

const F: Familia[] = [
  {
    familia: 'racha-lectura',
    unidad: 'días seguidos leyendo',
    llevas: (_s, r) => r?.dias_leyendo ?? 0,
    escalones: [
      { id: 'racha-3', icon: 'local_fire_department', nombre: 'Tres días seguidos', detalle: 'La racha ha empezado', tono: 'tierra', meta: 3 },
      { id: 'racha-7', icon: 'local_fire_department', nombre: 'Una semana entera', detalle: 'Siete días seguidos leyendo', tono: 'salvia', meta: 7 },
      { id: 'racha-30', icon: 'local_fire_department', nombre: 'Un mes sin fallar', detalle: 'Treinta días seguidos leyendo', tono: 'oro', meta: 30 },
      { id: 'racha-100', icon: 'local_fire_department', nombre: 'Cien días', detalle: 'Cien días seguidos moviendo tu capítulo', tono: 'oro', meta: 100 },
    ],
  },
  {
    familia: 'racha-palabra',
    unidad: 'días seguidos comentando',
    llevas: (_s, r) => r?.dias_hablando ?? 0,
    escalones: [
      { id: 'voz-racha-3', icon: 'forum', nombre: 'No se calla', detalle: 'Tres días seguidos comentando', tono: 'tierra', meta: 3 },
      { id: 'voz-racha-7', icon: 'forum', nombre: 'Siempre en la sala', detalle: 'Siete días seguidos comentando', tono: 'salvia', meta: 7 },
      { id: 'voz-racha-30', icon: 'forum', nombre: 'El alma del club', detalle: 'Treinta días seguidos diciendo algo', tono: 'oro', meta: 30 },
    ],
  },
  {
    familia: 'capitulos',
    unidad: 'capítulos leídos',
    llevas: (s) => s.capitulos_leidos ?? 0,
    escalones: [
      { id: 'capitulos-15', icon: 'auto_stories', nombre: 'Lector novato', detalle: 'Quince capítulos leídos', tono: 'tierra', meta: 15 },
      { id: 'capitulos-50', icon: 'auto_stories', nombre: 'Lector constante', detalle: 'Cincuenta capítulos leídos', tono: 'salvia', meta: 50 },
      { id: 'capitulos-200', icon: 'auto_stories', nombre: 'Lector veterano', detalle: 'Doscientos capítulos leídos', tono: 'salvia', meta: 200 },
      { id: 'capitulos-500', icon: 'auto_stories', nombre: 'Lector de fondo', detalle: 'Quinientos capítulos leídos', tono: 'oro', meta: 500 },
      { id: 'capitulos-1000', icon: 'auto_stories', nombre: 'Ratón de biblioteca', detalle: 'Mil capítulos leídos', tono: 'oro', meta: 1000 },
    ],
  },
  {
    familia: 'libros',
    unidad: 'libros terminados con el club',
    llevas: (s) => s.libros_terminados,
    escalones: [
      { id: 'lector-1', icon: 'menu_book', nombre: 'Primer libro', detalle: 'Terminó su primer libro con el club', tono: 'tierra', meta: 1 },
      { id: 'lector-5', icon: 'menu_book', nombre: 'Cinco libros', detalle: 'Cinco libros terminados con el club', tono: 'salvia', meta: 5 },
      { id: 'lector-10', icon: 'menu_book', nombre: 'Diez libros', detalle: 'Diez libros terminados con el club', tono: 'oro', meta: 10 },
      { id: 'lector-25', icon: 'menu_book', nombre: 'Biblioteca entera', detalle: 'Veinticinco libros terminados con el club', tono: 'oro', meta: 25 },
    ],
  },
  {
    familia: 'primero',
    unidad: 'veces el primero en terminar',
    llevas: (s) => s.veces_primero,
    escalones: [
      { id: 'liebre-1', icon: 'local_fire_department', nombre: 'Abrió camino', detalle: 'Fue el primero en terminar un libro', tono: 'tierra', meta: 1 },
      { id: 'liebre-3', icon: 'local_fire_department', nombre: 'Va por delante', detalle: 'Primero en terminar tres veces', tono: 'salvia', meta: 3 },
      { id: 'liebre-5', icon: 'local_fire_department', nombre: 'Imparable', detalle: 'Primero en terminar cinco veces', tono: 'oro', meta: 5 },
    ],
  },
  {
    familia: 'capitania',
    unidad: 'lecturas propuestas',
    llevas: (s) => s.libros_propuestos,
    escalones: [
      { id: 'capitan-1', icon: 'how_to_vote', nombre: 'Ha llevado el timón', detalle: 'Ha sido capitán y ha elegido lectura', tono: 'salvia', meta: 1 },
      { id: 'capitan-5', icon: 'how_to_vote', nombre: 'Buen ojo', detalle: 'Ha propuesto cinco lecturas al club', tono: 'oro', meta: 5 },
    ],
  },
  {
    familia: 'ideas',
    unidad: 'pensamientos compartidos',
    llevas: (s) => s.ideas,
    escalones: [
      { id: 'voz-1', icon: 'forum', nombre: 'Rompió el hielo', detalle: 'Compartió su primer pensamiento', tono: 'tierra', meta: 1 },
      { id: 'voz-25', icon: 'forum', nombre: 'Siempre tiene algo que decir', detalle: 'Más de veinticinco ideas compartidas', tono: 'salvia', meta: 25 },
      { id: 'voz-100', icon: 'forum', nombre: 'La voz del club', detalle: 'Más de cien ideas compartidas', tono: 'oro', meta: 100 },
    ],
  },
  {
    familia: 'respuestas',
    unidad: 'respuestas a otros',
    llevas: (s) => s.respuestas,
    escalones: [
      { id: 'buen-companero', icon: 'chat_bubble', nombre: 'Buena compañía', detalle: 'Ha respondido diez veces a otros', tono: 'tierra', meta: 10 },
      { id: 'conversador', icon: 'chat_bubble', nombre: 'Nunca deja a nadie solo', detalle: 'Ha respondido cincuenta veces a otros', tono: 'salvia', meta: 50 },
    ],
  },
  {
    familia: 'resenas',
    unidad: 'reseñas escritas',
    llevas: (s) => s.resenas,
    escalones: [
      { id: 'critico', icon: 'star', nombre: 'Crítico del club', detalle: 'Ha escrito diez reseñas', tono: 'salvia', meta: 10 },
    ],
  },
  {
    familia: 'estanteria',
    unidad: 'libros en la estantería',
    llevas: (s) => s.libros_en_estanteria,
    escalones: [
      { id: 'estanteria-1', icon: 'bookmark', nombre: 'Empezando tu biblioteca', detalle: 'Primer libro en tu estantería', tono: 'tierra', meta: 1 },
      { id: 'estanteria-5', icon: 'bookmark', nombre: 'La estantería crece', detalle: 'Cinco libros en la estantería', tono: 'tierra', meta: 5 },
      { id: 'tsundoku', icon: 'bookmark', nombre: 'Tsundoku de verdad', detalle: 'Quince libros en la estantería, leídos o por leer', tono: 'tierra', meta: 15 },
    ],
  },
  {
    familia: 'reacciones',
    unidad: 'reacciones',
    llevas: (s) => s.reacciones,
    escalones: [
      { id: 'entusiasta', icon: 'local_fire_department', nombre: 'Entusiasta', detalle: 'Ha reaccionado cincuenta veces', tono: 'tierra', meta: 50 },
    ],
  },
  {
    familia: 'votaciones',
    unidad: 'votaciones',
    llevas: (s) => s.votaciones,
    escalones: [
      { id: 'votante', icon: 'how_to_vote', nombre: 'Siempre vota', detalle: 'Ha participado en cinco votaciones', tono: 'tierra', meta: 5 },
    ],
  },
]

/**
 * Cada insignia con su barra: lo conseguido y lo que falta.
 *
 * De cada familia se enseña la conseguida más alta MÁS la siguiente, que
 * es la que está en juego. Sacar los cinco escalones de todo a la vez
 * convierte la vitrina en una lista, y una lista no motiva a nadie.
 */
export function catalogoConProgreso(
  s: MemberStats,
  r?: Rachas | null,
): BadgeMeta[] {
  const out: BadgeMeta[] = []

  for (const f of F) {
    const llevas = f.llevas(s, r)
    const alcanzados = f.escalones.filter((e) => llevas >= e.meta)
    const siguiente = f.escalones.find((e) => llevas < e.meta)
    const mostrar: Escalon[] = []
    if (alcanzados.length > 0) mostrar.push(alcanzados[alcanzados.length - 1])
    if (siguiente) mostrar.push(siguiente)

    for (const e of mostrar) {
      out.push({
        id: e.id,
        icon: e.icon,
        nombre: e.nombre,
        detalle: e.detalle,
        tono: e.tono,
        familia: f.familia,
        meta: e.meta,
        llevas,
        unidad: f.unidad,
        conseguida: llevas >= e.meta,
      })
    }
  }

  // Lo que está más cerca de caer, primero: es donde hay que mirar.
  return out.sort((a, b) => {
    if (a.conseguida !== b.conseguida) return a.conseguida ? 1 : -1
    if (a.conseguida) return 0
    return pctBadge(b) - pctBadge(a)
  })
}
