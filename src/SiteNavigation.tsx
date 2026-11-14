import { useEffect, useRef, useState } from 'react'
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
  const [language, setLanguage] = useState(() => readPreference('language') === 'en' ? 'en' : 'ru')
  const [largeText, setLargeText] = useState(() => readPreference('large-text') === 'true')
  const languageDialog = useRef<HTMLDialogElement>(null)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const english = language === 'en'

  useEffect(() => {
    document.documentElement.classList.toggle('atlas-large-text', largeText)
    return () => document.documentElement.classList.remove('atlas-large-text')
  }, [largeText])

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
        <nav lang={language} aria-label={english ? "Atlas sections" : "Разделы Атласа"}>
          {pages.map(({ id, title }) => (
            <a key={id} href={'#' + id} aria-current={page.id === id ? 'page' : undefined}>
              {english ? englishTitles[id] : title}
            </a>
          ))}
        </nav>
        <div className="site-tools" lang={language}>
          <button type="button" aria-label={english ? 'Language' : 'Язык'}
            title={english ? 'Language' : 'Язык'} onClick={() => languageDialog.current?.showModal()}>
            <span aria-hidden="true">🌐</span>
          </button>
          <button type="button" aria-label={english ? 'Settings' : 'Настройки'}
            title={english ? 'Settings' : 'Настройки'} onClick={() => settingsDialog.current?.showModal()}>
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <dialog ref={languageDialog} lang={language} aria-labelledby="atlas-language-title">
        <h2 id="atlas-language-title">{english ? 'Navigation language' : 'Язык навигации'}</h2>
        <p><label>{english ? 'Language' : 'Язык'}{' '}
          <select value={language} onChange={(event) => {
            const next = event.currentTarget.value === 'en' ? 'en' : 'ru'
            setLanguage(next)
            writePreference('language', next)
          }}>
            <option value="ru" lang="ru">Русский</option>
            <option value="en" lang="en">English</option>
          </select>
        </label></p>
        <button type="button" onClick={() => languageDialog.current?.close()}>{english ? 'Close' : 'Закрыть'}</button>
      </dialog>

      <dialog ref={settingsDialog} lang={language} aria-labelledby="atlas-settings-title">
        <h2 id="atlas-settings-title">{english ? 'Settings' : 'Настройки'}</h2>
        <p><label><input type="checkbox" checked={largeText} onChange={(event) => {
          const enabled = event.currentTarget.checked
          setLargeText(enabled)
          writePreference('large-text', String(enabled))
        }} />{' '}{english ? 'Larger text' : 'Увеличенный текст'}</label></p>
        <button type="button" onClick={() => settingsDialog.current?.close()}>{english ? 'Close' : 'Закрыть'}</button>
      </dialog>

      <App page={page.id} eventYear={page.year} eventId={page.eventId} characterId={page.characterId}
        organizationId={page.organizationId} entryId={page.entryId} />
    </>
  )
}

const englishTitles = {
  timeline: 'Timeline',
  characters: 'Characters',
  events: 'Events',
  organizations: 'Factions and organizations',
  chronicles: 'Chronicles',
  items: 'Items',
  locations: 'Locations',
}

function readPreference(key: string) {
  try {
    return localStorage.getItem('arena-atlas:ui:' + key)
  } catch {
    return null
  }
}

function writePreference(key: string, value: string) {
  try {
    localStorage.setItem('arena-atlas:ui:' + key, value)
  } catch {
    // Настройка действует в открытой вкладке.
  }
}