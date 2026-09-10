/**
 * Insignias del club (migr. 030).
 *
 * CRITERIO. Pocas, ganadas y sobre LEER, no sobre usar la app. Una
 * insignia que se consigue abriendo la aplicación no significa nada; una
 * que dice que terminaste cinco libros con la misma gente, sí.
 *
 * Se calculan a partir de la vista `club_member_stats`, que deriva todo
 * de los datos reales. No hay tabla de premios que se pueda quedar
 * desfasada: si cambian los datos, cambian las insignias.
 */

export interface MemberStats {
  club_id: string
  user_id: string
  joined_at: string
  role: string
  orden_llegada: number
  libros_terminados: number
  veces_primero: number
  libros_propuestos: number
  ideas: number
  resenas: number
}

export interface Badge {
  id: string
  /** icono del subset (scripts/icons.txt) */
  icon: string
  nombre: string
  /** qué significa, en una frase */
  detalle: string
  /** tono de la insignia */
  tono: 'oro' | 'salvia' | 'tierra'
}

/** Meses completos desde que se unió al club. */
export function mesesEnElClub(joinedAt: string): number {
  const d = new Date(joinedAt)
  const ahora = new Date()
  return Math.max(
    0,
    (ahora.getFullYear() - d.getFullYear()) * 12 + (ahora.getMonth() - d.getMonth()),
  )
}

export function antiguedadEnPalabras(joinedAt: string): string {
  const m = mesesEnElClub(joinedAt)
  if (m < 1) return 'desde este mes'
  if (m === 1) return 'desde hace un mes'
  if (m < 12) return `desde hace ${m} meses`
  const años = Math.floor(m / 12)
  return años === 1 ? 'desde hace un año' : `desde hace ${años} años`
}

/**
 * Las insignias que tiene esta persona ahora mismo, de más significativa
 * a menos. Cada familia da UNA sola insignia, la del nivel alcanzado, para
 * que la ficha no se llene de medallas repetidas.
 */
export function badgesDe(s: MemberStats): Badge[] {
  const out: Badge[] = []
  const meses = mesesEnElClub(s.joined_at)

  // ---- Antigüedad ----
  if (s.orden_llegada <= 3) {
    out.push({
      id: 'fundador',
      icon: 'auto_stories',
      nombre: 'Fundador',
      detalle: 'De los primeros que se sentaron a leer aquí',
      tono: 'oro',
    })
  } else if (meses >= 24) {
    out.push({
      id: 'veterano-2',
      icon: 'auto_stories',
      nombre: 'Veterano',
      detalle: 'Más de dos años en el club',
      tono: 'oro',
    })
  } else if (meses >= 12) {
    out.push({
      id: 'veterano-1',
      icon: 'auto_stories',
      nombre: 'Un año aquí',
      detalle: 'Doce meses leyendo con el club',
      tono: 'salvia',
    })
  } else if (meses >= 6) {
    out.push({
      id: 'medio-ano',
      icon: 'auto_stories',
      nombre: 'Medio año aquí',
      detalle: 'Seis meses leyendo con el club',
      tono: 'salvia',
    })
  }

  // ---- Libros terminados con el club ----
  const t = s.libros_terminados
  if (t >= 25)
    out.push({
      id: 'lector-25',
      icon: 'menu_book',
      nombre: 'Biblioteca entera',
      detalle: '25 libros terminados con el club',
      tono: 'oro',
    })
  else if (t >= 10)
    out.push({
      id: 'lector-10',
      icon: 'menu_book',
      nombre: 'Diez libros',
      detalle: '10 libros terminados con el club',
      tono: 'oro',
    })
  else if (t >= 5)
    out.push({
      id: 'lector-5',
      icon: 'menu_book',
      nombre: 'Cinco libros',
      detalle: '5 libros terminados con el club',
      tono: 'salvia',
    })
  else if (t >= 1)
    out.push({
      id: 'lector-1',
      icon: 'menu_book',
      nombre: 'Primer libro',
      detalle: 'Terminó su primer libro con el club',
      tono: 'tierra',
    })

  // ---- Rapidez: el primero en cruzar la meta ----
  if (s.veces_primero >= 5)
    out.push({
      id: 'liebre-5',
      icon: 'local_fire_department',
      nombre: 'Imparable',
      detalle: 'Primero en terminar cinco veces',
      tono: 'oro',
    })
  else if (s.veces_primero >= 3)
    out.push({
      id: 'liebre-3',
      icon: 'local_fire_department',
      nombre: 'Va por delante',
      detalle: 'Primero en terminar tres veces',
      tono: 'salvia',
    })
  else if (s.veces_primero >= 1)
    out.push({
      id: 'liebre-1',
      icon: 'local_fire_department',
      nombre: 'Abrió camino',
      detalle: 'Fue el primero en terminar un libro',
      tono: 'tierra',
    })

  // ---- Capitanía ----
  if (s.libros_propuestos >= 5)
    out.push({
      id: 'capitan-5',
      icon: 'how_to_vote',
      nombre: 'Buen ojo',
      detalle: 'Ha propuesto cinco lecturas al club',
      tono: 'oro',
    })
  else if (s.libros_propuestos >= 1)
    out.push({
      id: 'capitan-1',
      icon: 'how_to_vote',
      nombre: 'Ha llevado el timón',
      detalle: 'Ha sido capitán y ha elegido lectura',
      tono: 'salvia',
    })

  // ---- Conversación ----
  if (s.ideas >= 100)
    out.push({
      id: 'voz-100',
      icon: 'forum',
      nombre: 'La voz del club',
      detalle: 'Más de cien ideas compartidas',
      tono: 'oro',
    })
  else if (s.ideas >= 25)
    out.push({
      id: 'voz-25',
      icon: 'forum',
      nombre: 'Siempre tiene algo que decir',
      detalle: 'Más de veinticinco ideas compartidas',
      tono: 'salvia',
    })

  // ---- Reseñas ----
  if (s.resenas >= 10)
    out.push({
      id: 'critico',
      icon: 'star',
      nombre: 'Crítico del club',
      detalle: 'Ha escrito diez reseñas',
      tono: 'salvia',
    })

  return out
}

/**
 * La siguiente insignia que está a punto de conseguir, para que la ficha
 * diga qué falta en vez de solo qué hay. Devuelve null si no hay ninguna
 * cerca.
 */
export function siguienteBadge(s: MemberStats): { nombre: string; falta: string } | null {
  const t = s.libros_terminados
  if (t < 1) return { nombre: 'Primer libro', falta: 'Termina un libro con el club' }
  if (t < 5) return { nombre: 'Cinco libros', falta: `Te faltan ${5 - t} para las cinco lecturas` }
  if (t < 10) return { nombre: 'Diez libros', falta: `Te faltan ${10 - t} para los diez` }
  if (t < 25) return { nombre: 'Biblioteca entera', falta: `Te faltan ${25 - t} para los veinticinco` }
  return null
}
