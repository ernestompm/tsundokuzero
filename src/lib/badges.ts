/**
 * Insignias del club (migr. 030).
 *
 * CRITERIO. Las que más pesan son de LEER: terminar libros con el club,
 * llegar el primero, llevar el timón. Después van las de vida en el club
 * (responder, reaccionar, votar), que también cuentan porque un club sin
 * conversación no es un club. Ninguna se gana solo por abrir la app.
 *
 * El orden importa: `badgesDe` las devuelve de más significativa a menos,
 * y las vistas compactas enseñan solo las primeras.
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
  /** uso de la app (migr. 032) */
  respuestas: number
  reacciones: number
  votaciones: number
  libros_en_estanteria: number
  perfil_completo: boolean
  en_la_app_desde: string
  /** capítulos leídos en total, sumando todos los libros (migr. 040) */
  capitulos_leidos: number
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

  // ---- El camino: capítulos leídos ----
  // Terminar un libro es raro; leer quince capítulos pasa la primera
  // semana. Sin estas, nadie gana nada en su primer mes y las insignias
  // no le dicen nada a quien acaba de llegar, que es justo a quien más
  // falta le hace que le digan algo.
  const c = s.capitulos_leidos ?? 0
  if (c >= 1000)
    out.push({
      id: 'capitulos-1000',
      icon: 'auto_stories',
      nombre: 'Ratón de biblioteca',
      detalle: 'Mil capítulos leídos',
      tono: 'oro',
    })
  else if (c >= 500)
    out.push({
      id: 'capitulos-500',
      icon: 'auto_stories',
      nombre: 'Lector de fondo',
      detalle: 'Quinientos capítulos leídos',
      tono: 'oro',
    })
  else if (c >= 200)
    out.push({
      id: 'capitulos-200',
      icon: 'auto_stories',
      nombre: 'Lector veterano',
      detalle: 'Doscientos capítulos leídos',
      tono: 'salvia',
    })
  else if (c >= 50)
    out.push({
      id: 'capitulos-50',
      icon: 'auto_stories',
      nombre: 'Lector constante',
      detalle: 'Cincuenta capítulos leídos',
      tono: 'salvia',
    })
  else if (c >= 15)
    out.push({
      id: 'capitulos-15',
      icon: 'auto_stories',
      nombre: 'Lector novato',
      detalle: 'Quince capítulos leídos',
      tono: 'tierra',
    })

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
  if (s.ideas >= 1 && s.ideas < 25)
    out.push({
      id: 'voz-1',
      icon: 'forum',
      nombre: 'Rompió el hielo',
      detalle: 'Compartió su primer pensamiento',
      tono: 'tierra',
    })
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

  // ---- Vida en el club: usar la app también cuenta (migr. 032) ----
  if (s.respuestas >= 50)
    out.push({
      id: 'conversador',
      icon: 'chat_bubble',
      nombre: 'Nunca deja a nadie solo',
      detalle: 'Ha respondido cincuenta veces a otros',
      tono: 'salvia',
    })
  else if (s.respuestas >= 10)
    out.push({
      id: 'buen-companero',
      icon: 'chat_bubble',
      nombre: 'Buena compañía',
      detalle: 'Ha respondido diez veces a otros',
      tono: 'tierra',
    })

  if (s.reacciones >= 50)
    out.push({
      id: 'entusiasta',
      icon: 'local_fire_department',
      nombre: 'Entusiasta',
      detalle: 'Ha reaccionado cincuenta veces',
      tono: 'tierra',
    })

  if (s.votaciones >= 5)
    out.push({
      id: 'votante',
      icon: 'how_to_vote',
      nombre: 'Siempre vota',
      detalle: 'Ha participado en cinco votaciones',
      tono: 'tierra',
    })

  if (s.libros_en_estanteria >= 15)
    out.push({
      id: 'tsundoku',
      icon: 'bookmark',
      nombre: 'Tsundoku de verdad',
      detalle: 'Quince libros en la estantería, leídos o por leer',
      tono: 'tierra',
    })
  else if (s.libros_en_estanteria >= 5)
    out.push({
      id: 'estanteria-5',
      icon: 'bookmark',
      nombre: 'La estantería crece',
      detalle: 'Cinco libros en la estantería',
      tono: 'tierra',
    })
  else if (s.libros_en_estanteria >= 1)
    out.push({
      id: 'estanteria-1',
      icon: 'bookmark',
      nombre: 'Empezando tu biblioteca',
      detalle: 'Primer libro en tu estantería',
      tono: 'tierra',
    })

  if (s.perfil_completo)
    out.push({
      id: 'perfil',
      icon: 'account_circle',
      nombre: 'Da la cara',
      detalle: 'Tiene foto y ha contado quién es',
      tono: 'tierra',
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
  const c = s.capitulos_leidos ?? 0
  // A quien acaba de llegar se le habla de capítulos, que es lo que puede
  // conseguir esta semana; lo de terminar libros llega después.
  if (c < 15)
    return { nombre: 'Lector novato', falta: `Te faltan ${15 - c} capítulos` }
  if (t < 1) return { nombre: 'Primer libro', falta: 'Termina un libro con el club' }
  if (t < 5) return { nombre: 'Cinco libros', falta: `Te faltan ${5 - t} para las cinco lecturas` }
  if (t < 10) return { nombre: 'Diez libros', falta: `Te faltan ${10 - t} para los diez` }
  if (t < 25) return { nombre: 'Biblioteca entera', falta: `Te faltan ${25 - t} para los veinticinco` }
  return null
}
