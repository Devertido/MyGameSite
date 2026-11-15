import { setInterfaceLanguage, t, type Language } from './i18n.ts'
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
  { id: 'lore', title: 'Справочник' },
] as const

function currentPage() {
  const [path, query] = window.location.hash.slice(1).split('?')
  const archiveSection = path === 'items' || path === 'locations' ? path : undefined
  const page = pages.find(({ id }) => (archiveSection ? 'lore' : path) === id) ?? pages[0]
  const params = new URLSearchParams(query)
  const rawYear = params.get('year')
  const year = rawYear && /^-?\d+$/.test(rawYear) ? Number(rawYear) : undefined

  return {
    ...page,
    familyOpen: params.get('family') === '1',
    loreSection: archiveSection ?? params.get('section') ?? undefined,
    entryId: params.get('entry') ?? undefined,
    organizationId: page.id === 'organizations' ? params.get('organization') ?? undefined : undefined,
    characterId: page.id === 'characters' ? params.get('character') ?? undefined : undefined,
    eventId: page.id === 'events' ? params.get('event') ?? undefined : undefined,
    year: page.id === 'events' && Number.isSafeInteger(year) ? year : undefined,
  }
}

export default function SiteNavigation() {
  const [page, setPage] = useState(currentPage)
  const [language, setLanguage] = useState<Language>(() => {
    const preference = readPreference('language') === 'en' ? 'en' : 'ru'
    setInterfaceLanguage(preference)
    return preference
  })
  const [musicVisualEnabled, setMusicVisualEnabled] = useState(() => readPreference('music-animation') !== 'false')
  const [largeText, setLargeText] = useState(() => readPreference('large-text') === 'true')
  const languageDialog = useRef<HTMLDialogElement>(null)
  const [musicButtonTarget, setMusicButtonTarget] = useState<HTMLDivElement | null>(null)
  const [musicAnimationTarget, setMusicAnimationTarget] = useState<HTMLDivElement | null>(null)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const [backupTools, setBackupTools] = useState<HTMLDivElement | null>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const english = language === 'en'

  useEffect(() => {
    document.documentElement.lang = language
    document.title = english ? 'Arena Atlas' : 'Атлас Арены'
  }, [language, english])

  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const [fullscreenError, setFullscreenError] = useState(false)

  async function toggleFullscreen() {
    setFullscreenError(false)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      setFullscreenError(true)
    }
  }

  useEffect(() => {
    function syncFullscreen() {
      setFullscreen(Boolean(document.fullscreenElement))
      setFullscreenError(false)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const fullscreenLabel = fullscreen
    ? (english ? 'Exit fullscreen' : 'Выйти из полноэкранного режима')
    : (english ? 'Enter fullscreen' : 'На весь экран')


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

  function renderLinks(links: readonly (typeof pages)[number][]) {
    return links.map(({ id, title }) => (
      <a key={id} href={'#' + id} aria-current={page.id === id ? 'page' : undefined}>
        {english ? englishTitles[id] : title}
      </a>
    ))
  }

  return (
    <>
      <header className="site-header">
        <span className="site-version">
          <span>{english ? 'F11 — fullscreen' : 'F11 — на весь экран'}</span>
          <span lang="en">Version {version}</span>
        </span>
        <nav lang={language} aria-label={english ? "Atlas sections" : "Разделы Атласа"}>
          <div className="site-nav-group">
            {renderLinks(pages.slice(0, 3))}
          </div>
          <a className="site-brand" href="#timeline">{english ? 'Atlas' : 'Атлас'}</a>
          <div className="site-nav-group">
            {renderLinks(pages.slice(3))}
          </div>
        </nav>
        <div className="site-tools" lang={language}>
          <div className="site-backup-tools" ref={setBackupTools} />
          <div className="site-backup-tools" ref={setMusicButtonTarget} />
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
          <button className="site-fullscreen" type="button" aria-label={fullscreenLabel}
            title={fullscreenLabel} aria-pressed={fullscreen} disabled={!document.fullscreenEnabled}
            onClick={() => void toggleFullscreen()}>F11</button>
        </div>
        <div className="site-music-visual" ref={setMusicAnimationTarget} />
      </header>
      {fullscreenError && <p className="backup-status" role="status">
        {english ? 'Fullscreen is unavailable. Try pressing F11 in your browser.' : 'Полноэкранный режим недоступен. Попробуйте нажать F11 в браузере.'}
      </p>}

      <dialog ref={languageDialog} lang={language} aria-labelledby="atlas-language-title">
        <h2 id="atlas-language-title">{english ? 'Interface language' : 'Язык интерфейса'}</h2>
        <div className="language-picker" role="group" aria-label={english ? 'Language' : 'Язык'}>
          {([
            { code: 'ru', short: 'Ru', name: 'Русский' },
            { code: 'en', short: 'Eng', name: 'English' },
          ] as const).map(({ code, short, name }) => (
            <button key={code} type="button" aria-label={t(name)} aria-pressed={language === code}
              onClick={() => {
                setInterfaceLanguage(code)
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
        <p><label><input type="checkbox" checked={musicVisualEnabled} onChange={(event) => {
          const enabled = event.currentTarget.checked
          setMusicVisualEnabled(enabled)
          writePreference('music-animation', String(enabled))
        }} />{' '}{t('Показывать анимацию при воспроизведении музыки')}</label></p>
        <MusicSettings buttonTarget={musicButtonTarget} animationTarget={musicVisualEnabled ? musicAnimationTarget : null} english={english} initialVolume={readMusicVolume()}
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
