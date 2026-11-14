import { useEffect, useState } from 'react'
import App from './App'

const pages = [
  { id: 'timeline', title: 'Таймлайн' },
  { id: 'characters', title: 'Персонажи' },
  { id: 'events', title: 'События' },
  { id: 'organizations', title: 'Фракции и организации' },
  { id: 'chronicles', title: 'Летописи' },
  { id: 'items', title: 'Предметы' },
  { id: 'locations', title: 'Локации' },
] as const

function currentPage() {
  const [path, query] = window.location.hash.slice(1).split('?')
  const page = pages.find(({ id }) => path === id) ?? pages[0]
  const params = new URLSearchParams(query)
  const rawYear = params.get('year')
  const year = rawYear && /^-?\d+$/.test(rawYear) ? Number(rawYear) : undefined

  return {
    ...page,
    entryId: params.get('entry') ?? undefined,
    organizationId: page.id === 'organizations' ? params.get('organization') ?? undefined : undefined,
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

      {page.id === 'locations' ? (
        <main className="section-page">
          <h1>Локации</h1>
          <p>Локации пока не добавлены.</p>
          <a href="#timeline">К таймлайну</a>
        </main>
      ) : (
        <App page={page.id} eventYear={page.year} eventId={page.eventId} characterId={page.characterId}
          organizationId={page.organizationId} entryId={page.entryId} />
      )}
    </>
  )
}
