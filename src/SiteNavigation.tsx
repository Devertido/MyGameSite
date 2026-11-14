import { useEffect, useState } from 'react'
import App from './App'

const pages = [
  { id: 'timeline', title: 'Таймлайн' },
  { id: 'characters', title: 'Персонажи' },
  { id: 'events', title: 'События' },
] as const

function currentPage() {
  return pages.find(({ id }) => window.location.hash === '#' + id) ?? pages[0]
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

      <div hidden={page.id !== 'timeline'}>
        <App />
      </div>
      {page.id !== 'timeline' && (
        <main className="section-page">
          <h1>{page.title}</h1>
          <p>{page.id === 'characters' ? 'Здесь пока нет персонажей.' : 'Здесь пока нет событий.'}</p>
        </main>
      )}
    </>
  )
}
