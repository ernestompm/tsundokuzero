/**
 * Identidad visual de Tsundoku Zero: editorial y serena — papel crema,
 * verde salvia y acentos de arcilla. La paleta está hecha a mano y se
 * mapea sobre los tokens de Material Design 3 (`--md-sys-color-*`), de
 * modo que los componentes de @material/web siguen funcionando pero con
 * el aspecto de la marca, en claro y oscuro.
 */

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tz-theme-mode'

type Palette = Record<string, string>

const LIGHT: Palette = {
  primary: '#40513B',
  'on-primary': '#FFFFFF',
  'primary-container': '#C7D8BD',
  'on-primary-container': '#1B2A18',
  secondary: '#565F52',
  'on-secondary': '#FFFFFF',
  'secondary-container': '#DCE4D3',
  'on-secondary-container': '#171E13',
  tertiary: '#8A5A3F',
  'on-tertiary': '#FFFFFF',
  'tertiary-container': '#F3DBCB',
  'on-tertiary-container': '#2F1608',
  error: '#B3261E',
  'on-error': '#FFFFFF',
  'error-container': '#F7DDD7',
  'on-error-container': '#410E0B',
  background: '#F6F3EC',
  'on-background': '#23231E',
  surface: '#F6F3EC',
  'on-surface': '#23231E',
  'surface-variant': '#E3DECF',
  'on-surface-variant': '#6B6659',
  outline: '#9C9585',
  'outline-variant': '#D4CEBF',
  'surface-container-lowest': '#FFFFFF',
  'surface-container-low': '#F1EDE4',
  'surface-container': '#ECE7DD',
  'surface-container-high': '#E6E1D6',
  'surface-container-highest': '#E0DACE',
  'surface-dim': '#DEDACF',
  'surface-bright': '#F6F3EC',
  'inverse-surface': '#302F2A',
  'inverse-on-surface': '#F2EFE7',
  'inverse-primary': '#ABC79F',
  'surface-tint': '#40513B',
  shadow: '#000000',
  scrim: '#000000',
}

const DARK: Palette = {
  primary: '#ABC79F',
  'on-primary': '#163017',
  'primary-container': '#2E402B',
  'on-primary-container': '#C7E2BB',
  secondary: '#C0C8B5',
  'on-secondary': '#2A3226',
  'secondary-container': '#40483B',
  'on-secondary-container': '#DCE4D3',
  tertiary: '#E7B695',
  'on-tertiary': '#47260F',
  'tertiary-container': '#6B4327',
  'on-tertiary-container': '#F3DBCB',
  error: '#F2B8B5',
  'on-error': '#601410',
  'error-container': '#8C1D18',
  'on-error-container': '#F9DEDC',
  background: '#1B1B17',
  'on-background': '#E7E3D8',
  surface: '#1B1B17',
  'on-surface': '#E7E3D8',
  'surface-variant': '#47463C',
  'on-surface-variant': '#C9C3B3',
  outline: '#928C7D',
  'outline-variant': '#47463C',
  'surface-container-lowest': '#151510',
  'surface-container-low': '#23231E',
  'surface-container': '#272722',
  'surface-container-high': '#32322C',
  'surface-container-highest': '#3D3D36',
  'surface-dim': '#1B1B17',
  'surface-bright': '#413F39',
  'inverse-surface': '#E7E3D8',
  'inverse-on-surface': '#302F2A',
  'inverse-primary': '#40513B',
  'surface-tint': '#ABC79F',
  shadow: '#000000',
  scrim: '#000000',
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
