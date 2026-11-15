import { t } from '../i18n.ts'
import { glossaryDescription, type GlossarySection } from './lore.ts'
import type { Timeline } from './timeline.ts'

type WikiTarget = { name: string; href: string; section: string; description?: string }

const glossarySections = [
  ['surnames', 'Фамилии'], ['races', 'Расы'], ['dynasties', 'Род'],
  ['classes', 'Классы'], ['spells', 'Заклинания'], ['abilities', 'Способности'],
] as const satisfies readonly (readonly [GlossarySection, string])[]

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

const linkPattern = /\[\[([^[\]\r\n]+)\]\]/g

export function wikiIndex(timeline?: Timeline) {
  const targets = new Map<string, WikiTarget[]>()
  function add(target: WikiTarget, aliases: string[] = []) {
    for (const name of [target.name, ...aliases]) {
      for (const reference of [name, target.section + ': ' + name, t(target.section) + ': ' + name]) {
        const key = normalize(reference).replace(/\s*:\s*/g, ':')
        const entries = targets.get(key) ?? []
        if (!entries.some(({ href }) => href === target.href)) targets.set(key, [...entries, target])
      }
    }
  }
  if (!timeline) return targets
  for (const person of timeline.characters ?? []) {
    add({ name: [person.name, person.surname].filter(Boolean).join(' '), section: 'Персонажи',
      href: '#characters?character=' + encodeURIComponent(person.id), description: person.description || person.biography }, [person.name])
  }
  for (const event of timeline.events ?? []) {
    add({ name: event.title, section: 'События', href: '#events?event=' + encodeURIComponent(event.id),
      description: event.description || String(event.year) })
  }
  for (const organization of timeline.organizations ?? []) {
    add({ name: organization.name, section: 'Фракции и организации',
      href: '#organizations?organization=' + encodeURIComponent(organization.id), description: organization.description || organization.type })
  }
  for (const [kind, section] of [['chronicles', 'Летописи'], ['items', 'Предметы'], ['locations', 'Локации']] as const) {
    for (const entry of timeline[kind] ?? []) {
      const route = kind === 'chronicles' ? '#chronicles?entry=' : '#lore?section=' + kind + '&entry='
      add({ name: entry.title, section, href: route + encodeURIComponent(entry.id), description: entry.summary || entry.body || entry.type })
    }
  }
  const { lore } = timeline
  for (const [kind, section] of glossarySections) {
    for (const name of lore?.[kind] ?? []) {
      add({ name, section, href: '#lore?section=' + kind + '&entry=' + encodeURIComponent(name),
        description: glossaryDescription(lore, kind, name) })
    }
  }
  for (const [kind, section] of [['cultures', 'Культуры'], ['faiths', 'Верования'], ['bestiary', 'Бестиарий']] as const) {
    for (const entry of lore?.[kind] ?? []) {
      add({ name: entry.name, section, href: '#lore?section=' + kind + '&entry=' + encodeURIComponent(entry.id),
        description: 'description' in entry ? entry.description || entry.type : entry.fields.filter(Boolean).join(' · ') })
    }
  }
  return targets
}

export function wikiParts(text: string, index: ReturnType<typeof wikiIndex>) {
  const parts: { text: string; href?: string; preview?: string }[] = []
  let offset = 0
  for (const match of text.matchAll(linkPattern)) {
    const position = match.index ?? 0
    if (position > offset) parts.push({ text: text.slice(offset, position) })
    const [reference, alias] = match[1]!.split('|', 2).map((value) => value.trim())
    const candidates = index.get(normalize(reference ?? '').replace(/\s*:\s*/g, ':')) ?? []
    const exact = candidates.filter(({ name }) => normalize(name) === normalize(reference ?? ''))
    const target = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined
    if (target) {
      const blurb = target.description?.replace(linkPattern, (_, content: string) => content.split('|').at(-1)!.trim())
        .replace(/\s+/g, ' ').trim()
      parts.push({ text: alias || target.name, href: target.href,
        preview: blurb ? target.name + ' — ' + blurb.slice(0, 220) + (blurb.length > 220 ? '…' : '') : target.name + ' · ' + t(target.section) })
    } else parts.push({ text: match[0] })
    offset = position + match[0].length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) })
  return parts
}
