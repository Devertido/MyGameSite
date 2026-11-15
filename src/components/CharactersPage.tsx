import { sameHouse, validSpouses } from '../domain/houseTree'
import { displayMonthName } from '../domain/calendar.ts'
import { t } from '../i18n.ts'
import { AbilityLinks, AbilityPicker } from './AbilityPicker'
import { AbilityDetails, AbilityFields } from './AbilityScores'
import { adjustedAbilities, readAbilityScores } from '../domain/abilities'
import { RelativePicker } from './RelativePicker'
import { FamilyTree } from './FamilyTree'
import { LoreLinks } from './LoreLinks'
import { glossaryDescription, maxClassLevel, raceDetailsFor, surnameTooltip, validClassLevel, validFamily } from '../domain/lore'
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
  { key: 'level', title: 'Уровень' },
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
  const [draftRace, setDraftRace] = useState('')
  const [deleting, setDeleting] = useState<TimelineCharacter | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: typeof columns[number]['key']; descending: boolean }>({
    key: 'name', descending: false,
  })
  const sortedCharacters = characters.filter(matchesStatus).sort((left, right) => {
    const a = left[sort.key] ?? ''
    const b = right[sort.key] ?? ''
    if (!a || !b) return Number(!a) - Number(!b)
    return characterCollator.compare(String(a), String(b)) * (sort.descending ? -1 : 1)
  })
  const selected = characters.find(({ id }) => id === characterId) ??
    (characterId === undefined ? characters.find(matchesStatus) : undefined)
  const original = draft === 'new' ? null : draft
  const months = timeline.calendars[0].months
  const busy = draft !== null || deleting !== null

  function editCharacter(character: TimelineCharacter | 'new') {
    setDraftRace(character === 'new' ? '' : character.race ?? '')
    setDraft(character)
  }

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
      setError(error instanceof Error ? error.message : t('Не удалось сохранить персонажей.'))
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get('name') ?? '').trim()
    if (!name) {
      setError(t('Введите имя персонажа.'))
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
      setError(t('Укажите допустимый системный год, месяц и день для каждой выбранной даты.'))
      return
    }
    if (!isCharacterLifeOrderValid(birth, death)) {
      setError(t('Дата смерти должна быть не раньше даты рождения.'))
      return
    }

    const levelText = String(fields.get('level') ?? '').trim()
    const level = levelText ? Number(levelText) : undefined
    if (level !== undefined && !validClassLevel(level)) {
      setError(t('Укажите целый уровень от 1 до 20.'))
      return
    }
    const characterClass = String(fields.get('characterClass') ?? '').trim()
    const dynasty = String(fields.get('dynasty') ?? '').trim()
    const parentIds = fields.getAll('parents').map(String)
    const childIds = new Set(fields.getAll('children').map(String))
    const entry: TimelineCharacter = {
      ...readEntryMetadata(fields),
      parentIds,
      abilities: readAbilityScores(fields),
      abilityNames: fields.getAll('ability-names').map(String),
      ...(level !== undefined ? { level } : {}),
      ...(characterClass ? { characterClass } : {}),
      ...(dynasty ? { dynasty } : {}),
      ...(original?.loverIds?.length ? { loverIds: original.loverIds } : {}),
      ...(fields.has('born-outside-marriage') ? { bornOutsideMarriage: true } : {}),
      ...(original?.spouseId ? { spouseId: original.spouseId } : {}),
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
      setError(t('Проверьте родство. Персонаж не может быть собственным предком.'))
      return
    }
    if (!validSpouses(next)) {
      setError(t('У супругов должен быть указан разный пол: Муж и Жен.'))
      return
    }
    persist(next)
  }

  return (
    <main className="section-page">
      <h1>{t("Персонажи")}</h1>
      <p>{timeline.name}</p>
      {characterId !== undefined && !characters.some(({ id }) => id === characterId) && <p>{t("Персонаж не найден.")}</p>}
      {draft !== null && (
        <CreationDialog onCancel={cancel}>
          <form onSubmit={submit} onInput={() => setError('')}>
            <h2 id="creation-dialog-title">{original ? t('Редактировать персонажа') : t('Новый персонаж')}</h2>
            <div className="character-name-fields">
              <label>{t("Имя")}<br /><input name="name" defaultValue={original?.name} required /></label>
              <label>{t("Фамилия")}<br /><input name="surname" list="lore-surnames" defaultValue={original?.surname}
                title={surnameTooltip(timeline, original?.surname)}
                onInput={(event) => { event.currentTarget.title = surnameTooltip(timeline, event.currentTarget.value) ?? '' }} /></label>
            </div>
            <p><label>{t("Раса")}<br /><input name="race" list="lore-races" value={draftRace}
                title={glossaryDescription(timeline.lore, 'races', draftRace)}
                onChange={(event) => setDraftRace(event.currentTarget.value)} /></label></p>
            <p><label>{t('Род')}<br /><select name="dynasty"
              defaultValue={timeline.lore?.dynasties.find((name) => sameHouse(original?.dynasty, name)) ?? original?.dynasty ?? ''}>
              <option value="">{t('Не указан')}</option>
              {timeline.lore?.dynasties.map((name) => <option key={name} value={name}>{name}</option>)}
              {original?.dynasty && !timeline.lore?.dynasties.some((name) => sameHouse(original.dynasty, name)) &&
                <option value={original.dynasty}>{original.dynasty}</option>}
            </select></label></p>
            <p><label><input type="checkbox" name="born-outside-marriage" defaultChecked={original?.bornOutsideMarriage} /> {t('Рождение вне брака')}</label></p>
            <p><label>{t("Класс")}<br /><input name="characterClass" list="lore-classes" defaultValue={original?.characterClass}
                title={glossaryDescription(timeline.lore, 'classes', original?.characterClass)}
                onInput={(event) => { event.currentTarget.title = glossaryDescription(timeline.lore, 'classes', event.currentTarget.value) ?? '' }} /></label></p>
            <p><label>{t('Уровень')}<br /><input name="level" type="number" min={1} max={maxClassLevel} step={1} defaultValue={original?.level} /></label></p>
            {(['surnames', 'races', 'classes'] as const).map((field) => (
              <datalist key={field} id={'lore-' + field}>
                {(timeline.lore?.[field] ?? []).map((value) => <option key={value} value={value} />)}
              </datalist>
            ))}
            {(['parents', 'children'] as const).map((relation) => {
              const candidates = characters.filter(({ id }) => id !== original?.id)
              const initialIds = candidates.filter((candidate) => relation === 'parents'
                ? original?.parentIds?.includes(candidate.id)
                : candidate.parentIds?.includes(original?.id ?? '')).map(({ id }) => id)
              return <RelativePicker key={relation} name={relation} label={relation === 'parents' ? t('Родители') : t('Дети')}
                candidates={candidates} initialIds={initialIds} />
            })}
            <p><label>{t("Пол")}<br />
              <select name="sex" defaultValue={original?.sex || ''}>
                <option value="">{t("Не указан")}</option>
                <option value="Муж">{t("Муж")}</option>
                <option value="Жен">{t("Жен")}</option>
                {original?.sex && original.sex !== 'Муж' && original.sex !== 'Жен' && (
                  <option value={original.sex}>{t(original.sex)}</option>
                )}
              </select>
            </label></p>
            <CharacterDateFields prefix="birth" label={t("Дата рождения")} months={months} initial={original?.birth} />
            <CharacterDateFields prefix="death" label={t("Дата смерти")} months={months} initial={original?.death} />
            <ImageField name="portrait" allowGif label={t("Вертикальный портрет")} initial={original?.portrait} />
            <EntryFields entry={original} />
            <AbilityPicker initial={original?.abilityNames} options={timeline.lore?.abilities ?? []} />
            <AbilityFields scores={original?.abilities} race={raceDetailsFor(timeline.lore, draftRace)} />
            <p><label>{t("Описание")}<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
            <p><label>{t("Биография")}<br /><textarea name="biography" rows={8} defaultValue={original?.biography} /></label></p>
            <p><label>{t("Цвет персонажа ")}<input name="color" type="color" defaultValue={original?.color ?? '#174b43'} /></label></p>
            {error && <p role="alert">{error}</p>}
            <button type="submit">{t("Сохранить")}</button>{' '}
            <button type="button" onClick={cancel}>{t("Отмена")}</button>
          </form>
        </CreationDialog>
      )}
      {deleting && (
        <section aria-labelledby="delete-character-title">
          <h2 id="delete-character-title">{t("Удалить персонажа «")}{deleting.name}»?</h2>
          <p>{t("Связи этого персонажа с событиями будут удалены.")}</p>
          <button type="button" autoFocus onClick={cancel}>{t("Отмена")}</button>{' '}
          <button type="button" onClick={() => persist(characters.filter(({ id }) => id !== deleting.id))}>{t("Удалить")}</button>
        </section>
      )}
      {draft === null && error && <p role="alert">{error}</p>}
      {characters.length === 0 && <p>{t("В этом таймлайне пока нет персонажей.")}</p>}
      <div className="directory-layout">
        <ul className="event-list">
          {(selected ? [selected] : []).map((character) => {
            const fullName = [character.name, character.surname].filter(Boolean).join(' ')
            const raceDetails = raceDetailsFor(timeline.lore, character.race)
            const lifespan = character.birth && character.death ? formatLifespan(character.birth, character.death) : null
            const items = (timeline.items ?? []).filter(({ ownerId }) => ownerId === character.id)
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
                      <button className="event-action" type="button" disabled={busy} onClick={() => editCharacter(character)} aria-label={t("Редактировать")} title={t("Редактировать")}><EditIcon /></button>
                      <button className="event-action" type="button" disabled={busy} onClick={() => setDeleting(character)} aria-label={t("Удалить персонажа")} title={t("Удалить персонажа")}><TrashIcon /></button>
                      <button className="family-tree-button" type="button" onClick={() => { window.location.hash = 'characters?character=' + encodeURIComponent(character.id) + '&family=1' }}>{t("Родословная")}</button>
                    </div>
                    <h2 className="character-name">{character.name}{character.surname && (
                      <> <span title={surnameTooltip(timeline, character.surname)}>{character.surname}</span></>
                    )}</h2>
                    <dl className="character-facts">
                      {character.sex && <div><dt>{t("Пол")}</dt><dd>{t(character.sex)}</dd></div>}
                      {character.level !== undefined && <div><dt>{t('Уровень')}</dt><dd>{character.level}</dd></div>}
                      {character.characterClass && <div><dt>{t("Класс")}</dt><dd title={glossaryDescription(timeline.lore, 'classes', character.characterClass)}>{character.characterClass}</dd></div>}
                      {character.race && <div><dt>{t("Раса")}</dt><dd title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race}</dd></div>}
                      {character.dynasty && <div><dt>{t('Род')}</dt><dd title={glossaryDescription(timeline.lore, 'dynasties', character.dynasty)}>
                        {timeline.lore?.dynasties.some((name) => sameHouse(character.dynasty, name))
                          ? <a href={'#lore?section=dynasties&entry=' + encodeURIComponent(character.dynasty)}>{character.dynasty}</a>
                          : character.dynasty}
                      </dd></div>}
                      {(character.birth || character.death) && (
                        <div><dt>{t("Годы жизни")}</dt><dd>{character.birth?.year ?? '?'} — {character.death?.year ?? '…'}
                          {lifespan && ' (' + lifespan + ')'}
                        </dd></div>
                      )}
                    </dl>
                    {character.description && <p>{character.description}</p>}
                  </div>
                </div>
                {items.length > 0 && (
                  <section className="character-items">
                    <h3>{t('Предметы')}</h3>
                    <ul>
                      {items.map(({ id, title, image, type, rarity }) => (
                        <li key={id}>
                          <a href={'#lore?section=items&entry=' + encodeURIComponent(id)}>
                            {image && <img src={image} alt="" loading="lazy" />}
                            <span>
                              <strong>{title}</strong>
                              {(type || rarity) && <small>{[type, rarity && t(rarity)].filter(Boolean).join(' · ')}</small>}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <AbilityLinks names={character.abilityNames} />
                <AbilityDetails scores={adjustedAbilities(character.abilities, raceDetails?.abilityBonuses, raceDetails?.abilityPenalties)} />
                {character.birth && (
                  <p>{t("Дата рождения · ")}{calendarDay(months, character.birth.dayOfYear)} · {character.birth.year}{t(" г. системы")}</p>
                )}
                {character.death && (
                  <p>{t("Дата смерти · ")}{calendarDay(months, character.death.dayOfYear)} · {character.death.year}{t(" г. системы")}</p>
                )}
                {(
                  <>
                  <EntryStatusLabel entry={character} />
                  <EntryGallery key={character.id} entry={character} />
                  <LoreLinks timeline={timeline} kind="characters" id={character.id} />
                  <h3>{t("Биография")}</h3>
                    <p>{character.biography || t('Биография пока не добавлена.')}</p>
                  </>
                )}
                {(
                  <>
                    {[
                      { heading: t('Организации'), route: 'organizations?organization=', links: (timeline.organizations ?? [])
                        .filter(({ memberIds }) => memberIds.includes(character.id)).map(({ id, name }) => ({ id, title: name })) },
                      { heading: t('Летописи'), route: 'chronicles?entry=', links: (timeline.chronicles ?? [])
                        .filter(({ characterIds }) => characterIds?.includes(character.id)) },
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
                {events.length === 0 && <p>{t("Участие в событиях пока не указано.")}</p>}
                {events.length > 0 && (
                  <>
                    <h3>{t("Участие в событиях")}</h3>
                    <ol>{events.sort((a, b) => a.year - b.year || (a.date?.first ?? 1) - (b.date?.first ?? 1)).map((event) => {
                      const side = event.sides?.find((item) => item.characterIds.includes(character.id))
                      return (
                      <li key={event.id}>
                        <a href={`#events?event=${encodeURIComponent(event.id)}`}>
                          {event.year}{event.end && ` — ${event.end.year}`} · {event.title}
                        </a>
                        {' · '}{side ? <EventSideLink side={side} organizations={timeline.organizations} /> : t('Без стороны')}
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
          {!deleting && <button type="button" onClick={() => editCharacter('new')}>{t("Добавить персонажа")}</button>}
          </div>
          <h2 id="character-directory-title">{t("Все персонажи")}</h2>
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
                      {t(title)}{sort.key === key && <span aria-hidden="true">{sort.descending ? ' ↓' : ' ↑'}</span>}
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
                    <td><span title={surnameTooltip(timeline, character.surname)}>{character.surname || '—'}</span></td>
                    <td><span title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race || '—'}</span></td>
                    <td>{character.sex ? t(character.sex) : '—'}</td>
                    <td>{character.level ?? '—'}</td>
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
  const unit = lastTwo >= 11n && lastTwo <= 14n ? t('лет') : last === 1n ? t('год') : last >= 2n && last <= 4n ? t('года') : t('лет')
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
          onChange={(event) => setEnabled(event.currentTarget.checked)} />{' '}{t("Указать дату")}</label>
      <div hidden={!enabled}>
        <label>{t("Системный год ")}<input name={prefix + '-year'} type="number" step={1}
          defaultValue={initial?.year} disabled={!enabled} required /></label>{' '}
        <label>{t("Месяц ")}<select name={prefix + '-month'} value={month + 1} disabled={!enabled}
          onChange={(event) => setMonth(Number(event.currentTarget.value) - 1)}>
          {months.map(({ name }, index) => <option key={index} value={index + 1}>{displayMonthName(name)}</option>)}
        </select></label>{' '}
        <label>{t("День ")}<input name={prefix + '-day'} type="number" min={1} max={months[month]?.days}
          defaultValue={initialDay} disabled={!enabled} required /></label>
      </div>
    </fieldset>
  )
}
