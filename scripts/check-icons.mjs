// Verifica que el subconjunto de Material Symbols de index.html esté en
// ORDEN ALFABÉTICO (Google Fonts devuelve 400 si no lo está → se rompen
// TODOS los iconos) y que incluya todos los iconos usados en el código.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const html = readFileSync('index.html', 'utf8')
const m = html.match(/icon_names=([a-z_,]+)/)
if (!m) {
  console.error('✗ No se encontró icon_names en index.html')
  process.exit(1)
}
const list = m[1].split(',')

// 1) Orden alfabético
const sorted = [...list].sort()
if (list.join(',') !== sorted.join(',')) {
  const bad = list.find((x, i) => x !== sorted[i])
  console.error(`✗ icon_names NO está ordenado alfabéticamente (revisa «${bad}»).`)
  console.error('  Google Fonts responde 400 y se rompen todos los iconos.')
  console.error('  Orden correcto:\n  ' + sorted.join(','))
  process.exit(1)
}

// 2) Cobertura: cada icono usado en el código debe estar en el subset
const used = new Set()
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) {
      const s = readFileSync(p, 'utf8')
      for (const mm of s.matchAll(/material-symbols-rounded[^>]*>\s*([a-z_]+)\s*</g))
        used.add(mm[1])
      for (const mm of s.matchAll(/material-symbols-rounded[^>]*>\s*\{[^}]*'([a-z_]+)'\s*:\s*'([a-z_]+)'/g)) {
        used.add(mm[1]); used.add(mm[2])
      }
      for (const mm of s.matchAll(/icon:\s*'([a-z_]+)'/g)) used.add(mm[1])
    }
  }
}
walk('src')
const subset = new Set(list)
const missing = [...used].filter((i) => !subset.has(i)).sort()
if (missing.length) {
  console.error('✗ Iconos usados que faltan en el subset:', missing.join(', '))
  console.error('  Añádelos (ordenados) a icon_names en index.html.')
  process.exit(1)
}

console.log(`✓ Iconos OK: ${list.length} en el subset, orden alfabético, cobertura completa.`)
