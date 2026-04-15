import { format, formatDistanceToNow, differenceInHours, differenceInDays, isPast } from 'date-fns'

export function fmtDate(ts) {
  if (!ts) return '—'
  return format(new Date(ts), 'dd MMM yyyy')
}

export function fmtDateTime(ts) {
  if (!ts) return '—'
  return format(new Date(ts), 'dd MMM yyyy · HH:mm')
}

export function timeAgo(ts) {
  if (!ts) return '—'
  return formatDistanceToNow(new Date(ts), { addSuffix: true })
}

export function timeLeft(ts) {
  if (!ts) return '—'
  if (isPast(new Date(ts))) return 'EXPIRED'
  const hours = differenceInHours(new Date(ts), new Date())
  const days = differenceInDays(new Date(ts), new Date())
  if (days > 0) return `${days}d left`
  return `${hours}h left`
}

export function lastSeen(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 300) return 'ONLINE'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
