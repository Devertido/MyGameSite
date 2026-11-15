import type { ArchiveEntry } from '../domain/timeline.ts'

export type ObsidianNote = { path: string; title: string; body: string }
export type ObsidianLink = { source: string; target: string; label: string; index: number }

function normalized(path: string) {
  return path.replaceAll('\\', '/').replace(/\.md$/i, '').normalize('NFC').toLowerCase()
}

export function obsidianLinks(notes: ObsidianNote[]): ObsidianLink[] {
  return notes.flatMap((note) => {
    const folder = note.path.slice(0, note.path.lastIndexOf('/') + 1)
    return [...note.body.matchAll(/(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g)].flatMap((match) => {
      const name = match[1]?.trim() ?? ''
      const exact = notes.filter(({ path }) => normalized(path) === normalized(name))
      const local = notes.filter(({ path }) => normalized(path) === normalized(folder + name))
      const byName = notes.filter(({ path }) => normalized(path.split('/').at(-1) ?? '') === normalized(name))
      const candidates = exact.length ? exact : local.length ? local : byName
      const target = candidates.length === 1 ? candidates[0] : undefined
      if (!target || target.path === note.path) return []
      return [{ source: note.path, target: target.path, label: match[2]?.trim() || name, index: match.index }]
    })
  })
}

export function importObsidian(notes: ObsidianNote[], links: ObsidianLink[]): ArchiveEntry[] {
  const ids = new Map(notes.map(({ path }) => [path, crypto.randomUUID()]))
  return notes.map((note) => ({
    id: ids.get(note.path)!,
    title: note.title,
    summary: '',
    body: note.body,
    status: 'draft',
    chronicleIds: [...new Set(links.filter(({ source }) => source === note.path)
      .flatMap(({ target }) => {
        const id = ids.get(target)
        return id ? [id] : []
      }))],
  }))
}
