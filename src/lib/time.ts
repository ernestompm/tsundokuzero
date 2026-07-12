/** "hace 5 min", "hace 3 h", "hace 2 d" o la fecha si es antigua. */
export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'ahora mismo'
  const minutes = seconds / 60
  if (minutes < 60) return `hace ${Math.floor(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `hace ${Math.floor(hours)} h`
  const days = hours / 24
  if (days < 7) return `hace ${Math.floor(days)} d`
  return new Date(iso).toLocaleDateString()
}
