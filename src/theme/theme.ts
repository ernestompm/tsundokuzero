import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  applyTheme,
  type Theme,
} from '@material/material-color-utilities'

/** Color de marca Tsundoku Zero — seed del esquema dinámico MD3 */
export const SEED_COLOR = '#C3492B'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tz-theme-mode'

const theme: Theme = themeFromSourceColor(argbFromHex(SEED_COLOR))

/**
 * Tokens de superficie tonal (surface-container-*) que applyTheme() aún no
 * emite; se derivan de la paleta neutra según la spec MD3.
 */
const SURFACE_TONES: Record<string, { light: number; dark: number }> = {
  'surface-dim': { light: 87, dark: 6 },
  'surface-bright': { light: 98, dark: 24 },
  'surface-container-lowest': { light: 100, dark: 4 },
  'surface-container-low': { light: 96, dark: 10 },
  'surface-container': { light: 94, dark: 12 },
  'surface-container-high': { light: 92, dark: 17 },
  'surface-container-highest': { light: 90, dark: 22 },
  surface: { light: 98, dark: 6 },
  background: { light: 98, dark: 6 },
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
  applyTheme(theme, { target: document.documentElement, dark })
  const neutral = theme.palettes.neutral
  const style = document.documentElement.style
  for (const [token, tones] of Object.entries(SURFACE_TONES)) {
    style.setProperty(
      `--md-sys-color-${token}`,
      hexFromArgb(neutral.tone(dark ? tones.dark : tones.light)),
    )
  }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute(
    'content',
    getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-surface')
      .trim(),
  )
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
