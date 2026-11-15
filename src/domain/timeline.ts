import type { WorldLore } from './lore.ts'
import type { CalendarMonth } from './calendar'
import type { CalendarEra } from './calendarYear'

export type EntryStatus = 'draft' | 'canon'
export type GalleryImage = { image: string; caption: string }
export type EntryMetadata = { status?: EntryStatus; gallery?: GalleryImage[] }

export type Timeline = {
  lore?: WorldLore
  name: string
  startYear: number
  endYear: number
  daysPerYear: number
  events?: TimelineEvent[]
  characters?: TimelineCharacter[]
  organizations?: Organization[]
  chronicles?: ArchiveEntry[]
  items?: ArchiveEntry[]
  locations?: ArchiveEntry[]
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

export type TimelineEvent = EntryMetadata & {
  color?: string
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

export type CharacterDate = { year: number; dayOfYear: number }

export function isCharacterDate(value: unknown, daysPerYear: number): value is CharacterDate {
  if (typeof value !== 'object' || value === null) return false
  const { year, dayOfYear } = value as Partial<CharacterDate>
  return Number.isSafeInteger(year) && typeof dayOfYear === 'number' &&
    Number.isSafeInteger(dayOfYear) && dayOfYear >= 1 && dayOfYear <= daysPerYear
}

export function isCharacterLifeOrderValid(birth?: CharacterDate, death?: CharacterDate): boolean {
  return !birth || !death || birth.year < death.year ||
    (birth.year === death.year && birth.dayOfYear <= death.dayOfYear)
}

export type TimelineCharacter = EntryMetadata & {
  parentIds?: string[]
  dynasty?: string
  characterClass?: string
  surname?: string
  race?: string
  sex?: string
  birth?: CharacterDate
  death?: CharacterDate
  portrait?: string
  color?: string
  biography?: string
  id: string
  name: string
  description: string
}

export type EventSide = {
  organizationId?: string
  id: string
  name: string
  characterIds: string[]
}

export const defaultOrganizationColor = '#805423'

export type Organization = EntryMetadata & {
  color?: string
  description?: string
  locationIds?: string[]
  onTimeline?: boolean
  emblem?: string
  id: string
  name: string
  type: string
  startYear: number
  endYear?: number
  memberIds: string[]
}

export function isAtlasColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export function validateOrganization(organization: Organization, timeline: Timeline): string | null {
  if (organization.color !== undefined && !isAtlasColor(organization.color)) return 'Выберите допустимый цвет организации.'
  if (!organization.name.trim() || !organization.type.trim()) return 'Укажите название и тип организации.'
  if (!Number.isSafeInteger(organization.startYear) || organization.startYear < timeline.startYear ||
      organization.startYear > timeline.endYear || (organization.endYear !== undefined &&
      (!Number.isSafeInteger(organization.endYear) || organization.endYear > timeline.endYear ||
      organization.endYear < organization.startYear))) {
    return 'Укажите годы в пределах таймлайна. Окончание должно быть не раньше основания.'
  }
  const ids = new Set(timeline.characters?.map(({ id }) => id))
  if (new Set(organization.memberIds).size !== organization.memberIds.length ||
      organization.memberIds.some((id) => !ids.has(id))) return 'Проверьте список членов организации.'
  return null
}

export type ArchiveEntry = EntryMetadata & {
  chronicleIds?: string[]
  image?: string
  eventIds?: string[]
  characterIds?: string[]
  ownerId?: string
  id: string
  title: string
  summary: string
  body: string
  type?: string
  rarity?: string
}
