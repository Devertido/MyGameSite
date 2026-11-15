import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react'
import type { Timeline } from '../domain/timeline'
import { wikiIndex, wikiParts } from '../domain/wikiLinks'

const WikiIndex = createContext<ReturnType<typeof wikiIndex>>(new Map())

export function WikiLinksProvider({ timeline, children }: { timeline?: Timeline; children: ReactNode }) {
  const index = useMemo(() => wikiIndex(timeline), [timeline])
  return <WikiIndex.Provider value={index}>{children}</WikiIndex.Provider>
}

export function WikiText({ text }: { text?: string }) {
  const index = useContext(WikiIndex)
  if (!text?.includes('[[')) return <>{text}</>
  return <>{wikiParts(text, index).map((part, position) => part.href
    ? <a key={position} href={part.href} title={part.preview}>{part.text}</a>
    : <Fragment key={position}>{part.text}</Fragment>)}</>
}
