/**
 * Identidad visual de Tsundoku Zero.
 *
 * LA PALETA Y SU JERARQUÍA
 * ------------------------
 * Seis colores de marca, y lo importante no son los colores sino el peso
 * que tiene cada uno. Repartirlos por igual sería justo lo contrario de
 * lo que queremos:
 *
 *   Scarab           #2C3D37   estructura   tipografía, navegación, botones
 *   Angel Feather    #F4EFEE   respira      el fondo de todo, con aire
 *   Picholine        #566955   organiza     texto secundario, filtros, iconos
 *   Orange Vermillion #BC5339  señala       activo, selección, progreso
 *   Glad Yellow      #F5E1AC   carácter     fichas, citas, bloques editoriales
 *   Bud              #A5A88F   carácter     filetes, bordes, superficies suaves
 *
 * La estructura de la app es crema + verde oscuro. Los demás colores
 * aparecen DENTRO del contenido, no repartidos por la interfaz.
 *
 * El Vermillion vive fuera de los tokens de Material a propósito (está en
 * `index.css` como `--tz-signal`): si fuera `primary` acabaría en todos
 * los botones y perdería justo lo que le da fuerza, que es aparecer poco.
 *
 * LA CAPA DE PAPEL
 * ----------------
 * Además del crema de fondo hay un blanco roto casi puro
 * (`surface-container-lowest`, alias `--tz-paper`) que se usa en tarjetas
 * y capas. No es color de marca: es el que genera profundidad y evita que
 * toda la pantalla sea el mismo beige.
 *
 * Todo esto se mapea sobre los tokens de Material Design 3
 * (`--md-sys-color-*`), así que los componentes de @material/web siguen
 * funcionando pero con la voz de la marca, en claro y en oscuro.
 */

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tz-theme-mode'

type Palette = Record<string, string>

const LIGHT: Palette = {
  /* --- Scarab: estructura. Botones importantes y tipografía principal --- */
  primary: '#2C3D37',
  'on-primary': '#F4EFEE',
  'primary-container': '#D2DACE',
  'on-primary-container': '#16241F',

  /* --- Picholine: organiza. Segundo nivel de jerarquía --- */
  secondary: '#566955',
  'on-secondary': '#F4EFEE',
  'secondary-container': '#DCE2D6',
  'on-secondary-container': '#25302A',

  /* --- Glad Yellow: carácter editorial. El contenedor ES el amarillo;
         el tono sólido es su versión oscura, para iconos y estrellas --- */
  tertiary: '#7E6220',
  'on-tertiary': '#FBF6EA',
  'tertiary-container': '#F5E1AC',
  'on-tertiary-container': '#3D2F06',

  /* --- Error: rojo profundo, deliberadamente MÁS oscuro y menos naranja
         que el Vermillion, para que «algo va mal» y «mira aquí» no se
         confundan nunca --- */
  error: '#8E2A24',
  'on-error': '#FBF1EE',
  'error-container': '#F6DCD3',
  'on-error-container': '#40100C',

  /* --- Angel Feather: respira --- */
  background: '#F4EFEE',
  'on-background': '#2C3D37',
  surface: '#F4EFEE',
  'on-surface': '#2C3D37',
  'surface-variant': '#E4DCDB',
  'on-surface-variant': '#566955',

  /* --- Bud: filetes y bordes. El `outline` va oscurecido para que
         aguante como límite de control (3:1); el `variant` es el filete
         decorativo, que sí puede ser tenue --- */
  outline: '#7E836E',
  'outline-variant': '#C9CBBB',

  /* --- La escala de superficies. `lowest` es el papel: MÁS claro que el
         fondo, para que las tarjetas se levanten en vez de hundirse --- */
  'surface-container-lowest': '#FFFCFB',
  'surface-container-low': '#F9F5F4',
  'surface-container': '#EFE8E7',
  'surface-container-high': '#E9E1E0',
  'surface-container-highest': '#E2D9D8',
  'surface-dim': '#E2DAD9',
  'surface-bright': '#FBF8F7',

  'inverse-surface': '#2C3D37',
  'inverse-on-surface': '#F0EAE9',
  'inverse-primary': '#B6C3B2',
  'surface-tint': '#2C3D37',

  /* Negro verdoso, no negro puro: las sombras y los velos quedan cálidos */
  shadow: '#16201C',
  scrim: '#16201C',
}

