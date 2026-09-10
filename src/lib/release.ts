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
export const RELEASE_KEY = '0.13.0'

export const RELEASE_TITULO = 'Ahora sí sois un club'

export const RELEASE_ENTRADA =
  'Nos habéis dicho lo que faltaba y hemos ido a por ello. Esto es lo que cambia para vosotros.'

export interface Novedad {
  /** icono del subset (scripts/icons.txt) */
  icon: string
  titulo: string
  texto: string
}

export const NOVEDADES: Novedad[] = [
  {
    icon: 'shopping_bag',
    titulo: 'Próxima lectura',
    texto:
      'Cuando el club elige el siguiente libro, ya no aparece de golpe el día que se empieza. Sale antes en tu Inicio, con su portada y un enlace para conseguirlo, así que te da tiempo a hacerte con él.',
  },
  {
    icon: 'chat_bubble',
    titulo: 'Menciones que esperan',
    texto:
      'Escribe @ y el nombre de alguien del club para nombrarle. Si va por detrás de ti, le avisamos de que le has mencionado en el capítulo X, pero no de qué dijiste: el mensaje se le abre solo cuando llegue. Saber que alguien pensó en ti unas páginas más adelante es la mejor razón para seguir leyendo esta noche.',
  },
  {
    icon: 'send',
    titulo: 'Recomendarle un libro a alguien',
    texto:
      'Desde la ficha de cualquier libro puedes recomendárselo a una persona del club, con un mensaje tuyo. Y en su perfil ves lo que ha leído, lo que recomienda y en qué os parecéis leyendo.',
  },
  {
    icon: 'notifications',
    titulo: 'Lo nuevo',
    texto:
      'Tu club te dice qué te has perdido desde la última vez: quién te ha respondido, quién ha reaccionado a tus ideas y quién te ha adelantado leyendo. Tocas, lo ves, y deja de aparecer.',
  },
  {
    icon: 'group',
    titulo: 'Tu club, en la primera pantalla',
    texto:
      'Nada más entrar ves el nombre del club, las caras de la gente, cuántos libros lleváis juntos y desde cuándo estás tú. Porque leer aquí no es leer solo.',
  },
  {
    icon: 'star',
    titulo: 'Insignias',
    texto:
      'Se ganan leyendo, no usando la app: terminar libros con el club, ser el primero en llegar al final, llevar el timón como capitán o llevar tiempo aquí. Están en tu perfil y junto a tu nombre en el club.',
  },
  {
    icon: 'account_circle',
    titulo: 'Un perfil de verdad',
    texto:
      'Tu perfil ya no es una pantalla de ajustes. Ahora enseña quién eres: tus insignias, los libros que lees, los que has terminado, los que tienes pendientes y tu muro. Los ajustes siguen ahí, en su pestaña.',
  },
  {
    icon: 'lock_open',
    titulo: 'El estreno',
    texto:
      'Las reseñas del club se abren todas a la vez, cuando termina la última persona. Nadie escribe condicionado por lo que dijo otro.',
  },
  {
    icon: 'travel_explore',
    titulo: 'El mapa del libro',
    texto:
      'En la ficha de cada libro ves a todo el club repartido por él. Lo que aún no has leído sale en niebla y se ilumina según avanzas, así que nadie te destripa nada.',
  },
  {
    icon: 'add',
    titulo: 'Añadir y votar sin pelearse',
    texto:
      'Buscas un libro por título o ISBN y ya está en tu biblioteca. Y el capitán monta la votación buscando los candidatos, sin pasar por ningún catálogo.',
  },
]
