import { useState, type FormEvent } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar, TimelineEvent } from '../domain/timeline'
import { calendarDay, eventDays, validateEvent, type EventDays, type EventEndpoint } from '../domain/timeline'

export function EventsPage({ timeline, calendar, save, yearFilter }: {
  timeline: Timeline
  calendar: TimelineCalendar
  yearFilter?: number
  save: (events: TimelineEvent[]) => void
}) {
  const events = timeline.events ?? []
  const [draft, setDraft] = useState<TimelineEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineEvent | null>(null)
  const [period, setPeriod] = useState(false)
  const [error, setError] = useState('')
  const characters = timeline.characters ?? []
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = search.trim().toLocaleLowerCase('ru')
  const original = draft === 'new' ? null : draft
  const sorted = events
    .filter(({ year, end }) => yearFilter === undefined || (year <= yearFilter && (end?.year ?? year) >= yearFilter))
    .filter(({ title, description }) => [title, description].some((text) => text.toLocaleLowerCase('ru').includes(query)))
    .filter(({ year, end }) => (!from || (end?.year ?? year) >= Number(from)) && (!to || year <= Number(to)))
    .sort((left, right) => left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1))
  const initialYear = original?.year ??
    (yearFilter !== undefined && yearFilter >= timeline.startYear && yearFilter <= timeline.endYear
      ? yearFilter
      : undefined)

  function persist(next: TimelineEvent[]) {
    try {
      save(next)
      setDraft(null)
      setDeleting(null)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить изменения.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const year = Number(fields.get('year'))
    const title = String(fields.get('title') ?? '').trim()
    const description = String(fields.get('description') ?? '').trim()
    function readDays(prefix: string, previous?: EventDays) {
      const month = String(fields.get(prefix + 'Month') ?? '')
      const day = String(fields.get(prefix + 'Day') ?? '')
      if (!month) return day ? null : previous
      if (month === 'year') return undefined
      return eventDays(calendar.months, Number(month), day ? Number(day) : undefined)
    }

    const date = readDays('start', original?.date)
    const endDate = period ? readDays('end', original?.end?.date) : undefined
    if (date === null || endDate === null) {
      setError('Выберите месяц и укажите допустимый день или оставьте день пустым.')
      return
    }
    const end = period ? { year: Number(fields.get('endYear')), date: endDate } : undefined
    const details = { year, title, description, date, end }
    const issue = validateEvent(details, timeline)
    if (issue) {
      setError(issue)
      return
    }

    const characterIds = fields.getAll('characterIds').map(String)
    const entry = { id: original?.id ?? crypto.randomUUID(), ...details, characterIds, onTimeline: original ? original.onTimeline !== false : false }
    persist(original ? events.map((item) => item.id === original.id ? entry : item) : [...events, entry])
  }

  return (
    <main className="section-page">
      <h1>{yearFilter === undefined ? 'События' : `События за системный год ${yearFilter}`}</h1>
      {yearFilter !== undefined && <p><a href="#events">Все события</a></p>}
      <p>{timeline.name} · системные годы {timeline.startYear} — {timeline.endYear}</p>
      <fieldset className="catalog-filters">
        <legend>Фильтры событий</legend>
        <label>Поиск <input type="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} /></label>
        <label>С года <input type="number" value={from} onChange={(event) => setFrom(event.currentTarget.value)} /></label>
        <label>По год <input type="number" value={to} onChange={(event) => setTo(event.currentTarget.value)} /></label>
      </fieldset>
      {draft === null && deleting === null && (
        <button type="button" onClick={() => { setPeriod(false); setDraft('new') }}>Добавить событие</button>
      )}

      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать событие' : 'Новое событие'}</h2>
          <p><label>Название<br /><input name="title" defaultValue={original?.title} required /></label></p>
          <p>
            <label>
              Системный год<br />
              <input name="year" type="number" step={1} min={timeline.startYear}
                max={timeline.endYear} defaultValue={initialYear} required />
            </label>
          </p>
          <DateFields prefix="start" months={calendar.months} previous={original?.date} />
          <p><label><input type="checkbox" checked={period} onChange={(event) => setPeriod(event.currentTarget.checked)} /> Указать конец периода</label></p>
          {period && (
            <fieldset>
              <legend>Конец периода</legend>
              <p><label>Конечный системный год <input name="endYear" type="number" step={1}
                min={timeline.startYear} max={timeline.endYear} defaultValue={original?.end?.year ?? initialYear} required /></label></p>
              <DateFields prefix="end" months={calendar.months} previous={original?.end?.date} />
            </fieldset>
          )}
          <p><label>Описание<br /><textarea name="description" defaultValue={original?.description} rows={4} /></label></p>
          {characters.length > 0 && (
            <fieldset>
              <legend>Участники</legend>
              {characters.map((character) => (
                <label key={character.id} className="event-participant">
                  <input type="checkbox" name="characterIds" value={character.id}
                    defaultChecked={original?.characterIds?.includes(character.id)} />{' '}
                  {character.name}
                </label>
              ))}
            </fieldset>
          )}
          <button type="submit">Сохранить</button>{' '}
          <button type="button" onClick={() => { setDraft(null); setError('') }}>Отмена</button>
        </form>
      )}

      {deleting && (
        <section aria-labelledby="delete-event-heading">
          <h2 id="delete-event-heading">Удалить событие «{deleting.title}»?</h2>
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>Отмена</button>{' '}
          <button type="button" onClick={() => persist(events.filter(({ id }) => id !== deleting.id))}>Удалить</button>
        </section>
      )}

      {error && <p role="alert">{error}</p>}
      {sorted.length === 0 ? <p>{events.length ? 'События по этим условиям не найдены.' : 'В этом таймлайне пока нет событий.'}</p> : (
        <ul className="event-list">
          {sorted.map((entry) => (
            <li key={entry.id}>
              <h2>{entry.year}{entry.end && ` — ${entry.end.year}`} · {entry.title}</h2>
              <p>
                {calendar.name} · {formatEndpoint(entry, calendar)}
                {entry.end && ` → ${formatEndpoint(entry.end, calendar)}`}
              </p>
              {entry.characterIds && entry.characterIds.length > 0 && (
                <p>Участники: {characters.filter(({ id }) => entry.characterIds?.includes(id)).map(({ name }) => name).join(', ')}</p>
              )}
              {entry.description && <p>{entry.description}</p>}
              <button type="button" disabled={draft !== null || deleting !== null} onClick={() => { setPeriod(Boolean(entry.end)); setDraft(entry) }}>
                Редактировать
              </button>{' '}
              <button type="button" disabled={draft !== null || deleting !== null} onClick={() => setDeleting(entry)}>
                Удалить событие
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function formatEndpoint({ year, date }: EventEndpoint, calendar: TimelineCalendar) {
  const localYear = String(toCalendarYear(year, calendar.era))
  if (!date) return `местный год ${localYear}`
  const first = calendarDay(calendar.months, date.first)
  const days = date.first === date.last ? first : `${first} — ${calendarDay(calendar.months, date.last)}`
  return `${days}, местный год ${localYear}`
}

function DateFields({ prefix, months, previous }: {
  prefix: 'start' | 'end'
  months: TimelineCalendar['months']
  previous?: EventDays
}) {
  const [month, setMonth] = useState('')
  return (
    <p>
      <label>
        Месяц{' '}
        <select name={prefix + 'Month'} value={month} onChange={(event) => setMonth(event.currentTarget.value)}>
          <option value="">{previous ? 'Сохранить дату' : 'Весь год'}</option>
          {previous && <option value="year">Весь год</option>}
          {months.map(({ name }, index) => <option key={index} value={index + 1}>{name}</option>)}
        </select>
      </label>{' '}
      <label>
        День{' '}
        <input name={prefix + 'Day'} type="number" min={1} step={1}
          max={months[Number(month) - 1]?.days} disabled={!months[Number(month) - 1]} />
      </label>
    </p>
  )
}
