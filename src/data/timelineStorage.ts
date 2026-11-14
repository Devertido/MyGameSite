import { validateMonths, validateWeek } from '../domain/calendar.ts'
import { validateCalendarEra } from '../domain/calendarYear.ts'
import type { Timeline } from '../domain/timeline'

const keyPrefix = 'arena-atlas:timeline:v1:'

export type SavedTimeline = { id: string; timeline: Timeline }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTimeline(value: unknown): value is Timeline {
  if (!isRecord(value)) return false
  const { name, startYear, endYear, daysPerYear, calendar } = value
  if (typeof name !== 'string' || !name.trim() ||
      typeof startYear !== 'number' || !Number.isSafeInteger(startYear) ||
      typeof endYear !== 'number' || !Number.isSafeInteger(endYear) || endYear < startYear ||
      typeof daysPerYear !== 'number' || !isRecord(calendar)) return false

  const { months, weekdayNames, firstWeekday, epochWeekday, era } = calendar
  if (!Array.isArray(months) || !months.every((month: unknown) =>
    isRecord(month) && typeof month.name === 'string' && typeof month.days === 'number'
  )) return false
  if (!Array.isArray(weekdayNames) || !weekdayNames.every((name: unknown) => typeof name === 'string') ||
      typeof firstWeekday !== 'number' || typeof epochWeekday !== 'number' || !isRecord(era)) return false

  const { systemAnchorYear, calendarAnchorYear, hasYearZero } = era
  if (typeof systemAnchorYear !== 'number' || typeof calendarAnchorYear !== 'number' ||
      typeof hasYearZero !== 'boolean') return false

  return validateMonths(months, daysPerYear) === null &&
    validateWeek(weekdayNames, firstWeekday, epochWeekday) === null &&
    validateCalendarEra({ systemAnchorYear, calendarAnchorYear, hasYearZero }) === null
}

export function saveTimeline(
  id: string,
  timeline: Timeline,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  if (!id.trim()) throw new Error('Для сохранения нужен идентификатор таймлайна.')

  // Каждый таймлайн записывается отдельно.
  storage.setItem(keyPrefix + id, JSON.stringify(timeline))
}

export function loadTimelines(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'> = window.localStorage,
): { entries: SavedTimeline[]; skipped: number } {
  const entries: SavedTimeline[] = []
  let skipped = 0

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(keyPrefix)) continue
    const id = key.slice(keyPrefix.length)
    const json = storage.getItem(key)
    if (json === null) continue

    let timeline: unknown
    try {
      timeline = JSON.parse(json)
    } catch {
      skipped += 1
      continue
    }

    if (id.trim() && isTimeline(timeline)) {
      entries.push({ id, timeline })
    } else {
      skipped += 1
    }
  }

  return { entries, skipped }
}
