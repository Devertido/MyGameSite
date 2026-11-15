import { RelativePicker } from './RelativePicker'
import { FamilyTree } from './FamilyTree'
import { LoreLinks } from './LoreLinks'
import { glossaryDescription, validFamily } from '../domain/lore'
import { EntryFields, EntryGallery, EntryStatusLabel, readEntryMetadata, useStatusMatch } from './EntryMedia'
import { CreationDialog } from './CreationDialog'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { EventSideLink } from './EventSideLink'
import { useState, type FormEvent } from 'react'
import { calendarDay, eventDays, isCharacterDate, isCharacterLifeOrderValid, type CharacterDate, type Timeline, type TimelineCalendar, type TimelineCharacter } from '../domain/timeline'
import { ImageField } from './ImageField'

const columns = [
  { key: 'name', title: 'Имя' },
  { key: 'surname', title: 'Фамилия' },
  { key: 'race', title: 'Раса' },
  { key: 'sex', title: 'Пол' },
] as const

const characterCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

export function CharactersPage({ timeline, save, characterId, familyOpen }: {
  characterId?: string
  familyOpen?: boolean
  timeline: Timeline
  save: (characters: TimelineCharacter[]) => void
}) {
  const characters = timeline.characters ?? []
  const matchesStatus = useStatusMatch()
  const [draft, setDraft] = useState<TimelineCharacter | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineCharacter | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: typeof columns[number]['key']; descending: boolean }>({
    key: 'name', descending: false,
  })
  const sortedCharacters = characters.filter(matchesStatus).sort((left, right) => {
    const a = left[sort.key] ?? ''
    const b = right[sort.key] ?? ''
    if (!a || !b) return Number(!a) - Number(!b)
    return characterCollator.compare(a, b) * (sort.descending ? -1 : 1)
  })
  const selected = characters.find(({ id }) => id === characterId) ??
    (characterId === undefined ? characters.find(matchesStatus) : undefined)
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
    const sex = String(fields.get('sex') ?? '').trim()
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

    const characterClass = String(fields.get('characterClass') ?? '').trim()
    const dynasty = String(fields.get('dynasty') ?? '').trim()
    const parentIds = fields.getAll('parents').map(String)
    const childIds = new Set(fields.getAll('children').map(String))
    const entry: TimelineCharacter = {
      ...readEntryMetadata(fields),
      parentIds,
      ...(characterClass ? { characterClass } : {}),
      ...(dynasty ? { dynasty } : {}),
      id: original?.id ?? crypto.randomUUID(), name, description, biography, color: String(fields.get('color')),
      ...(surname ? { surname } : {}),
      ...(race ? { race } : {}),
      ...(sex ? { sex } : {}),
      ...(portrait ? { portrait } : {}),
      ...(birth ? { birth } : {}),
      ...(death ? { death } : {}),
    }
    const next = characters.filter(({ id }) => id !== entry.id).map((item) => {
      const parents = item.parentIds ?? []
      const hasParent = parents.includes(entry.id)
      if (hasParent === childIds.has(item.id)) return item
      return { ...item, parentIds: hasParent ? parents.filter((id) => id !== entry.id) : [...parents, entry.id] }
    })
    next.splice(original ? characters.findIndex(({ id }) => id === original.id) : next.length, 0, entry)
    if (!validFamily(next)) {
      setError('Проверьте родство. Персонаж не может быть собственным предком.')
      return
    }
    persist(next)
  }

  return (
    <main className="section-page">
      <h1>Персонажи</h1>
      <p>{timeline.name}</p>
      {characterId !== undefined && !characters.some(({ id }) => id === characterId) && <p>Персонаж не найден.</p>}
      {draft !== null && (
        <CreationDialog onCancel={cancel}>
          <form onSubmit={submit} onInput={() => setError('')}>
            <h2 id="creation-dialog-title">{original ? 'Редактировать персонажа' : 'Новый персонаж'}</h2>
            <div className="character-name-fields">
              <label>Имя<br /><input name="name" defaultValue={original?.name} required /></label>
              <label>Фамилия<br /><input name="surname" list="lore-surnames" defaultValue={original?.surname}
                title={glossaryDescription(timeline.lore, 'surnames', original?.surname)}
                onInput={(event) => { event.currentTarget.title = glossaryDescription(timeline.lore, 'surnames', event.currentTarget.value) ?? '' }} /></label>
            </div>
            <p><label>Раса<br /><input name="race" list="lore-races" defaultValue={original?.race}
                title={glossaryDescription(timeline.lore, 'races', original?.race)}
                onInput={(event) => { event.currentTarget.title = glossaryDescription(timeline.lore, 'races', event.currentTarget.value) ?? '' }} /></label></p>
            <p><label>Династия<br /><input name="dynasty" list="lore-dynasties" defaultValue={original?.dynasty}
                title={glossaryDescription(timeline.lore, 'dynasties', original?.dynasty)}
                onInput={(event) => { event.currentTarget.title = glossaryDescription(timeline.lore, 'dynasties', event.currentTarget.value) ?? '' }} /></label></p>
            <p><label>Класс<br /><input name="characterClass" list="lore-classes" defaultValue={original?.characterClass}
                title={glossaryDescription(timeline.lore, 'classes', original?.characterClass)}
                onInput={(event) => { event.currentTarget.title = glossaryDescription(timeline.lore, 'classes', event.currentTarget.value) ?? '' }} /></label></p>
            {(['surnames', 'races', 'dynasties', 'classes'] as const).map((field) => (
              <datalist key={field} id={'lore-' + field}>
                {(timeline.lore?.[field] ?? []).map((value) => <option key={value} value={value} />)}
              </datalist>
            ))}
            {(['parents', 'children'] as const).map((relation) => {
              const candidates = characters.filter(({ id }) => id !== original?.id)
              const initialIds = candidates.filter((candidate) => relation === 'parents'
                ? original?.parentIds?.includes(candidate.id)
                : candidate.parentIds?.includes(original?.id ?? '')).map(({ id }) => id)
              return <RelativePicker key={relation} name={relation} label={relation === 'parents' ? 'Родители' : 'Дети'}
                candidates={candidates} initialIds={initialIds} />
            })}
            <p><label>Пол<br />
              <select name="sex" defaultValue={original?.sex || ''}>
                <option value="">Не указан</option>
                <option value="Муж">Муж</option>
                <option value="Жен">Жен</option>
                {original?.sex && original.sex !== 'Муж' && original.sex !== 'Жен' && (
                  <option value={original.sex}>{original.sex}</option>
                )}
              </select>
            </label></p>
            <CharacterDateFields prefix="birth" label="Дата рождения" months={months} initial={original?.birth} />
            <CharacterDateFields prefix="death" label="Дата смерти" months={months} initial={original?.death} />
            <ImageField name="portrait" allowGif label="Вертикальный портрет" initial={original?.portrait} />
            <EntryFields entry={original} />
            <p><label>Описание<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
            <p><label>Биография<br /><textarea name="biography" rows={8} defaultValue={original?.biography} /></label></p>
            <p><label>Цвет персонажа <input name="color" type="color" defaultValue={original?.color ?? '#174b43'} /></label></p>
            {error && <p role="alert">{error}</p>}
            <button type="submit">Сохранить</button>{' '}
            <button type="button" onClick={cancel}>Отмена</button>
          </form>
        </CreationDialog>
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
      {draft === null && error && <p role="alert">{error}</p>}
      {characters.length === 0 && <p>В этом таймлайне пока нет персонажей.</p>}
      <div className="directory-layout">
        <ul className="event-list">
          {(selected ? [selected] : []).map((character) => {
            const fullName = [character.name, character.surname].filter(Boolean).join(' ')
            const lifespan = character.birth && character.death ? formatLifespan(character.birth, character.death) : null
            const events = (timeline.events ?? []).filter(({ characterIds }) => characterIds?.includes(character.id))
            return (
              <li key={character.id} className="directory-card">
                <div className="character-overview">
                  {character.portrait && (
                    <img className="character-portrait" src={character.portrait} alt={fullName} loading="lazy" />
                  )}
                  <div className="character-summary">
                    <div className="character-heading">
                      {character.color && <span className="atlas-color" style={{ backgroundColor: character.color }} aria-hidden="true" />}
                      <button className="event-action" type="button" disabled={busy} onClick={() => setDraft(character)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>
                      <button className="event-action" type="button" disabled={busy} onClick={() => setDeleting(character)} aria-label="Удалить персонажа" title="Удалить персонажа"><TrashIcon /></button>
                      <button className="family-tree-button" type="button" onClick={() => { window.location.hash = 'characters?character=' + encodeURIComponent(character.id) + '&family=1' }}>Родословная</button>
                    </div>
                    <h2 className="character-name">{character.name}{character.surname && (
                      <> <span title={glossaryDescription(timeline.lore, 'surnames', character.surname)}>{character.surname}</span></>
                    )}</h2>
                    <dl className="character-facts">
                      {character.sex && <div><dt>Пол</dt><dd>{character.sex}</dd></div>}
                      {character.characterClass && <div><dt>Класс</dt><dd title={glossaryDescription(timeline.lore, 'classes', character.characterClass)}>{character.characterClass}</dd></div>}
                      {character.race && <div><dt>Раса</dt><dd title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race}</dd></div>}
                      {character.dynasty && <div><dt>Династия</dt><dd title={glossaryDescription(timeline.lore, 'dynasties', character.dynasty)}>{character.dynasty}</dd></div>}
                      {(character.birth || character.death) && (
                        <div><dt>Годы жизни</dt><dd>{character.birth?.year ?? '?'} — {character.death?.year ?? '…'}
                          {lifespan && ' (' + lifespan + ')'}
                        </dd></div>
                      )}
                    </dl>
                    {character.description && <p>{character.description}</p>}
                  </div>
                </div>
                {character.birth && (
                  <p>Дата рождения · {calendarDay(months, character.birth.dayOfYear)} · {character.birth.year} г. системы</p>
                )}
                {character.death && (
                  <p>Дата смерти · {calendarDay(months, character.death.dayOfYear)} · {character.death.year} г. системы</p>
                )}
                {(
                  <>
                  <EntryStatusLabel entry={character} />
                  <EntryGallery key={character.id} entry={character} />
                  <LoreLinks timeline={timeline} kind="characters" id={character.id} />
                  <h3>Биография</h3>
                    <p>{character.biography || 'Биография пока не добавлена.'}</p>
                  </>
                )}
                {(
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
                {events.length === 0 && <p>Участие в событиях пока не указано.</p>}
                {events.length > 0 && (
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
        <section className="directory-table" aria-labelledby="character-directory-title">
          <div className="directory-actions">
          {!deleting && <button type="button" onClick={() => setDraft('new')}>Добавить персонажа</button>}
          </div>
          <h2 id="character-directory-title">Все персонажи</h2>
          <div className="directory-table-scroll">
            <table>
              <thead>
                <tr>{columns.map(({ key, title }) => (
                  <th key={key} scope="col" aria-sort={sort.key === key
                    ? sort.descending ? 'descending' : 'ascending'
                    : undefined}>
                    <button type="button" onClick={() => setSort({
                      key, descending: sort.key === key && !sort.descending,
                    })}>
                      {title}{sort.key === key && <span aria-hidden="true">{sort.descending ? ' ↓' : ' ↑'}</span>}
                    </button>
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {sortedCharacters.map((character) => (
                  <tr key={character.id} data-selected={character.id === selected?.id}>
                    <td>
                      <a href={'#characters?character=' + encodeURIComponent(character.id)}
                        aria-current={character.id === selected?.id ? 'true' : undefined} onClick={cancel}>
                        {character.name}
                      </a>
                    </td>
                    <td><span title={glossaryDescription(timeline.lore, 'surnames', character.surname)}>{character.surname || '—'}</span></td>
                    <td><span title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race || '—'}</span></td>
                    <td>{character.sex || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {familyOpen && selected && <FamilyTree character={selected} characters={characters} onClose={() => {
        window.location.hash = 'characters?character=' + encodeURIComponent(selected.id)
      }} />}
    </main>
  )
}

function formatLifespan(birth: CharacterDate, death: CharacterDate) {
  const years = BigInt(death.year) - BigInt(birth.year) - (death.dayOfYear < birth.dayOfYear ? 1n : 0n)
  const last = years % 10n
  const lastTwo = years % 100n
  const unit = lastTwo >= 11n && lastTwo <= 14n ? 'лет' : last === 1n ? 'год' : last >= 2n && last <= 4n ? 'года' : 'лет'
  return years.toString() + ' ' + unit
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
