import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react'
import type { Timeline } from '../domain/timeline'
import { shortWikiDescription, wikiIndex, wikiParts } from '../domain/wikiLinks'

const WikiIndex = createContext({ index: wikiIndex(), descriptions: new Map<string, string>() })

export function WikiLinksProvider({ timeline, children }: { timeline?: Timeline; children: ReactNode }) {
  const wiki = useMemo(() => {
    const index = wikiIndex(timeline)
    const descriptions = new Map<string, string>()
    for (const entries of index.values()) {
      for (const entry of entries) {
        if (descriptions.has(entry.href)) continue
        const description = shortWikiDescription(entry.description)
        if (description) descriptions.set(entry.href, description)
      }
    }
    return { index, descriptions }
  }, [timeline])
  return <WikiIndex.Provider value={wiki}>{children}</WikiIndex.Provider>
}

export function EntryLink({ href, children }: { href: string; children: ReactNode }) {
  const { descriptions } = useContext(WikiIndex)
  return <a href={href} title={descriptions.get(href)}>{children}</a>
}

export function WikiText({ text }: { text?: string }) {
  const { index } = useContext(WikiIndex)
  if (!text?.includes('[[')) return <>{text}</>
  return <>{wikiParts(text, index).map((part, position) => part.href
    ? <a key={position} href={part.href} title={part.preview}>{part.text}</a>
    : <Fragment key={position}>{part.text}</Fragment>)}</>
}
