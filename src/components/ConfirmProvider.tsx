import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import { useModalBehavior } from './modal'

/**
 * Diálogo de confirmación propio (auditoría UX M-04): sustituye a
 * window.confirm/alert con la estética de la app y accesibilidad completa
 * (Escape, focus trap, restauración de foco — vía useModalBehavior).
 *
 * Uso:
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Eliminar publicación', danger: true }))) return
 */

export type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Acción destructiva: el botón principal usa el color de error. */
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        // Si hubiera uno pendiente, se resuelve como cancelado
        resolver.current?.(false)
        resolver.current = resolve
        setOpts(o)
      }),
    [],
  )

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpts(null)
  }

  const dialogRef = useModalBehavior(opts !== null, () => settle(false))

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="tz-dialog-scrim" onClick={() => settle(false)}>
          <div
            ref={dialogRef}
            className="tz-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tz-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="tz-dialog-title" className="title-large serif">
              {opts.title}
            </h2>
            {opts.message && (
              <p className="body-medium on-surface-variant">{opts.message}</p>
            )}
            <div className="tz-dialog__actions">
              <md-text-button type="button" onClick={() => settle(false)}>
                {opts.cancelLabel ?? 'Cancelar'}
              </md-text-button>
              <md-filled-button
                type="button"
                autofocus
                class={opts.danger ? 'tz-dialog__danger' : undefined}
                onClick={() => settle(true)}
              >
                {opts.confirmLabel ?? 'Aceptar'}
              </md-filled-button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
