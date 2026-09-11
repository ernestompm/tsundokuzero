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
export const RELEASE_KEY = '0.14.0'

export const RELEASE_TITULO = 'Responder sin esperar un mes'

export const RELEASE_ENTRADA =
  'El candado anti-spoiler sigue siendo sagrado. Pero se llevaba por delante una cosa importante: las respuestas. Esto es lo que cambia.'

export interface Novedad {
  /** icono del subset (scripts/icons.txt) */
  icon: string
  titulo: string
  texto: string
}

export const NOVEDADES: Novedad[] = [
  {
    icon: 'lock_open',
    titulo: 'El juramento',
    texto:
      'Si respondes a alguien que va por detrás de ti, te preguntamos si juras que tu respuesta no destripa nada. Si lo juras, esa persona puede abrirla cuando quiera en vez de esperar semanas. Y si no la quiere abrir, no la abre: se le dice quién respondió y desde dónde, nunca qué.',
  },
  {
    icon: 'flag',
    titulo: 'Un juramento que se puede romper',
    texto:
      'Antes de abrir una respuesta jurada ves el historial de quien la escribió: cuántas veces ha jurado y cuántas se le ha denunciado por spoiler. Si alguien te la cuela, lo marcas de un toque. Un juramento que no se puede romper no valdría nada.',
  },
  {
    icon: 'edit',
    titulo: 'Escribir como se escribe',
    texto:
      'Los saltos de línea se respetan: puedes separar ideas en párrafos y se ven así. Intro ya no envía nada, hace párrafo. Y los pensamientos tienen un tope de 1500 caracteres, que da para mucho sin convertir el hilo en un ensayo.',
  },
  {
    icon: 'check_circle',
    titulo: '«Ya lo tengo»',
    texto:
      'Cuando hay próxima lectura, dile al club que ya tienes el libro. Se ven las caras de quién lo tiene y quién falta, y el capitán recibe un aviso cuando lo tenéis todos. Se acabó preguntarlo por WhatsApp uno a uno.',
  },
  {
    icon: 'how_to_vote',
    titulo: 'Capitanía, otra vez',
    texto:
      'La pantalla del capitán ya no es un panel de botones. Ahora dice en una frase en qué momento está el club y qué toca hacer ahora. Lo demás baja a una lista de líneas que informan sin pedir nada.',
  },
  {
    icon: 'group',
    titulo: 'Clubes nuevos, con permiso',
    texto:
      'Se pueden fundar clubes nuevos, pero no los funda cualquiera: hace falta permiso. Cada club tiene su código de seis letras, que sirve a la vez para registrarse y para entrar. Uno solo, y se acabó.',
  },
]
