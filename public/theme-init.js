/* Tema antes del primer paint (auditoría B-07): evita el flash claro en
   modo oscuro y da color a la app aunque el bundle tarde. La paleta
   completa la aplica src/theme/theme.ts al arrancar React; aquí solo van
   el fondo y el texto base (mismos hex que theme.ts). Script externo
   (no inline) porque la CSP de producción es script-src 'self'. */
;(function () {
  try {
    var mode = localStorage.getItem('tz-theme-mode')
    var dark =
      mode === 'dark' ||
      (mode !== 'light' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.setProperty(
      '--md-sys-color-background',
      dark ? '#1B1B17' : '#F6F3EC',
    )
    root.style.setProperty(
      '--md-sys-color-on-background',
      dark ? '#E7E3D8' : '#23231E',
    )
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#1B1B17' : '#F6F3EC')
  } catch {
    /* sin localStorage: se queda el tema claro por defecto */
  }
})()
