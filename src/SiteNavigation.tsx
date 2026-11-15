import { useEffect, useRef, useState } from 'react'
import { version } from '../package.json'
import App from './App'
import { MusicSettings } from './components/MusicSettings'

const pages = [
  { id: 'timeline', title: 'Таймлайн' },
  { id: 'characters', title: 'Персонажи' },
  { id: 'events', title: 'События' },
  { id: 'organizations', title: 'Фракции и организации' },
  { id: 'chronicles', title: 'Летописи' },
  { id: 'items', title: 'Предметы' },
  { id: 'locations', title: 'Локации' },
  { id: 'lore', title: 'Справочник' },
] as const

function currentPage() {
  const [path, query] = window.location.hash.slice(1).split('?')
  const page = pages.find(({ id }) => path === id) ?? pages[0]
  const params = new URLSearchParams(query)
  const rawYear = params.get('year')
  const year = rawYear && /^-?\d+$/.test(rawYear) ? Number(rawYear) : undefined

  return {
    ...page,
    familyOpen: params.get('family') === '1',
    loreSection: params.get('section') ?? undefined,
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
  const [backupTools, setBackupTools] = useState<HTMLDivElement | null>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
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
        <span className="site-version">{version}</span>
        <nav lang={language} aria-label={english ? "Atlas sections" : "Разделы Атласа"}>
          {pages.map(({ id, title }) => (
            <a key={id} href={'#' + id} aria-current={page.id === id ? 'page' : undefined}>
              {english ? englishTitles[id] : title}
            </a>
          ))}
        </nav>
        <div className="site-tools" lang={language}>
          <div className="site-backup-tools" ref={setBackupTools} />
          <button type="button" aria-label={english ? 'Help' : 'Справка'}
            title={english ? 'Help' : 'Справка'} onClick={() => helpDialog.current?.showModal()}>
            <span aria-hidden="true">?</span>
          </button>
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
        <div className="language-picker" role="group" aria-label={english ? 'Language' : 'Язык'}>
          {([
            { code: 'ru', short: 'Ru', name: 'Русский' },
            { code: 'en', short: 'Eng', name: 'English' },
          ] as const).map(({ code, short, name }) => (
            <button key={code} type="button" aria-label={name} lang={code} aria-pressed={language === code}
              onClick={() => {
                setLanguage(code)
                writePreference('language', code)
              }}>
              <span>{short}</span>
              <span className={'language-flag language-flag--' + code} aria-hidden="true" />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => languageDialog.current?.close()}>{english ? 'Close' : 'Закрыть'}</button>
      </dialog>

      <dialog ref={helpDialog} lang={language} aria-labelledby="atlas-help-title">
        <h2 id="atlas-help-title">{english ? 'Atlas help' : 'Справка по Атласу'}</h2>
        <ul>
          <li>{english
            ? 'Create or choose a timeline to open its events, characters, and other records.'
            : 'Создайте или выберите таймлайн, чтобы открыть его события, персонажей и другие записи.'}</li>
          <li>{english
            ? 'Create an event in Events, then use Add event on the timeline to place it on the scale.'
            : 'Создайте запись во вкладке «События», затем добавьте её на шкалу через кнопку «Добавить событие».'}</li>
          <li>{english
            ? 'Your data is stored in this browser. Use Export JSON to save a backup.'
            : 'Данные хранятся в этом браузере. Для резервной копии используйте «Экспорт JSON».'}</li>
        </ul>
        <button type="button" onClick={() => helpDialog.current?.close()}>{english ? 'Close' : 'Закрыть'}</button>
      </dialog>

      <dialog ref={settingsDialog} lang={language} aria-labelledby="atlas-settings-title">
        <h2 id="atlas-settings-title">{english ? 'Settings' : 'Настройки'}</h2>
        <p><label><input type="checkbox" checked={largeText} onChange={(event) => {
          const enabled = event.currentTarget.checked
          setLargeText(enabled)
          writePreference('large-text', String(enabled))
        }} />{' '}{english ? 'Larger text' : 'Увеличенный текст'}</label></p>
        <MusicSettings english={english} initialVolume={readMusicVolume()}
          rememberVolume={(volume) => writePreference('music-volume', String(volume))} />
        <button type="button" onClick={() => settingsDialog.current?.close()}>{english ? 'Close' : 'Закрыть'}</button>
      </dialog>

      <App backupTools={backupTools} english={english} page={page.id} eventYear={page.year} eventId={page.eventId} characterId={page.characterId}
        organizationId={page.organizationId} entryId={page.entryId} loreSection={page.loreSection} familyOpen={page.familyOpen} />
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
  lore: 'World reference',
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
function readMusicVolume() {
  const saved = readPreference('music-volume')
  const volume = saved === null ? NaN : Number(saved)
  return Number.isInteger(volume) && volume >= 0 && volume <= 100 ? volume : 5
}
