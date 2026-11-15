import { validFamily } from './lore.ts'
import type { TimelineCharacter } from './timeline.ts'

export type HouseRelationship = 'parent' | 'child' | 'spouse'

export function sameHouse(left: string | undefined, right: string): boolean {
  return left?.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru')
}

function oppositeSex(left?: string, right?: string): boolean {
  return (left === 'Муж' && right === 'Жен') || (left === 'Жен' && right === 'Муж')
}

export function validSpouses(characters: readonly TimelineCharacter[]): boolean {
  const byId = new Map(characters.map((person) => [person.id, person]))
  return characters.every((person) => {
    if (person.spouseId === undefined) return true
    const spouse = byId.get(person.spouseId)
    return spouse?.spouseId === person.id && oppositeSex(person.sex, spouse.sex)
  })
}

export function addHouseRelationship(characters: TimelineCharacter[], person: TimelineCharacter, relative: TimelineCharacter, relation: HouseRelationship) {
  if (person.id === relative.id) return null
  if (relation === 'spouse') {
    if (person.spouseId || relative.spouseId || !oppositeSex(person.sex, relative.sex)) return null
    const next = characters.map((entry) => {
      if (entry.id === person.id) return { ...entry, spouseId: relative.id }
      if (entry.id === relative.id) return { ...entry, spouseId: person.id }
      return entry
    })
    // A couple shares a generation, so collapsing spouses must preserve the ancestry order.
    return generationRows(next, true) ? next : null
  }
  const [parent, child] = relation === 'parent' ? [relative, person] : [person, relative]
  if (child.parentIds?.includes(parent.id)) return null
  const next = characters.map((entry) => entry.id === child.id
    ? { ...entry, parentIds: [...(entry.parentIds ?? []), parent.id] }
    : entry)
  return validFamily(next) && generationRows(next, true) ? next : null
}

export function removeHouseRelationship(
  characters: TimelineCharacter[], firstId: string, secondId: string, relation: 'child' | 'spouse',
): TimelineCharacter[] {
  return characters.map((person) => {
    if (relation === 'child' && person.id === secondId && person.parentIds?.includes(firstId)) {
      return { ...person, parentIds: person.parentIds.filter((id) => id !== firstId) }
    }
    if (relation === 'spouse' && ((person.id === firstId && person.spouseId === secondId) ||
      (person.id === secondId && person.spouseId === firstId))) {
      return { ...person, spouseId: undefined }
    }
    return person
  })
}

function generationRows(people: TimelineCharacter[], groupSpouses: boolean) {
  const groups = new Map<string, TimelineCharacter[]>()
  const groupIds = new Map(people.map(({ id, spouseId }) => [id, groupSpouses && spouseId && spouseId < id ? spouseId : id]))
  for (const person of people) {
    const id = groupIds.get(person.id)!
    const group = groups.get(id) ?? []
    group.push(person)
    groups.set(id, group)
  }

  const children = new Map<string, string[]>()
  const pending = new Map<string, number>()
  for (const [id, group] of groups) {
    const parents = new Set(group.flatMap(({ parentIds }) => parentIds ?? []).map((parent) => groupIds.get(parent)))
    parents.delete(undefined)
    pending.set(id, parents.size)
    for (const parent of parents) {
      const descendants = children.get(parent!) ?? []
      descendants.push(id)
      children.set(parent!, descendants)
    }
  }

  const ready = [...groups.keys()].filter((id) => pending.get(id) === 0)
  const rows: TimelineCharacter[][] = []
  const ranks = new Map<string, number>()
  for (let index = 0; index < ready.length; index++) {
    const id = ready[index]!
    const rank = ranks.get(id) ?? 0
    const row = rows[rank] ??= []
    row.push(...groups.get(id)!)
    for (const child of children.get(id) ?? []) {
      ranks.set(child, Math.max(ranks.get(child) ?? 0, rank + 1))
      const count = pending.get(child)! - 1
      pending.set(child, count)
      if (count === 0) ready.push(child)
    }
  }
  return ready.length === groups.size ? rows : null
}

export function houseGenerations(characters: readonly TimelineCharacter[], house: string) {
  const membersById = new Set(characters.filter(({ dynasty }) => sameHouse(dynasty, house)).map(({ id }) => id))
  const included = new Set(membersById)
  const neighbors = new Map(characters.map(({ id }) => [id, new Set<string>()]))
  for (const { id, parentIds, spouseId } of characters) {
    for (const relative of [...(parentIds ?? []), ...(spouseId ? [spouseId] : [])]) {
      neighbors.get(id)?.add(relative)
      neighbors.get(relative)?.add(id)
    }
  }
  for (const id of included) {
    for (const relative of neighbors.get(id) ?? []) included.add(relative)
  }
  const people = characters.filter(({ id }) => included.has(id))
  const linkedParents = new Map(people.map(({ id, parentIds }) => [
    id, (parentIds ?? []).filter((parent) => included.has(parent)),
  ]))
  const generations = generationRows(people, true) ?? generationRows(people, false) ?? []
  return { generations, linkedParents, membersById }
}
