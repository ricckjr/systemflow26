export function formatDuration(startDate: string | Date | undefined | null): string {
  if (!startDate) return '-'
  
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  
  if (diffMs < 0) return '0m'

  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }

  return `${minutes}m`
}

export function getStatusDurationColor(startDate: string | undefined | null): string {
  if (!startDate) return 'text-[var(--text-muted)]'
  
  const start = new Date(startDate)
  const now = new Date()
  const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60)

  if (diffHours < 24) return 'text-emerald-500' // < 1 dia
  if (diffHours < 72) return 'text-amber-500'   // < 3 dias
  return 'text-rose-500'                        // > 3 dias
}
