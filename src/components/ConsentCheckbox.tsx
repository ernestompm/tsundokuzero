import { Link } from 'react-router-dom'

/**
 * Casilla de aceptación de términos (RGPD art. 7 + LOPDGDD art. 7).
 * Compartida por registro, onboarding y TermsGate (auditoría B-10):
 * checkbox nativo (semántica real, teclado gratis) con los enlaces
 * legales fuera del control interactivo.
 */
export function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className={`consent-toggle${checked ? ' active' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="material-symbols-rounded" aria-hidden="true">
        {checked ? 'check_circle' : 'radio_button_unchecked'}
      </span>
      <span>
        He leído y acepto los{' '}
        <Link
          to="/legal/terminos"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          Términos y condiciones
        </Link>{' '}
        y la{' '}
        <Link
          to="/legal/privacidad"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          Política de privacidad
        </Link>
        , y declaro tener al menos 14 años.
      </span>
    </label>
  )
}
