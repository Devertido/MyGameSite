import { useEffect, useState } from 'react'
import App from './App'

const pages = [
  { id: 'timeline', title: 'Таймлайн' },
  { id: 'characters', title: 'Персонажи' },
  { id: 'events', title: 'События' },
  { id: 'organizations', title: 'Фракции и организации' },
] as const

function currentPage() {
  const [path, query] = window.location.hash.slice(1).split('?')
  const page = pages.find(({ id }) => path === id) ?? pages[0]
  const params = new URLSearchParams(query)
  const rawYear = params.get('year')
  const year = rawYear && /^-?\d+$/.test(rawYear) ? Number(rawYear) : undefined

  return {
    ...page,
    characterId: page.id === 'characters' ? params.get('character') ?? undefined : undefined,
    eventId: page.id === 'events' ? params.get('event') ?? undefined : undefined,
    year: page.id === 'events' && Number.isSafeInteger(year) ? year : undefined,
  }
}

export default function SiteNavigation() {
  const [page, setPage] = useState(currentPage)

  useEffect(() => {
    function updatePage() {
      setPage(currentPage())
    }

    window.addEventListener('hashchange', updatePage)
    return () => window.removeEventListener('hashchange', updatePage)
  }, [])

  return (
    <>
      <header className="site-header">
        <nav aria-label="Разделы Атласа">
          {pages.map(({ id, title }) => (
            <a key={id} href={'#' + id} aria-current={page.id === id ? 'page' : undefined}>
              {title}
            </a>
          ))}
        </nav>
      </header>

      <App page={page.id} eventYear={page.year} eventId={page.eventId} characterId={page.characterId} />
    </>
  )
}
