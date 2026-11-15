import type { TimelineCharacter } from './timeline.ts'

export function sameHouse(left: string | undefined, right: string): boolean {
  return left?.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru')
}

export function houseGenerations(characters: readonly TimelineCharacter[], house: string) {
  const members = characters.filter(({ dynasty }) => sameHouse(dynasty, house))
  const membersById = new Set(members.map(({ id }) => id))
  const parentIds = new Set(members.flatMap(({ parentIds }) => parentIds ?? []))
  const people = characters.filter(({ id }) => membersById.has(id) || parentIds.has(id))
  const included = new Set(people.map(({ id }) => id))
  const linkedParents = new Map(people.map(({ id, parentIds }) => [
    id, (parentIds ?? []).filter((parent) => included.has(parent)),
  ]))
  const remaining = new Map(people.map(({ id }) => [id, linkedParents.get(id)!.length]))
  const children = new Map<string, TimelineCharacter[]>()
  for (const person of people) {
    for (const parent of linkedParents.get(person.id)!) {
      const descendants = children.get(parent) ?? []
      descendants.push(person)
      children.set(parent, descendants)
    }
  }

  const ready = people.filter(({ id }) => remaining.get(id) === 0)
  const generations: TimelineCharacter[][] = []
  const ranks = new Map<string, number>()
  for (let index = 0; index < ready.length; index++) {
    const person = ready[index]!
    const rank = ranks.get(person.id) ?? 0
    const generation = generations[rank] ??= []
    generation.push(person)
    for (const child of children.get(person.id) ?? []) {
      ranks.set(child.id, Math.max(ranks.get(child.id) ?? 0, rank + 1))
      const pending = remaining.get(child.id)! - 1
      remaining.set(child.id, pending)
      if (pending === 0) ready.push(child)
    }
  }
  return { generations, linkedParents, membersById }
}
