import { parseDamageFormula } from './itemDamage.ts'
import { t } from '../i18n.ts'
import { validAbilityScores, type AbilityScores } from './abilities.ts'
import type { Timeline } from './timeline.ts'

export type Tradition = {
  id: string
  name: string
  fields: string[]
  links: { kind: LinkKind; id: string }[]
}

export type LinkKind = 'characters' | 'locations' | 'organizations' | 'events'

export type Reign = {
  id: string
  title: string
  characterId: string
  organizationId: string
  start: number
  end: number | null
  accession: string
}

export type GlossarySection = 'surnames' | 'races' | 'dynasties' | 'classes' | 'spells'

export function isGlossarySection(value: unknown): value is GlossarySection {
  return value === 'surnames' || value === 'races' || value === 'dynasties' || value === 'classes' || value === 'spells'
}

export const spellComponents = ['Слово', 'Реагент', 'Жест'] as const
export type SpellComponent = typeof spellComponents[number]
export const spellTimeUnits = [
  ['second', 'сек.'], ['minute', 'мин.'], ['hour', 'ч.'], ['day', 'дн.'],
] as const
export type SpellDuration = { amount: number; unit: typeof spellTimeUnits[number][0] }
export type SpellDetails = {
  name: string
  image: string
  mana: number | null
  components: SpellComponent[]
  school?: string
  damageFormula?: string
  castingTime?: SpellDuration
  cooldown?: SpellDuration
}

export function validSpellDuration(value: unknown): value is SpellDuration {
  return record(value) && typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    value.amount >= 0 && spellTimeUnits.some(([unit]) => unit === value.unit)
}

export function formatSpellDuration(duration: SpellDuration) {
  const label = spellTimeUnits.find(([unit]) => unit === duration.unit)![1]
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 15 }).format(duration.amount) + ' ' + t(label)
}
export type RaceMeasure = 'lifespan' | 'height'

export function parseRaceMeasure(value: string, measure: RaceMeasure): string[] | null {
  if (!value.trim()) return []
  const parts = value.trim().toLowerCase().split(/\s*[-–—]\s*/)
  if (parts.length > 2) return null
  const numbers = parts.map((part) => part.match(/^(\d+(?:[.,]\d+)?)\s*(лет|год(?:а|ов)?|см|м|years?|cm|m)?$/u))
  const lastUnit = numbers.at(-1)?.[2]
  const parsed = numbers.map((match) => {
    if (!match) return NaN
    const unit = match[2] ?? lastUnit ?? ''
    const amount = Number(match[1]!.replace(',', '.'))
    if (measure === 'lifespan') return /^(?:лет|год(?:а|ов)?|years?)?$/.test(unit) ? amount : NaN
    if (unit === 'м' || unit === 'm') return Math.round(amount * 100)
    return /^(?:см|cm)?$/.test(unit) ? amount : NaN
  })
  return parsed.every((amount) => Number.isSafeInteger(amount) && amount >= 0) ? parsed.map(String) : null
}

export function readRaceMeasure(data: FormData, measure: RaceMeasure, previous = ''): string | null {
  const min = String(data.get(measure) ?? '').trim()
  const max = String(data.get(measure + '-max') ?? '').trim()
  if (!min && !max) return parseRaceMeasure(previous, measure) === null ? previous : ''
  if (!/^\d+$/.test(min) || (max && !/^\d+$/.test(max))) return null
  const start = Number(min)
  const end = max ? Number(max) : start
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null
  return start === end ? String(start) : start + '–' + end
}

export type RaceDetails = { name: string; image: string; lifespan: string; height: string; size: string; bonuses: string; debuffs: string;
  abilityBonuses?: AbilityScores; abilityPenalties?: AbilityScores
}

export const surnameOrigins = ['', 'От места', 'От рода', 'От ремесла', 'От прозвища', 'Пожалованная', 'Другое'] as const
export type SurnameDetails = {
  name: string
  origin: typeof surnameOrigins[number]
  locationId?: string
  dynasty?: string
  usage: string
}

