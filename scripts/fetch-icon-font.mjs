// Regenera el subconjunto SELF-HOSTED de Material Symbols Rounded.
// Uso: npm run fetch:icons  (solo en desarrollo, cuando cambies icons.txt;
// la app en producción NUNCA llama a Google — auditoría legal P0-3).
// Fuente: Material Symbols (Google), licencia Apache 2.0.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const icons = readFileSync('scripts/icons.txt', 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .sort()
  .join(',')

const cssUrl =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded' +
  ':opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' +
  `&icon_names=${icons}&display=block`

// UA de navegador moderno: sin él, Google no sirve el woff2 variable
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text()
const m = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)
if (!m) {
  console.error('✗ No se encontró la URL del woff2 en la respuesta:\n' + css)
  process.exit(1)
}

const buf = Buffer.from(await (await fetch(m[1], { headers: { 'User-Agent': UA } })).arrayBuffer())
mkdirSync('public/fonts', { recursive: true })
writeFileSync('public/fonts/material-symbols-rounded.woff2', buf)
console.log(`✓ public/fonts/material-symbols-rounded.woff2 regenerado (${(buf.length / 1024).toFixed(1)} KB, ${icons.split(',').length} iconos).`)