const DARK: Palette = {
  /* En oscuro se invierten los papeles: Scarab deja de ser la tinta y se
     convierte en el material del que está hecho todo; la tinta la pone
     Angel Feather, algo atenuado para no deslumbrar.

     La versión anterior era una inversión mecánica y se notaba: los
     contenedores quedaban a un paso de distancia del fondo y todo se
     fundía en una papilla caqui. Aquí la escala abre más los peldaños y
     el papel de las tarjetas va POR ENCIMA del fondo, no por debajo. */

  /* Botones y acentos: el verde levantado hasta poder llevar texto oscuro */
  primary: '#CBD6C2',
  'on-primary': '#1C2822',
  'primary-container': '#3C4E44',
  'on-primary-container': '#D9E5D0',

  /* Picholine sigue organizando, un peldaño por debajo del principal */
  secondary: '#A9B3A2',
  'on-secondary': '#212C26',
  'secondary-container': '#37453C',
  'on-secondary-container': '#C9D6C2',

  /* El oro aguanta casi tal cual sobre verde profundo: es de los pocos
     colores que en oscuro gana en vez de perder */
  tertiary: '#E7CE93',
  'on-tertiary': '#3A2D07',
  'tertiary-container': '#57451A',
  'on-tertiary-container': '#F6E3B4',

  error: '#EFAFA4',
  'on-error': '#5A120C',
  'error-container': '#7A231B',
  'on-error-container': '#F9DCD6',

  background: '#151C19',
  'on-background': '#E9E3DF',
  surface: '#151C19',
  'on-surface': '#E9E3DF',
  'surface-variant': '#3A4741',
  'on-surface-variant': '#ADB8A9',

  outline: '#8A9487',
  'outline-variant': '#3B4841',

  /* Peldaños amplios: entre uno y otro tiene que haber diferencia visible,
     o las tarjetas dejan de leerse como objetos */
  'surface-container-lowest': '#0F1512',
  'surface-container-low': '#1A221E',
  'surface-container': '#1E2723',
  'surface-container-high': '#27332D',
  'surface-container-highest': '#303E37',
  'surface-dim': '#101614',
  'surface-bright': '#32403A',

  'inverse-surface': '#E9E3DF',
  'inverse-on-surface': '#2C3D37',
  'inverse-primary': '#2C3D37',
  'surface-tint': '#CBD6C2',

  shadow: '#000000',
  scrim: '#080C0A',
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Por defecto, CLARO. No el del sistema.
 *
 * La identidad de Tsundoku es papel: crema, tinta verde oscura y mucho
 * aire. Quien abría la app desde un móvil en modo oscuro se encontraba de
 * entrada con una versión de la marca que no es la marca, sin haber
 * elegido nada. El oscuro sigue ahí, pero ahora se elige a mano desde el
 * menú, que es lo que significa una preferencia.
 */
export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'light'
}

export function isDarkActive(): boolean {
  const mode = getThemeMode()
  return mode === 'dark' || (mode === 'system' && systemPrefersDark())
}

function apply(dark: boolean) {
  const palette = dark ? DARK : LIGHT
  const style = document.documentElement.style
  for (const [token, value] of Object.entries(palette)) {
    style.setProperty(`--md-sys-color-${token}`, value)
  }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', palette.surface)
}

export function setThemeMode(mode: ThemeMode) {
  // 'system' se guarda explícitamente: ausencia de clave ya significa
  // «claro», así que borrarla no serviría para seguir al sistema.
  localStorage.setItem(STORAGE_KEY, mode)
  apply(isDarkActive())
}

/** Inicializa el tema y escucha cambios del sistema. Llamar una vez al arrancar. */
export function initTheme() {
  apply(isDarkActive())
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getThemeMode() === 'system') apply(isDarkActive())
    })
}
