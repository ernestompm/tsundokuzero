import type * as React from 'react'

/**
 * Tipado JSX para los web components de @material/web (MD3).
 * React 19 soporta custom elements de forma nativa; aquí solo se declaran
 * las etiquetas para TypeScript. Props laxas a propósito: los atributos
 * reales los valida el propio componente.
 */
type MdProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  [attr: string]: unknown
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MdProps
      'md-outlined-button': MdProps
      'md-text-button': MdProps
      'md-elevated-button': MdProps
      'md-filled-tonal-button': MdProps
      'md-fab': MdProps
      'md-icon': MdProps
      'md-icon-button': MdProps
      'md-filled-text-field': MdProps
      'md-outlined-text-field': MdProps
      'md-checkbox': MdProps
      'md-switch': MdProps
      'md-assist-chip': MdProps
      'md-filter-chip': MdProps
      'md-input-chip': MdProps
      'md-suggestion-chip': MdProps
      'md-chip-set': MdProps
      'md-dialog': MdProps
      'md-divider': MdProps
      'md-ripple': MdProps
      'md-elevation': MdProps
      'md-circular-progress': MdProps
      'md-linear-progress': MdProps
      'md-list': MdProps
      'md-list-item': MdProps
      'md-menu': MdProps
      'md-menu-item': MdProps
      'md-select-option': MdProps
      'md-filled-select': MdProps
      'md-outlined-select': MdProps
      'md-radio': MdProps
      'md-slider': MdProps
      'md-tabs': MdProps
      'md-primary-tab': MdProps
      'md-secondary-tab': MdProps
    }
  }
}
