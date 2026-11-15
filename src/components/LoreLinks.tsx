import type { LinkKind } from '../domain/lore'
import type { Timeline } from '../domain/timeline'

export function LoreLinks({ timeline, kind, id }: { timeline: Timeline; kind: LinkKind; id: string }) {
  if (!timeline.lore) return null
  const cultures = timeline.lore.cultures.filter((entry) => entry.links.some((link) => link.kind === kind && link.id === id))
  const faiths = timeline.lore.faiths.filter((entry) => entry.links.some((link) => link.kind === kind && link.id === id))
  if (!cultures.length && !faiths.length) return null
  return (
    <section>
      {cultures.length > 0 && <p>Культуры · <a href="#lore?section=cultures">{cultures.map(({ name }) => name).join(', ')}</a></p>}
      {faiths.length > 0 && <p>Верования · <a href="#lore?section=faiths">{faiths.map(({ name }) => name).join(', ')}</a></p>}
    </section>
  )
}
