import { sameHouse, validSpouses } from '../domain/houseTree'
import { displayMonthName } from '../domain/calendar.ts'
import { t } from '../i18n.ts'
import { AbilityPicker } from './AbilityPicker'
import { AbilityFields } from './AbilityScores'
import { readAbilityScores } from '../domain/abilities'
import { RelativePicker } from './RelativePicker'
import { glossaryDescription, maxClassLevel, raceDetailsFor, surnameTooltip, validClassLevel, validFamily } from '../domain/lore'
import { EntryFields, readEntryMetadata } from './EntryMedia'
import { CreationDialog } from './CreationDialog'
import { useState, type FormEvent } from 'react'
import { eventDays, isCharacterDate, isCharacterLifeOrderValid, type CharacterDate, type Timeline, type TimelineCalendar, type TimelineCharacter } from '../domain/timeline'
import { ImageField } from './ImageField'

type FamilyDefaults = { parentId?: string; spouseId?: string; childId?: string; dynasty?: string; surname?: string }

export function CharacterEditor({ timeline, original, save, cancel, familyDefaults }: {
  timeline: Timeline
  original: TimelineCharacter | null
  save: (characters: TimelineCharacter[]) => void
  cancel: () => void
  familyDefaults?: FamilyDefaults
}) {
  const characters = timeline.characters ?? []
  const months = timeline.calendars[0].months
  const [draftRace, setDraftRace] = useState(original?.race ?? '')
  const [surnameDraft, setSurnameDraft] = useState(original?.surname ?? familyDefaults?.surname ?? '')
  const [outsideMarriage, setOutsideMarriage] = useState(original?.bornOutsideMarriage ?? false)
  const [error, setError] = useState('')

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
    let surname = String(fields.get('surname') ?? '').trim()
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
    const parentIds = [...new Set([...fields.getAll('parents').map(String), ...(familyDefaults?.parentId ? [familyDefaults.parentId] : [])])]
    if (surname === familyDefaults?.surname && familyDefaults.spouseId && !parentIds.includes(familyDefaults.spouseId)) surname = ''
    const childIds = new Set([...fields.getAll('children').map(String), ...(familyDefaults?.childId ? [familyDefaults.childId] : [])])
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
    try {
      save(next)
      cancel()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t("Не удалось сохранить персонажей."))
    }
  }

  return (
    <CreationDialog onCancel={cancel}>
      <form onSubmit={submit} onInput={() => setError('')}>
        <h2 id="creation-dialog-title">{original ? t('Редактировать персонажа') : t('Новый персонаж')}</h2>
        <div className="character-name-fields">
          <label>{t("Имя")}<br /><input name="name" defaultValue={original?.name} required /></label>
          <label>{t("Фамилия")}<br /><input name="surname" list="lore-surnames" value={surnameDraft} onChange={(event) => setSurnameDraft(event.currentTarget.value)}
            title={surnameTooltip(timeline, original?.surname)}
            onInput={(event) => { event.currentTarget.title = surnameTooltip(timeline, event.currentTarget.value) ?? '' }} /></label>
        </div>
        <p><label>{t("Раса")}<br /><input name="race" list="lore-races" value={draftRace}
            title={glossaryDescription(timeline.lore, 'races', draftRace)}
            onChange={(event) => setDraftRace(event.currentTarget.value)} /></label></p>
        <p><label>{t('Род')}<br /><select name="dynasty"
          defaultValue={timeline.lore?.dynasties.find((name) => sameHouse(original?.dynasty, name)) ?? original?.dynasty ?? familyDefaults?.dynasty ?? ''}>
          <option value="">{t('Не указан')}</option>
          {timeline.lore?.dynasties.map((name) => <option key={name} value={name}>{name}</option>)}
          {original?.dynasty && !timeline.lore?.dynasties.some((name) => sameHouse(original.dynasty, name)) &&
            <option value={original.dynasty}>{original.dynasty}</option>}
        </select></label></p>
        <p><label><input type="checkbox" name="born-outside-marriage" checked={outsideMarriage}
          onChange={(event) => {
            const checked = event.currentTarget.checked
            setOutsideMarriage(checked)
            if (familyDefaults?.surname && (checked ? surnameDraft === familyDefaults.surname : !surnameDraft)) {
              setSurnameDraft(checked ? '' : familyDefaults.surname)
            }
          }} /> {t('Рождение вне брака')}</label></p>
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
            ? original?.parentIds?.includes(candidate.id) || familyDefaults?.parentId === candidate.id || familyDefaults?.spouseId === candidate.id
            : candidate.parentIds?.includes(original?.id ?? '') || familyDefaults?.childId === candidate.id).map(({ id }) => id)
          return <RelativePicker key={relation} name={relation} label={relation === 'parents' ? t('Родители') : t('Дети')}
            candidates={candidates} initialIds={initialIds} lockedId={relation === 'parents' ? familyDefaults?.parentId : familyDefaults?.childId} />
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
  let initialMonth = 0
  for (const { days } of months) {
    if (initialDay <= days) break
    initialDay -= days
    initialMonth++
  }
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
