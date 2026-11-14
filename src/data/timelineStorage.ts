import { validateMonths, validateWeek } from '../domain/calendar.ts'
import { validateCalendarEra } from '../domain/calendarYear.ts'
import { validateEvent, type Timeline, type TimelineCalendar, type TimelineCharacter, type TimelineEvent } from '../domain/timeline.ts'

const keyPrefix = 'arena-atlas:timeline:v1:'

export type SavedTimeline = { id: string; timeline: Timeline }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTimeline(value: unknown): Timeline | null {
  if (!isRecord(value)) return null
  const { name, startYear, endYear, daysPerYear } = value
  if (typeof name !== 'string' || !name.trim() ||
      typeof startYear !== 'number' || !Number.isSafeInteger(startYear) ||
      typeof endYear !== 'number' || !Number.isSafeInteger(endYear) || endYear < startYear ||
      typeof daysPerYear !== 'number') return null

  // Старые записи содержат один календарь без названия.
  const legacy = !('calendars' in value) && isRecord(value.calendar)
  const calendars: unknown = legacy
    ? [{ ...value.calendar as Record<string, unknown>, name: 'Основной календарь' }]
    : value.calendars

  if (!Array.isArray(calendars) || !calendars.length ||
      !calendars.every((calendar: unknown) => isCalendar(calendar, daysPerYear))) return null

  const [first, ...rest] = calendars
  if (!first) return null
  const timeline: Timeline = { name, startYear, endYear, daysPerYear, calendars: [first, ...rest] }
  const characterIds = new Set<string>()
  if ('characters' in value) {
    const characters = value.characters
    if (!Array.isArray(characters)) return null
    const parsed: TimelineCharacter[] = []
    for (const character of characters as unknown[]) {
      if (!isRecord(character) || typeof character.id !== 'string' || !character.id.trim() ||
          characterIds.has(character.id) || typeof character.name !== 'string' || !character.name.trim() ||
          typeof character.description !== 'string') return null
      characterIds.add(character.id)
      parsed.push({ id: character.id, name: character.name, description: character.description })
    }
    timeline.characters = parsed
  }

  if ('events' in value) {
    const events = value.events
    if (!Array.isArray(events) || !events.every((event: unknown): event is TimelineEvent =>
      isRecord(event) && typeof event.id === 'string' && Boolean(event.id.trim()) &&
      typeof event.year === 'number' && typeof event.title === 'string' &&
      typeof event.description === 'string' &&
      (!('characterIds' in event) || (Array.isArray(event.characterIds) &&
        new Set(event.characterIds).size === event.characterIds.length &&
        event.characterIds.every((id: unknown) => typeof id === 'string' && characterIds.has(id)))) &&
      validateEvent({ year: event.year, title: event.title, description: event.description,
        date: event.date as TimelineEvent['date'], end: event.end as TimelineEvent['end'] }, timeline) === null
    )) return null

    if (new Set(events.map(({ id }) => id)).size !== events.length) return null
    timeline.events = events
  }
  return timeline
}

function isCalendar(calendar: unknown, daysPerYear: number): calendar is TimelineCalendar {
  if (!isRecord(calendar) || typeof calendar.name !== 'string' || !calendar.name.trim()) return false
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

    const parsed = parseTimeline(timeline)
    if (id.trim() && parsed) {
      entries.push({ id, timeline: parsed })
    } else {
      skipped += 1
    }
  }

  return { entries, skipped }
}

export function deleteTimeline(
  id: string,
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
): void {
  if (!id.trim()) throw new Error('Для удаления нужен идентификатор таймлайна.')

  storage.removeItem(keyPrefix + id)
}

const selectionKey = 'arena-atlas:selection:v1'

type TimelineSelection = { id: string; calendarIndex: number }

export function restoreSelection(
  entries: readonly SavedTimeline[],
  storage?: Pick<Storage, 'getItem'>,
): TimelineSelection {
  const fallback = { id: entries[0]?.id ?? '', calendarIndex: 0 }

  try {
    const json = (storage ?? window.localStorage).getItem(selectionKey)
    if (json === null) return fallback

    const selection: unknown = JSON.parse(json)
    if (!isRecord(selection)) return fallback

    const entry = entries.find(({ id }) => id === selection.id)
    if (!entry) return fallback

    const index = selection.calendarIndex
    const calendarIndex = typeof index === 'number' && Number.isInteger(index) &&
      index >= 0 && index < entry.timeline.calendars.length ? index : 0

    return { id: entry.id, calendarIndex }
  } catch {
    return fallback
  }
}

export function rememberSelection(
  selection: TimelineSelection,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(selectionKey, JSON.stringify(selection))
  } catch {
    // Выбор в открытой вкладке работает и при недоступном хранилище.
  }
}

export function exportTimeline(timeline: Timeline): string {
  return JSON.stringify({ version: 1, timeline }, null, 2)
}

export function importTimeline(json: string): Timeline {
  const backup: unknown = JSON.parse(json)
  const timeline = isRecord(backup) && backup.version === 1 ? parseTimeline(backup.timeline) : null
  if (!timeline) throw new Error('Файл не содержит корректной копии таймлайна.')
  return timeline
}
