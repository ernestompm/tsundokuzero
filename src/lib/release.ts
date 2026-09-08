/**
 * Novedades de la versión, para el aviso que se abre al entrar.
 *
 * Escrito para lectores, no para programadores: cada punto cuenta qué
 * cambia en el club, no qué se ha tocado por dentro.
 *
 * Cuando salga una versión nueva: sube `RELEASE_KEY`, cambia `titulo` y
 * `entrada`, y reescribe `NOVEDADES`. Quien ya vio la anterior volverá a
 * ver el aviso una sola vez.
 */

/** Cambia esto en cada versión con novedades que merezca contar. */
export const RELEASE_KEY = '0.11.0'

export const RELEASE_TITULO = 'El club, mejor'

export const RELEASE_ENTRADA =
  'Hemos pasado el día metiendo mano a Tsundoku. Esto es lo que cambia para vosotros.'

export interface Novedad {
  /** icono del subset (scripts/icons.txt) */
  icon: string
  titulo: string
  texto: string
}

export const NOVEDADES: Novedad[] = [
  {
    icon: 'lock_open',
    titulo: 'El estreno',
    texto:
      'Las reseñas del club ya no se abren una a una. Se abren todas a la vez, cuando termina la última persona. Nadie escribe condicionado por lo que dijo otro, y terminar un libro pasa a ser una fecha de todos.',
  },
  {
    icon: 'travel_explore',
    titulo: 'El mapa del libro',
    texto:
      'En la ficha de cada libro ves a todo el club repartido por él y por dónde ha ardido la conversación. Lo que aún no has leído sale en niebla y se ilumina según avanzas, así que nadie te destripa nada.',
  },
  {
    icon: 'add',
    titulo: 'Añadir un libro cuesta dos toques',
    texto:
      'Buscas por título, autor o ISBN y ya está en tu biblioteca. Cualquiera puede añadir el libro que está leyendo, no hace falta pedirlo. Y la biblioteca por fin deja mover libros de estante y quitarlos.',
  },
  {
    icon: 'how_to_vote',
    titulo: 'Votar sin salir de la app',
    texto:
      'El capitán pega los ISBN o los títulos, uno por línea, y la votación se abre sola con sus portadas, su fecha de cierre y el motivo por el que propone cada libro. Se acabó decidirlo por otro sitio.',
  },
  {
    icon: 'star',
    titulo: 'Decir por qué te gustó',
    texto:
      'Además de las estrellas puedes marcar cuánto te hizo pensar, cuánto se lee solo, cuánto te removió y si lo recomendarías. Cada libro tiene ahora su página de opiniones, y ahí ves tu marca sobre la media del club.',
  },
  {
    icon: 'group',
    titulo: 'La capitanía se reparte sola',
    texto:
      'A mano, al azar o por turno, y el mandato dura lo que digáis: un tiempo fijo o un libro. El club también guarda ya todo lo que habéis leído, incluido el bis, esa lectura extra de cuando os lo ventiláis antes de tiempo.',
  },
  {
    icon: 'check_circle',
    titulo: 'Y arreglado',
    texto:
      'Guardar una reseña daba un error de permisos que no era culpa tuya. Ya funciona, y ahora hay un botón para dar un libro por terminado sin arrastrar la barra hasta el final.',
  },
]
