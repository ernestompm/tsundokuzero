/**
 * Aviso de contenido sensible (P2-14): fichas que tratan salud mental o
 * conducta suicida llevan una nota discreta con el recurso oficial de
 * ayuda (línea 024, 24 h, gratuita y confidencial).
 */
const SENSITIVE_RE = /suicid|depresi|ansiedad|salud mental|autolesi/i

export function isSensitiveText(text: string | null | undefined): boolean {
  return !!text && SENSITIVE_RE.test(text)
}

export default function SensitiveNote() {
  return (
    <aside className="sensitive-note body-small" role="note">
      Esta ficha aborda temas de salud mental. Si tú o alguien de tu entorno
      lo está pasando mal: <b>llama al 024</b> (línea de atención a la
      conducta suicida — 24 h, gratuita y confidencial).
    </aside>
  )
}