export const beastCombatFields = [
  ['armor', 'Класс доспеха'], ['hitPoints', 'Хиты'], ['speed', 'Скорость'], ['challenge', 'Опасность'], ['level', 'Уровень'],
  ['traits', 'Особенности'], ['actions', 'Действия'],
] as const

export type BeastCombat = Partial<Record<typeof beastCombatFields[number][0], string>>

export type Beast = {
  combat?: BeastCombat
  id: string
  name: string
  type: string
  description: string
  image: string
  abilities: AbilityScores
}

export type HouseDetails = { name: string; startYear?: number; endYear?: number; locationIds: string[] }

export function validHouseYears(startYear?: number, endYear?: number) {
  return (startYear === undefined || Number.isSafeInteger(startYear)) &&
    (endYear === undefined || Number.isSafeInteger(endYear)) &&
    (startYear === undefined || endYear === undefined || startYear <= endYear)
}

export const maxClassLevel = 20

export function validClassLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxClassLevel
}
export type ClassLevel = { level: number; skills: string; abilities: string; spells: string[] }
export type ClassProgression = { name: string; levels: ClassLevel[] }

export type WorldLore = {
  classProgression?: ClassProgression[]
  bestiary?: Beast[]
  surnameDetails?: SurnameDetails[]
  houseDetails?: HouseDetails[]
  spellDetails?: SpellDetails[]
  raceDetails?: RaceDetails[]
  descriptions?: { section: GlossarySection; name: string; text: string }[]
  surnames: string[]
  races: string[]
  dynasties: string[]
  classes?: string[]
  spells?: string[]
  cultures: Tradition[]
  faiths: Tradition[]
  reigns: Reign[]
}

export const emptyLore: WorldLore = {
  surnames: [], races: [], dynasties: [], cultures: [], faiths: [], reigns: [],
}

export function glossaryDescription(lore: WorldLore | undefined, section: GlossarySection, name?: string) {
  if (!name) return undefined
  const key = name.trim().toLocaleLowerCase('ru')
  return lore?.descriptions?.find((entry) =>
    entry.section === section && entry.name.toLocaleLowerCase('ru') === key)?.text
}

export function surnameTooltip(timeline: Timeline, name?: string) {
  const lore = timeline.lore
  const key = name?.trim().toLocaleLowerCase('ru')
  const details = lore?.surnameDetails?.find((entry) => entry.name.toLocaleLowerCase('ru') === key)
  const location = timeline.locations?.find(({ id }) => id === details?.locationId)
  return [
    glossaryDescription(lore, 'surnames', name),
    details?.origin && t('Происхождение · ') + t(details.origin),
    location && t('Локация · ') + location.title,
    details?.dynasty && t('Род · ') + details.dynasty,
    details?.usage,
  ].filter(Boolean).join('\n') || undefined
}

export const linkKinds: LinkKind[] = ['characters', 'locations', 'organizations', 'events']

