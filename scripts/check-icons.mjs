// Verifica que scripts/icons.txt (fuente de verdad del subconjunto
// SELF-HOSTED de Material Symbols) esté en orden alfabético y cubra todos
// los iconos usados en el código. Si añades un icono nuevo: añádelo a
// icons.txt (ordenado) y ejecuta `npm run fetch:icons` para regenerar
// public/fonts/material-symbols-rounded.woff2.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const list = readFileSync('scripts/icons.txt', 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)

// 1) Orden alfabético (el endpoint de subsetting exige la lista ordenada)
const sorted = [...list].sort()
if (list.join(',') !== sorted.join(',')) {
  const bad = list.find((x, i) => x !== sorted[i])
  console.error(`✗ scripts/icons.txt NO está ordenado alfabéticamente (revisa «${bad}»).`)
  console.error('  Orden correcto:\n  ' + sorted.join('\n  '))
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
  console.error('  Añádelos (ordenados) a scripts/icons.txt y ejecuta npm run fetch:icons.')
  process.exit(1)
}

// 3) La fuente self-hosted debe existir (RGPD: nada se carga de Google)
if (!existsSync('public/fonts/material-symbols-rounded.woff2')) {
  console.error('✗ Falta public/fonts/material-symbols-rounded.woff2 — ejecuta npm run fetch:icons.')
  process.exit(1)
}

console.log(`✓ Iconos OK: ${list.length} en el subset, orden alfabético, cobertura completa, fuente self-hosted presente.`)
