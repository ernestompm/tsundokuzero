import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"]), md-filled-button, md-outlined-button, md-text-button, md-icon-button, md-outlined-text-field'

/**
 * Comportamiento de diálogo accesible (auditoría UX C-02):
 *  - Escape cierra;
 *  - el foco queda atrapado dentro (Tab/Shift+Tab ciclan);
 *  - al abrir, enfoca `[autofocus]` o el primer elemento interactivo;
 *  - al cerrar, devuelve el foco al elemento que lo abrió.
 *
 * Uso: `const ref = useModalBehavior(open, onClose)` y colgar `ref` del
 * contenedor del diálogo (que debe llevar role="dialog" aria-modal="true").
 */
export function useModalBehavior(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current

    const focusables = () =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : []

    // Foco inicial. Los componentes de @material/web renderizan su shadow
    // DOM de forma asíncrona (Lit): si el focus() llega antes, se pierde.
    // Se reintenta con un timer corto (los timers, a diferencia de rAF,
    // también disparan con la pestaña en segundo plano).
    // (document.activeElement devuelve el host aunque el foco real esté
    // dentro de su shadow root, así que contains() basta como comprobación)
    let attempts = 0
    let focusTimer: ReturnType<typeof setTimeout> | undefined
    const focusInitial = () => {
      const initial =
        node?.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0]
      initial?.focus()
      attempts += 1
      if (attempts < 6 && node && !node.contains(document.activeElement)) {
        focusTimer = setTimeout(focusInitial, 40)
      }
    }
    focusInitial()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      if (focusTimer !== undefined) clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      opener?.focus?.()
    }
  }, [open])

  return ref
}
