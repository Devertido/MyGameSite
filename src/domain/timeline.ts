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
}

export function validateEvent(
  event: Omit<TimelineEvent, 'id'>,
  bounds: Pick<Timeline, 'startYear' | 'endYear'>,
): string | null {
  if (!event.title.trim()) return 'Введите название события.'
  if (!Number.isSafeInteger(event.year) || event.year < bounds.startYear || event.year > bounds.endYear) {
    return 'Укажите целый системный год в пределах таймлайна.'
  }
  return null
}

export type TimelineCharacter = {
  id: string
  name: string
  description: string
}
