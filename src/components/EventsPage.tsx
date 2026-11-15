import { LoreLinks } from './LoreLinks'
import { CreationDialog } from './CreationDialog'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { useRef, useState, type FormEvent } from 'react'
import { EventSideLink } from './EventSideLink'
import { EventParticipants } from './EventParticipants'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar, TimelineCharacter, TimelineEvent } from '../domain/timeline'
import { calendarDay, eventDays, validateEvent, type EventDays, type EventEndpoint } from '../domain/timeline'

export function EventsPage({ timeline, calendar, save, yearFilter, eventId }: {
  timeline: Timeline
  calendar: TimelineCalendar
  yearFilter?: number
  eventId?: string
  save: (events: TimelineEvent[]) => void
}) {
  const characterDialog = useRef<HTMLDialogElement>(null)
  const [activeCharacter, setActiveCharacter] = useState<TimelineCharacter | null>(null)
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
    .filter(({ id }) => eventId === undefined || id === eventId)
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
    const details = { year, title, description, date, end, color: String(fields.get('color')) }
    const issue = validateEvent(details, timeline)
    if (issue) {
      setError(issue)
      return
    }

    const assignments = characters.map(({ id }) => ({ id, side: String(fields.get('participant-' + id) ?? '') }))
    const characterIds = assignments.filter(({ side }) => side).map(({ id }) => id)
    const sides = fields.getAll('sideId').map(String).map((id) => ({
      id,
      organizationId: timeline.organizations?.find((organization) =>
        organization.id === fields.get('side-organization-' + id)
      )?.id,
      name: String(fields.get('side-name-' + id) ?? '').trim(),
      characterIds: assignments.filter(({ side }) => side === id).map(({ id: characterId }) => characterId),
    }))
    if (sides.some(({ name }) => !name)) {
      setError('Введите название каждой стороны.')
      return
    }
    const entry = { id: original?.id ?? crypto.randomUUID(), ...details, characterIds, sides, onTimeline: original ? original.onTimeline !== false : false }
    persist(original ? events.map((item) => item.id === original.id ? entry : item) : [...events, entry])
  }

  function renderParticipants(ids: string[], unassigned = false) {
    const participants = characters.filter(({ id }) => ids.includes(id))
    if (!participants.length) return null

    return (
      <>
        {unassigned && <h3>Участники без стороны</h3>}
        <ul className="event-people">
          {participants.map((character) => (
            <li key={character.id}>
              <button type="button" onClick={() => {
                setActiveCharacter(character)
                characterDialog.current?.showModal()
              }}>{character.name}</button>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <main className="section-page">
      <h1>{yearFilter === undefined ? 'События' : `События за системный год ${yearFilter}`}</h1>
      {(yearFilter !== undefined || eventId !== undefined) && <p><a href="#events">Все события</a></p>}
      <p>{timeline.name} · системные годы {timeline.startYear} — {timeline.endYear}</p>
      {eventId === undefined && <fieldset className="catalog-filters">
        <legend>Фильтры событий</legend>
        <label>Поиск <input type="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} /></label>
        <label>С года <input type="number" value={from} onChange={(event) => setFrom(event.currentTarget.value)} /></label>
        <label>По год <input type="number" value={to} onChange={(event) => setTo(event.currentTarget.value)} /></label>
      </fieldset>}
      {eventId === undefined && deleting === null && (
        <button type="button" onClick={() => { setPeriod(false); setDraft('new') }}>Добавить событие</button>
      )}

      {draft !== null && (
        <CreationDialog onCancel={() => { setDraft(null); setError('') }}>
          <form onSubmit={submit} onInput={() => setError('')}>
            <h2 id="creation-dialog-title">{original ? 'Редактировать событие' : 'Новое событие'}</h2>
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
            <p><label>Цвет события <input name="color" type="color" defaultValue={original?.color ?? '#174b43'} /></label></p>
            <EventParticipants characters={characters} organizations={timeline.organizations ?? []} original={original} />
            {error && <p role="alert">{error}</p>}
            <button type="submit">Сохранить</button>{' '}
            <button type="button" onClick={() => { setDraft(null); setError('') }}>Отмена</button>
          </form>
        </CreationDialog>
      )}

      {deleting && (
        <section aria-labelledby="delete-event-heading">
          <h2 id="delete-event-heading">Удалить событие «{deleting.title}»?</h2>
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>Отмена</button>{' '}
          <button type="button" onClick={() => persist(events.filter(({ id }) => id !== deleting.id))}>Удалить</button>
        </section>
      )}

      {draft === null && error && <p role="alert">{error}</p>}
      {sorted.length === 0 ? <p>{eventId !== undefined ? 'Событие не найдено в выбранном таймлайне.' : events.length ? 'События по этим условиям не найдены.' : 'В этом таймлайне пока нет событий.'}</p> : (
        <ul className="event-list">
          {sorted.map((entry) => (
            <li key={entry.id}>
              <LoreLinks timeline={timeline} kind="events" id={entry.id} />
              <h2>{entry.color && <span className="atlas-color" style={{ backgroundColor: entry.color }} aria-hidden="true" />}{entry.year}{entry.end && ` — ${entry.end.year}`} · {entry.title}</h2>
              <p>
                {calendar.name} · {formatEndpoint(entry, calendar)}
                {entry.end && ` → ${formatEndpoint(entry.end, calendar)}`}
              </p>
              {(entry.sides?.length ?? 0) > 0 && (
                <div className="event-sides" aria-label="Стороны события">
                  {entry.sides?.map((side) => (
                    <section key={side.id}>
                      <h3><EventSideLink side={side} organizations={timeline.organizations} /></h3>
                      {side.characterIds.length ? renderParticipants(side.characterIds) : <p>Нет участников.</p>}
                    </section>
                  ))}
                </div>
              )}
              {renderParticipants((entry.characterIds ?? []).filter((id) =>
                !entry.sides?.some((side) => side.characterIds.includes(id))
              ), true)}
              {entry.description && <p>{entry.description}</p>}
              {timeline.chronicles?.some(({ eventIds }) => eventIds?.includes(entry.id)) && (
                <section>
                  <h3>Связанные летописи</h3>
                  <ul>{timeline.chronicles.filter(({ eventIds }) => eventIds?.includes(entry.id)).map(({ id, title }) => (
                    <li key={id}><a href={'#chronicles?entry=' + encodeURIComponent(id)}>{title}</a></li>
                  ))}</ul>
                </section>
              )}
              <button className="event-action" type="button" disabled={draft !== null || deleting !== null} onClick={() => { setPeriod(Boolean(entry.end)); setDraft(entry) }} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>{' '}
              <button className="event-action" type="button" disabled={draft !== null || deleting !== null} onClick={() => setDeleting(entry)} aria-label="Удалить событие" title="Удалить событие">
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog ref={characterDialog} aria-labelledby="event-character-name">
        <h2 id="event-character-name">{activeCharacter?.name}</h2>
        <p className="event-character-description">{activeCharacter?.description || 'Описание пока не добавлено.'}</p>
        {activeCharacter && <p><a href={`#characters?character=${encodeURIComponent(activeCharacter.id)}`}>Открыть карточку персонажа</a></p>}
        <button type="button" onClick={() => characterDialog.current?.close()}>Закрыть</button>
      </dialog>
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
