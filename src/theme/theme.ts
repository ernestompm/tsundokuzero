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
  /* En oscuro se invierte el papel de Scarab: deja de ser la tinta y pasa
     a ser la superficie. La tinta la pone Angel Feather. */
  primary: '#BCCBB6',
  'on-primary': '#1E2A25',
  'primary-container': '#3E5148',
  'on-primary-container': '#D6E2D1',

  secondary: '#A9B6A4',
  'on-secondary': '#22302A',
  'secondary-container': '#3A4A40',
  'on-secondary-container': '#D3DECE',

  tertiary: '#E6CE90',
  'on-tertiary': '#3B2E06',
  'tertiary-container': '#5C4A18',
  'on-tertiary-container': '#F5E1AC',

  error: '#F0B0A6',
  'on-error': '#5B120D',
  'error-container': '#7E241C',
  'on-error-container': '#FADDD7',

  background: '#1A231F',
  'on-background': '#EDE6E5',
  surface: '#1A231F',
  'on-surface': '#EDE6E5',
  'surface-variant': '#3C4A43',
  'on-surface-variant': '#B3BBAD',

  outline: '#8B9382',
  'outline-variant': '#3C4A43',

  'surface-container-lowest': '#141B18',
  'surface-container-low': '#1F2A25',
  'surface-container': '#24302B',
  'surface-container-high': '#2C3D37',
  'surface-container-highest': '#354841',
  'surface-dim': '#141B18',
  'surface-bright': '#3A4E46',

  'inverse-surface': '#EDE6E5',
  'inverse-on-surface': '#2C3D37',
  'inverse-primary': '#2C3D37',
  'surface-tint': '#BCCBB6',

  shadow: '#000000',
  scrim: '#0C110F',
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
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
  if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, mode)
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
