import { APP_TIME_ZONE } from '../constants/timezone'

export type DateInput = Date | string | number | null | undefined

export function toDate(value: DateInput): Date | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (m) {
      const year = Number(m[1])
      const month = Number(m[2])
      const day = Number(m[3])
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      if (Number.isNaN(date.getTime())) return null
      return date
    }
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function buildFromParts(parts: Intl.DateTimeFormatPart[]) {
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type === 'literal') continue
    map[part.type] = part.value
  }
  return map
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimePartsFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateInputPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const tzPartsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getTzPartsFormatter(timeZone: string) {
  const cached = tzPartsFormatterCache.get(timeZone)
  if (cached) return cached
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  tzPartsFormatterCache.set(timeZone, dtf)
  return dtf
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const dtf = getTzPartsFormatter(timeZone)
  const parts = buildFromParts(dtf.formatToParts(date))
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second)
  return asUTC - date.getTime()
}

export function formatDateBR(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  return dateFormatter.format(date)
}

export function formatTimeBR(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  return timeFormatter.format(date)
}

export function formatDateTimeBR(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  const parts = buildFromParts(dateTimePartsFormatter.formatToParts(date))
  const dd = parts.day ?? ''
  const mm = parts.month ?? ''
  const yyyy = parts.year ?? ''
  const hh = parts.hour ?? ''
  const min = parts.minute ?? ''
  if (!dd || !mm || !yyyy) return dateFormatter.format(date)
  if (!hh || !min) return `${dd}/${mm}/${yyyy}`
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function toDateInputValue(value: DateInput): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = toDate(value)
  if (!date) return ''
  const parts = buildFromParts(dateInputPartsFormatter.formatToParts(date))
  const yyyy = parts.year ?? ''
  const mm = parts.month ?? ''
  const dd = parts.day ?? ''
  if (!yyyy || !mm || !dd) return ''
  return `${yyyy}-${mm}-${dd}`
}

export function zonedDateTimeToUtcDate(input: {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
  timeZone?: string
}): Date | null {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
    timeZone = APP_TIME_ZONE,
  } = input

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  if (Number.isNaN(guess.getTime())) return null

  const offset1 = getTimeZoneOffsetMs(timeZone, guess)
  const utc1 = new Date(guess.getTime() - offset1)
  const offset2 = getTimeZoneOffsetMs(timeZone, utc1)
  const utc2 = new Date(guess.getTime() - offset2)
  if (Number.isNaN(utc2.getTime())) return null
  return utc2
}

export function parseDateInputToEndOfDayISO(dateValue: string, timeZone: string = APP_TIME_ZONE): string | null {
  const trimmed = (dateValue || '').trim()
  if (!trimmed) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const utc = zonedDateTimeToUtcDate({ year, month, day, hour: 23, minute: 59, second: 59, millisecond: 999, timeZone })
  if (!utc) return null
  return utc.toISOString()
}
