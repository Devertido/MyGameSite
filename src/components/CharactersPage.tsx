import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { EventSideLink } from './EventSideLink'
import { useState, type FormEvent } from 'react'
import { calendarDay, eventDays, isCharacterDate, isCharacterLifeOrderValid, type CharacterDate, type Timeline, type TimelineCalendar, type TimelineCharacter } from '../domain/timeline'
import { ImageField } from './ImageField'

export function CharactersPage({ timeline, save, characterId }: {
  characterId?: string
  timeline: Timeline
  save: (characters: TimelineCharacter[]) => void
}) {
  const characters = timeline.characters ?? []
  const [draft, setDraft] = useState<TimelineCharacter | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineCharacter | null>(null)
  const [error, setError] = useState('')
  const original = draft === 'new' ? null : draft
  const months = timeline.calendars[0].months
  const busy = draft !== null || deleting !== null

  function cancel() {
    setDraft(null)
    setDeleting(null)
    setError('')
  }

  function persist(next: TimelineCharacter[]) {
    try {
      save(next)
      cancel()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить персонажей.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get('name') ?? '').trim()
    if (!name) {
      setError('Введите имя персонажа.')
      return
    }

    const description = String(fields.get('description') ?? '').trim()
    const biography = String(fields.get('biography') ?? '').trim()
    const surname = String(fields.get('surname') ?? '').trim()
    const race = String(fields.get('race') ?? '').trim()
    const portrait = String(fields.get('portrait') ?? '')
    const birth = readDate(fields, 'birth', months, timeline.daysPerYear)
    const death = readDate(fields, 'death', months, timeline.daysPerYear)
    if (birth === null || death === null) {
      setError('Укажите допустимый системный год, месяц и день для каждой выбранной даты.')
      return
    }
    if (!isCharacterLifeOrderValid(birth, death)) {
      setError('Дата смерти должна быть не раньше даты рождения.')
      return
    }

    const entry: TimelineCharacter = {
      id: original?.id ?? crypto.randomUUID(), name, description, biography, color: String(fields.get('color')),
      ...(surname ? { surname } : {}),
      ...(race ? { race } : {}),
      ...(portrait ? { portrait } : {}),
      ...(birth ? { birth } : {}),
      ...(death ? { death } : {}),
    }
    persist(original ? characters.map((item) => item.id === original.id ? entry : item) : [...characters, entry])
  }

  return (
    <main className="section-page">
      <h1>Персонажи</h1>
      <p>{timeline.name}</p>
      {characterId !== undefined && <p><a href="#characters">Все персонажи</a></p>}
      {characterId !== undefined && !characters.some(({ id }) => id === characterId) && <p>Персонаж не найден.</p>}
      {characterId === undefined && !busy && <button type="button" onClick={() => setDraft('new')}>Добавить персонажа</button>}
      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать персонажа' : 'Новый персонаж'}</h2>
          <p><label>Имя<br /><input name="name" defaultValue={original?.name} required /></label></p>
          <p><label>Фамилия<br /><input name="surname" defaultValue={original?.surname} /></label></p>
          <p><label>Раса<br /><input name="race" defaultValue={original?.race} /></label></p>
          <CharacterDateFields prefix="birth" label="Дата рождения" months={months} initial={original?.birth} />
          <CharacterDateFields prefix="death" label="Дата смерти" months={months} initial={original?.death} />
          <ImageField name="portrait" label="Вертикальный портрет" initial={original?.portrait} />
          <p><label>Описание<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
          <p><label>Биография<br /><textarea name="biography" rows={8} defaultValue={original?.biography} /></label></p>
          <p><label>Цвет персонажа <input name="color" type="color" defaultValue={original?.color ?? '#174b43'} /></label></p>
          <button type="submit">Сохранить</button>{' '}
          <button type="button" onClick={cancel}>Отмена</button>
        </form>
      )}
      {deleting && (
        <section aria-labelledby="delete-character-title">
          <h2 id="delete-character-title">Удалить персонажа «{deleting.name}»?</h2>
          <p>Связи этого персонажа с событиями будут удалены.</p>
          <button type="button" autoFocus onClick={cancel}>Отмена</button>{' '}
          <button type="button" onClick={() => persist(characters.filter(({ id }) => id !== deleting.id))}>
            Удалить
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {characters.length === 0 && <p>В этом таймлайне пока нет персонажей.</p>}
      <ul className="event-list">
        {characters.filter(({ id }) => characterId === undefined || id === characterId).map((character) => {
          const fullName = [character.name, character.surname].filter(Boolean).join(' ')
          const events = (timeline.events ?? []).filter(({ characterIds }) => characterIds?.includes(character.id))
          return (
            <li key={character.id}>
              <div className="character-heading">
                {character.color && <span className="atlas-color" style={{ backgroundColor: character.color }} aria-hidden="true" />}
                <button className="event-action" type="button" disabled={busy} onClick={() => setDraft(character)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>
                <button className="event-action" type="button" disabled={busy} onClick={() => setDeleting(character)} aria-label="Удалить персонажа" title="Удалить персонажа"><TrashIcon /></button>
                <h2>{characterId === undefined
                  ? <a href={`#characters?character=${encodeURIComponent(character.id)}`}>{fullName}</a>
                  : fullName}</h2>
              </div>
              {characterId !== undefined && character.portrait && (
                <img className="character-portrait" src={character.portrait} alt={fullName} />
              )}
              {character.race && <p>Раса · {character.race}</p>}
              {character.birth && <p>Дата рождения · {calendarDay(months, character.birth.dayOfYear)} · {character.birth.year} г. системы</p>}
              {character.death && <p>Дата смерти · {calendarDay(months, character.death.dayOfYear)} · {character.death.year} г. системы</p>}
              {character.description && <p>{character.description}</p>}
              {characterId !== undefined && (
                <>
                  <h3>Биография</h3>
                  <p>{character.biography || 'Биография пока не добавлена.'}</p>
                </>
              )}
              {characterId !== undefined && (
                <>
                  {[
                    { heading: 'Организации', route: 'organizations?organization=', links: (timeline.organizations ?? [])
                      .filter(({ memberIds }) => memberIds.includes(character.id)).map(({ id, name }) => ({ id, title: name })) },
                    { heading: 'Летописи', route: 'chronicles?entry=', links: (timeline.chronicles ?? [])
                      .filter(({ characterIds }) => characterIds?.includes(character.id)) },
                    { heading: 'Предметы', route: 'items?entry=', links: (timeline.items ?? [])
                      .filter(({ ownerId }) => ownerId === character.id) },
                  ].filter(({ links }) => links.length > 0).map(({ heading, route, links }) => (
                    <section key={route}>
                      <h3>{heading}</h3>
                      <ul>{links.map(({ id, title }) => (
                        <li key={id}><a href={'#' + route + encodeURIComponent(id)}>{title}</a></li>
                      ))}</ul>
                    </section>
                  ))}
                </>
              )}
              {characterId !== undefined && events.length === 0 && <p>Участие в событиях пока не указано.</p>}
              {characterId !== undefined && events.length > 0 && (
                <>
                  <h3>Участие в событиях</h3>
                  <ol>{events.sort((a, b) => a.year - b.year || (a.date?.first ?? 1) - (b.date?.first ?? 1)).map((event) => {
                    const side = event.sides?.find((item) => item.characterIds.includes(character.id))
                    return (
                    <li key={event.id}>
                      <a href={`#events?event=${encodeURIComponent(event.id)}`}>
                        {event.year}{event.end && ` — ${event.end.year}`} · {event.title}
                      </a>
                      {' · '}{side ? <EventSideLink side={side} organizations={timeline.organizations} /> : 'Без стороны'}
                    </li>
                    )
                  })}</ol>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function readDate(fields: FormData, prefix: string, months: TimelineCalendar['months'], daysPerYear: number) {
  if (!fields.has(prefix + '-enabled')) return undefined
  const year = fields.get(prefix + '-year')
  const month = fields.get(prefix + '-month')
  const day = fields.get(prefix + '-day')
  if (!year || !month || !day) return null

  const days = eventDays(months, Number(month), Number(day))
  const date = { year: Number(year), dayOfYear: days?.first }
  return isCharacterDate(date, daysPerYear) ? date : null
}

function CharacterDateFields({ prefix, label, months, initial }: {
  prefix: string
  label: string
  months: TimelineCalendar['months']
  initial?: CharacterDate
}) {
  const [enabled, setEnabled] = useState(initial !== undefined)
  let initialDay = initial?.dayOfYear ?? 1
  // Переводим порядковый день года в месяц и день основного календаря.
  const initialMonth = months.findIndex(({ days }) => {
    if (initialDay <= days) return true
    initialDay -= days
    return false
  })
  const [month, setMonth] = useState(initialMonth)
  return (
    <fieldset className="character-date">
      <legend>{label}</legend>
      <label>
        <input name={prefix + '-enabled'} type="checkbox" checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)} />{' '}
        Указать дату
      </label>
      <div hidden={!enabled}>
        <label>Системный год <input name={prefix + '-year'} type="number" step={1}
          defaultValue={initial?.year} disabled={!enabled} required /></label>{' '}
        <label>Месяц <select name={prefix + '-month'} value={month + 1} disabled={!enabled}
          onChange={(event) => setMonth(Number(event.currentTarget.value) - 1)}>
          {months.map(({ name }, index) => <option key={index} value={index + 1}>{name}</option>)}
        </select></label>{' '}
        <label>День <input name={prefix + '-day'} type="number" min={1} max={months[month]?.days}
          defaultValue={initialDay} disabled={!enabled} required /></label>
      </div>
    </fieldset>
  )
}
