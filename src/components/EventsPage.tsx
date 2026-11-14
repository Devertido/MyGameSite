import { useState, type FormEvent } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar, TimelineEvent } from '../domain/timeline'
import { validateEvent } from '../domain/timeline'

export function EventsPage({ timeline, calendar, save, yearFilter }: {
  timeline: Timeline
  calendar: TimelineCalendar
  yearFilter?: number
  save: (events: TimelineEvent[]) => void
}) {
  const events = timeline.events ?? []
  const [draft, setDraft] = useState<TimelineEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineEvent | null>(null)
  const [error, setError] = useState('')
  const characters = timeline.characters ?? []
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = search.trim().toLocaleLowerCase('ru')
  const original = draft === 'new' ? null : draft
  const sorted = events
    .filter(({ year }) => yearFilter === undefined || year === yearFilter)
    .filter(({ title, description }) => [title, description].some((text) => text.toLocaleLowerCase('ru').includes(query)))
    .filter(({ year }) => (!from || year >= Number(from)) && (!to || year <= Number(to)))
    .sort((left, right) => left.year - right.year)
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
    const issue = validateEvent({ year, title, description }, timeline)
    if (issue) {
      setError(issue)
      return
    }

    const characterIds = fields.getAll('characterIds').map(String)
    const entry = { id: original?.id ?? crypto.randomUUID(), year, title, description, characterIds }
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
        <button type="button" onClick={() => setDraft('new')}>Добавить событие</button>
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
              <h2>{entry.year} · {entry.title}</h2>
              <p>{calendar.name} · местный год {String(toCalendarYear(entry.year, calendar.era))}</p>
              {entry.characterIds && entry.characterIds.length > 0 && (
                <p>Участники: {characters.filter(({ id }) => entry.characterIds?.includes(id)).map(({ name }) => name).join(', ')}</p>
              )}
              {entry.description && <p>{entry.description}</p>}
              <button type="button" disabled={draft !== null || deleting !== null} onClick={() => setDraft(entry)}>
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
