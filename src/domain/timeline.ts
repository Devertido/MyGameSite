import type { CalendarMonth } from './calendar'
import type { CalendarEra } from './calendarYear'

export type Timeline = {
  name: string
  startYear: number
  endYear: number
  daysPerYear: number
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
