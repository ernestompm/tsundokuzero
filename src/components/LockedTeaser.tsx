/**
 * Teaser de contenido bloqueado por el spoiler gate.
 * El texto real NUNCA llega al cliente (las vistas devuelven body=null);
 * lo borroso es un texto de relleno — inspeccionar el DOM no revela nada.
 */
export default function LockedTeaser({
  label,
  lines = 2,
}: {
  label: string
  lines?: number
}) {
  const fake =
    'La biblioteca guarda este secreto un poco más adelante en el libro. Sigue leyendo y vuelve aquí. '
  return (
    // role="note": sin rol, el aria-label sobre un div es inerte (auditoría UX)
    <div className="locked-teaser" role="note" aria-label={label}>
      <p className="locked-teaser__fake body-medium" aria-hidden>
        {fake.repeat(lines)}
      </p>
      <span className="locked-teaser__label label-medium">
        <span className="material-symbols-rounded" aria-hidden="true">lock</span>
        {label}
      </span>
    </div>
  )
}
