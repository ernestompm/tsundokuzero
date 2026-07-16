import type { ReactNode } from 'react'
import './RichText.css'

/**
 * Texto rico seguro para fichas editoriales (biografías de autor).
 *
 * Renderiza un subconjunto de Markdown SIN pasar por innerHTML: el texto
 * se convierte directamente en elementos React, así que lo que escriba un
 * admin jamás puede inyectar HTML/JS.
 *
 * Soporta:
 *   ## Título        ### Subtítulo
 *   **negrita**      *cursiva*
 *   - listas         1. listas numeradas
 *   > citas          --- separador
 *   | tablas | con cabecera |
 *   [enlaces](https://…)  (solo http/https)
 */
export default function RichText({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  return (
    <div className={`richtext body-medium ${className}`}>
      {parseBlocks(text)}
    </div>
  )
}

/* ===================== Bloques ===================== */

function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    if (!t) {
      i++
      continue
    }

    // ### Subtítulo / ## Título
    if (t.startsWith('### ')) {
      out.push(<h3 key={key++} className="serif">{inline(t.slice(4))}</h3>)
      i++
      continue
    }
    if (t.startsWith('## ')) {
      out.push(<h2 key={key++} className="serif">{inline(t.slice(3))}</h2>)
      i++
      continue
    }

    // --- separador
    if (/^-{3,}$/.test(t)) {
      out.push(<hr key={key++} />)
      i++
      continue
    }

    // > cita (líneas consecutivas)
    if (t.startsWith('> ') || t === '>') {
      const quote: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('> ') || lines[i].trim() === '>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      out.push(
        <blockquote key={key++}>
          {inline(quote.join(' ').trim())}
        </blockquote>,
      )
      continue
    }

    // - lista de viñetas
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      out.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // 1. lista numerada
    if (/^\d{1,2}[.)]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^\d{1,2}[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d{1,2}[.)]\s+/, ''))
        i++
      }
      out.push(
        <ol key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // | tabla | (primera fila = cabecera; la fila |---| se descarta)
    if (t.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const raw = lines[i].trim()
        if (!/^\|[\s:|-]+\|?$/.test(raw)) {
          rows.push(
            raw
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.trim()),
          )
        }
        i++
      }
      if (rows.length > 0) {
        const [head, ...body] = rows
        out.push(
          <div key={key++} className="richtext__tablewrap">
            <table>
              <thead>
                <tr>
                  {head.map((c, j) => (
                    <th key={j} className="label-medium">{inline(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>{inline(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        )
      }
      continue
    }

    // Párrafo: líneas consecutivas normales
    const para: string[] = [t]
    i++
    while (i < lines.length) {
      const nt = lines[i].trim()
      if (
        !nt ||
        nt.startsWith('#') ||
        nt.startsWith('>') ||
        nt.startsWith('|') ||
        /^[-*]\s+/.test(nt) ||
        /^\d{1,2}[.)]\s+/.test(nt) ||
        /^-{3,}$/.test(nt)
      )
        break
      para.push(nt)
      i++
    }
    out.push(<p key={key++}>{inline(para.join(' '))}</p>)
  }

  return out
}

/* ===================== Inline ===================== */

/**
 * [texto](https://…) → enlace externo (pestaña nueva);
 * [texto](/ruta) → enlace interno (p. ej. entre páginas legales);
 * luego negrita y cursiva. Nada más: jamás javascript: ni HTML.
 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) out.push(...emphasis(text.slice(last, m.index), key))
    key += 100
    const external = m[2].startsWith('http')
    out.push(
      <a
        key={`l${key++}`}
        href={m[2]}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {emphasis(m[1], key)}
      </a>,
    )
    key += 100
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(...emphasis(text.slice(last), key))
  return out
}

/** **negrita** y *cursiva* (también dentro de la negrita). */
function emphasis(text: string, base: number): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g
  let last = 0
  let key = base
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={`b${key++}`}>{m[1]}</strong>)
    else out.push(<em key={`i${key++}`}>{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