export function loreTargets(timeline: Timeline, kind: LinkKind) {
  return (timeline[kind] ?? []).map((entry) => ({
    id: entry.id,
    name: 'name' in entry ? entry.name : entry.title,
  }))
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function validLore(value: unknown, timeline: Timeline): value is WorldLore {
  if (!record(value)) return false
  if (![value.races, value.surnames, value.dynasties].every(strings)) return false
  if (value.descriptions !== undefined && (!Array.isArray(value.descriptions) ||
      !value.descriptions.every((entry: unknown) => record(entry) && isGlossarySection(entry.section) &&
        typeof entry.name === 'string' && typeof entry.text === 'string' &&
        (value[entry.section] as string[] | undefined)?.includes(entry.name)))) return false
  if ([value.classes, value.spells].some((items) => items !== undefined && !strings(items))) return false
  const locations = new Set(timeline.locations?.map(({ id }) => id))
  const names = value.surnames as string[]
  const dynasties = value.dynasties as string[]
  if (value.houseDetails !== undefined && (!Array.isArray(value.houseDetails) ||
      !value.houseDetails.every((entry) => record(entry) && typeof entry.name === 'string' && dynasties.includes(entry.name) &&
        (entry.startYear === undefined || typeof entry.startYear === 'number') &&
        (entry.endYear === undefined || typeof entry.endYear === 'number') &&
        validHouseYears(entry.startYear, entry.endYear) &&
        strings(entry.locationIds) && new Set(entry.locationIds).size === entry.locationIds.length &&
        entry.locationIds.every((id) => locations.has(id))) ||
      new Set(value.houseDetails.map(({ name }) => name)).size !== value.houseDetails.length)) return false
  if (value.surnameDetails !== undefined && (!Array.isArray(value.surnameDetails) ||
      !value.surnameDetails.every((entry: unknown) => record(entry) &&
        typeof entry.name === 'string' && names.includes(entry.name) &&
        surnameOrigins.some((origin) => origin === entry.origin) &&
        typeof entry.usage === 'string' &&
        (entry.locationId === undefined || (typeof entry.locationId === 'string' && locations.has(entry.locationId))) &&
        (entry.dynasty === undefined || (typeof entry.dynasty === 'string' && dynasties.includes(entry.dynasty)))) ||
      new Set(value.surnameDetails.map(({ name }) => name)).size !== value.surnameDetails.length)) return false
  function validDetails(items: unknown, names: unknown, valid: (entry: Record<string, unknown>) => boolean) {
    return items === undefined || (Array.isArray(items) && strings(names) &&
      items.every((entry) => record(entry) && typeof entry.name === 'string' && names.includes(entry.name) &&
        typeof entry.image === 'string' && (entry.image === '' || (entry.image.length <= 900_000 &&
          /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(entry.image))) && valid(entry)) &&
      new Set(items.map((entry) => entry.name)).size === items.length)
  }
  if (value.classProgression !== undefined) {
    const classNames = new Set(strings(value.classes) ? value.classes : [])
    const spellNames = new Set(strings(value.spells) ? value.spells : [])
    if (!Array.isArray(value.classProgression) || !value.classProgression.every((entry) => record(entry) &&
        typeof entry.name === 'string' && classNames.has(entry.name) && Array.isArray(entry.levels) &&
        entry.levels.length <= maxClassLevel && entry.levels.every((level) => record(level) &&
          validClassLevel(level.level) &&
          typeof level.skills === 'string' && level.skills.length <= 4000 &&
          typeof level.abilities === 'string' && level.abilities.length <= 4000 &&
          strings(level.spells) && new Set(level.spells).size === level.spells.length &&
          level.spells.every((spell) => spellNames.has(spell))) &&
        new Set(entry.levels.map(({ level }) => level)).size === entry.levels.length) ||
        new Set(value.classProgression.map(({ name }) => name)).size !== value.classProgression.length) return false
  }
  if (!validDetails(value.spellDetails, value.spells, (entry) =>
    (entry.school === undefined || (typeof entry.school === 'string' && entry.school.length <= 120)) &&
    (entry.damageFormula === undefined || (typeof entry.damageFormula === 'string' && Boolean(parseDamageFormula(entry.damageFormula)))) &&
    (entry.castingTime === undefined || validSpellDuration(entry.castingTime)) &&
    (entry.cooldown === undefined || validSpellDuration(entry.cooldown)) &&
    (entry.mana === null || (typeof entry.mana === 'number' && Number.isSafeInteger(entry.mana) && entry.mana >= 0)) &&
    strings(entry.components) && entry.components.every((component) => spellComponents.some((item) => item === component)) &&
    new Set(entry.components).size === entry.components.length)) return false
  if (!validDetails(value.raceDetails, value.races, (entry) =>
    [entry.lifespan, entry.height, entry.size, entry.bonuses, entry.debuffs].every((item) => typeof item === 'string') &&
    [entry.abilityBonuses, entry.abilityPenalties].every((scores) => scores === undefined || validAbilityScores(scores)))) return false
  const targets = new Map(linkKinds.map((kind) => [kind, new Set(loreTargets(timeline, kind).map(({ id }) => id))]))
  const known = (kind: LinkKind, id: unknown) => typeof id === 'string' && targets.get(kind)?.has(id)
  function records(items: unknown, valid: (item: Record<string, unknown>) => unknown) {
    return Array.isArray(items) && items.every((item) =>
      record(item) && typeof item.id === 'string' && item.id.trim() && valid(item),
    ) && new Set(items.map((item) => item.id)).size === items.length
  }
  if (value.bestiary !== undefined && !records(value.bestiary, (item) =>
    typeof item.name === 'string' && item.name.trim() &&
    typeof item.type === 'string' && typeof item.description === 'string' &&
    typeof item.image === 'string' && (item.image === '' || (item.image.length <= 900_000 &&
      /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.image))) &&
    validAbilityScores(item.abilities) &&
    (item.combat === undefined || (record(item.combat) && Object.entries(item.combat).every(([key, value]) =>
      beastCombatFields.some(([field]) => field === key) && typeof value === 'string'))),
  )) return false
  return [value.cultures, value.faiths].every((items) => records(items, (item) =>
    typeof item.name === 'string' && item.name.trim() && strings(item.fields) && item.fields.length === 4 &&
    Array.isArray(item.links) && item.links.every((link) => record(link) &&
      linkKinds.includes(link.kind as LinkKind) && known(link.kind as LinkKind, link.id)),
  )) && records(value.reigns, (item) =>
    typeof item.title === 'string' && item.title.trim() && typeof item.accession === 'string' &&
    known('characters', item.characterId) && known('organizations', item.organizationId) &&
    typeof item.start === 'number' && Number.isSafeInteger(item.start) &&
    item.start >= timeline.startYear && item.start <= timeline.endYear &&
    (item.end === null || (typeof item.end === 'number' && Number.isSafeInteger(item.end) &&
      item.end >= item.start && item.end <= timeline.endYear)),
  )
}

