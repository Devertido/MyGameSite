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

export type WorldLore = {
  surnames: string[]
  races: string[]
  dynasties: string[]
  cultures: Tradition[]
  faiths: Tradition[]
  reigns: Reign[]
}

export const emptyLore: WorldLore = {
  surnames: [], races: [], dynasties: [], cultures: [], faiths: [], reigns: [],
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
  const targets = new Map(linkKinds.map((kind) => [kind, new Set(loreTargets(timeline, kind).map(({ id }) => id))]))
  const known = (kind: LinkKind, id: unknown) => typeof id === 'string' && targets.get(kind)?.has(id)
  function records(items: unknown, valid: (item: Record<string, unknown>) => unknown) {
    return Array.isArray(items) && items.every((item) =>
      record(item) && typeof item.id === 'string' && item.id.trim() && valid(item),
    ) && new Set(items.map((item) => item.id)).size === items.length
  }
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
