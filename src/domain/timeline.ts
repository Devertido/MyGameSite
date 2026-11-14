import type { CalendarMonth } from './calendar'
import type { CalendarEra } from './calendarYear'

export type Timeline = {
  name: string
  startYear: number
  endYear: number
  daysPerYear: number
  events?: TimelineEvent[]
  characters?: TimelineCharacter[]
  calendars: [TimelineCalendar, ...TimelineCalendar[]]
}

export type TimelineCalendar = {
  name: string
  months: CalendarMonth[]
  weekdayNames: string[]
  firstWeekday: number
  epochWeekday: number
  era: CalendarEra
}

export function validateTimelineBounds(
  startYear: number,
  endYear: number,
  original?: Pick<Timeline, 'startYear' | 'endYear'>,
): string | null {
  if (!Number.isSafeInteger(startYear) || !Number.isSafeInteger(endYear)) {
    return 'Введите целые годы от −9 007 199 254 740 991 до 9 007 199 254 740 991.'
  }

  if (endYear < startYear) {
    return 'Конечный год должен быть не раньше начального.'
  }

  if (original && (startYear > original.startYear || endYear < original.endYear)) {
    return 'Новые границы должны включать весь текущий диапазон таймлайна.'
  }

  return null
}

export type TimelineEvent = {
  id: string
  year: number
  title: string
  description: string
  characterIds?: string[]
  sides?: EventSide[]
  onTimeline?: boolean
  date?: EventDays
  end?: EventEndpoint
}

export function validateEvent(
  event: Omit<TimelineEvent, 'id'>,
  bounds: Pick<Timeline, 'startYear' | 'endYear' | 'daysPerYear'>,
): string | null {
  if (!event.title.trim()) return 'Введите название события.'
  if (!isEventEndpoint(event, bounds) || (event.end !== undefined && !isEventEndpoint(event.end, bounds))) {
    return 'Укажите допустимые даты в пределах таймлайна.'
  }
  if (event.end && (event.end.year < event.year ||
      (event.end.year === event.year && (event.end.date?.last ?? bounds.daysPerYear) < (event.date?.first ?? 1)))) {
    return 'Конец периода должен быть не раньше начала.'
  }
  return null
}

export type EventDays = { first: number; last: number }
export type EventEndpoint = { year: number; date?: EventDays }

function isEventEndpoint(value: unknown, bounds: Pick<Timeline, 'startYear' | 'endYear' | 'daysPerYear'>): value is EventEndpoint {
  if (typeof value !== 'object' || value === null) return false
  const { year, date } = value as Partial<EventEndpoint>
  if (typeof year !== 'number' || !Number.isSafeInteger(year) || year < bounds.startYear || year > bounds.endYear) return false
  return date === undefined || (date !== null && Number.isSafeInteger(date.first) &&
    Number.isSafeInteger(date.last) && date.first >= 1 && date.last >= date.first && date.last <= bounds.daysPerYear)
}

export function eventDays(months: readonly CalendarMonth[], month: number, day?: number): EventDays | null {
  if (!Number.isSafeInteger(month) || month < 1) return null
  const selected = months[month - 1]
  if (!selected || (day !== undefined && (!Number.isSafeInteger(day) || day < 1 || day > selected.days))) return null
  const offset = months.slice(0, month - 1).reduce((sum, item) => sum + item.days, 0)
  return { first: offset + (day ?? 1), last: offset + (day ?? selected.days) }
}

export function calendarDay(months: readonly CalendarMonth[], offset: number): string {
  let day = offset
  for (const month of months) {
    if (day <= month.days) return `${day} · ${month.name}`
    day -= month.days
  }
  throw new RangeError('День вне календарного года.')
}

export type TimelineCharacter = {
  id: string
  name: string
  description: string
}

export type EventSide = {
  id: string
  name: string
  characterIds: string[]
}