export function removeMissingLoreLinks(timeline: Timeline): Timeline {
  if (!timeline.lore) return timeline
  const { lore } = timeline
  const ids = new Map(linkKinds.map((kind) => [kind, new Set(loreTargets(timeline, kind).map(({ id }) => id))]))
  const prune = (entries: Tradition[]) => entries.map((entry) => ({
    ...entry, links: entry.links.filter(({ kind, id }) => ids.get(kind)?.has(id)),
  }))
  return { ...timeline, lore: {
    ...lore,
    ...(lore.surnameDetails ? { surnameDetails: lore.surnameDetails.map((entry) =>
      entry.locationId && !ids.get('locations')?.has(entry.locationId) ? { ...entry, locationId: undefined } : entry) } : {}),
    ...(lore.houseDetails ? { houseDetails: lore.houseDetails.map((entry) => ({
      ...entry, locationIds: entry.locationIds.filter((id) => ids.get('locations')?.has(id)),
    })) } : {}),
    cultures: prune(lore.cultures),
    faiths: prune(lore.faiths),
    reigns: lore.reigns.filter(({ characterId, organizationId }) =>
      ids.get('characters')?.has(characterId) && ids.get('organizations')?.has(organizationId)),
  } }
}

export function validFamily(characters: NonNullable<Timeline['characters']>): boolean {
  const parentLists = new Map(characters.map(({ id, parentIds }) => [id, parentIds ?? []]))
  const childLists = new Map<string, string[]>()
  const remaining = new Map<string, number>()
  const roots: string[] = []
  for (const [child, parents] of parentLists) {
    if (new Set(parents).size !== parents.length) return false
    remaining.set(child, parents.length)
    if (!parents.length) roots.push(child)
    for (const parent of parents) {
      if (!parentLists.has(parent)) return false
      const children = childLists.get(parent) ?? []
      children.push(child)
      childLists.set(parent, children)
    }
  }
  // В графе без циклов обход от персонажей без родителей достигает каждого узла.
  for (let index = 0; index < roots.length; index++) {
    for (const child of childLists.get(roots[index]!) ?? []) {
      const count = remaining.get(child)! - 1
      remaining.set(child, count)
      if (count === 0) roots.push(child)
    }
  }
  return roots.length === characters.length
}

export function raceDetailsFor(lore: WorldLore | undefined, name?: string) {
  const key = name?.trim().toLocaleLowerCase('ru')
  return lore?.raceDetails?.find((race) => race.name.toLocaleLowerCase('ru') === key)
}
