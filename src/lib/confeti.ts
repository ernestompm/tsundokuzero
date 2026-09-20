/**
 * Confeti, en canvas y sin dependencias.
 *
 * Son ochenta líneas: meter una librería de 15 kB para tirar papelitos
 * sería exactamente el tipo de dependencia que no queremos.
 *
 * Los colores son los de la marca, no los del arcoíris de rigor: un
 * confeti genérico te dice «esto lo hizo alguien con una librería», y uno
 * en tu paleta te dice que la fiesta es de esta casa.
 */

const COLORES = [
  '#bc5339', // Vermillion: el que señala
  '#f5e1ac', // Glad Yellow
  '#566955', // Picholine
  '#a5a88f', // Bud
  '#2c3d37', // Scarab
  '#fffcfb', // papel
]

interface Papel {
  x: number
  y: number
  vx: number
  vy: number
  giro: number
  vgiro: number
  ancho: number
  alto: number
  color: string
}

/**
 * Tira confeti desde el centro de un elemento (o de la pantalla).
 * No hace nada si el sistema pide movimiento reducido: una celebración
 * no puede marear a quien ha dicho que no quiere animaciones.
 */
export function confeti(desde?: HTMLElement | null) {
  if (
    typeof window === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const ancho = window.innerWidth
  const alto = window.innerHeight
  canvas.width = ancho * dpr
  canvas.height = alto * dpr
  ctx.scale(dpr, dpr)

  const caja = desde?.getBoundingClientRect()
  const ox = caja ? caja.left + caja.width / 2 : ancho / 2
  const oy = caja ? caja.top + caja.height / 2 : alto / 3

  const papeles: Papel[] = Array.from({ length: 90 }, () => {
    // Abanico hacia arriba: hacia los lados cae plano y aburre
    const angulo = (-Math.PI / 2) + (Math.random() - 0.5) * 2.1
    const fuerza = 5 + Math.random() * 7
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angulo) * fuerza,
      vy: Math.sin(angulo) * fuerza,
      giro: Math.random() * Math.PI,
      vgiro: (Math.random() - 0.5) * 0.28,
      ancho: 5 + Math.random() * 5,
      alto: 8 + Math.random() * 7,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    }
  })

  const GRAVEDAD = 0.22
  const ROCE = 0.992
  let cuadros = 0

  const pintar = () => {
    cuadros++
    ctx.clearRect(0, 0, ancho, alto)

    let vivos = 0
    for (const p of papeles) {
      p.vy += GRAVEDAD
      p.vx *= ROCE
      p.x += p.vx
      p.y += p.vy
      p.giro += p.vgiro

      if (p.y - p.alto > alto) continue
      vivos++

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.giro)
      // El papel se ve de canto según gira: escalarlo en X lo simula sin
      // tener que dibujar en 3D
      ctx.scale(Math.cos(p.giro * 1.4), 1)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto)
      ctx.restore()
    }

    if (vivos > 0 && cuadros < 420) {
      requestAnimationFrame(pintar)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(pintar)
}
