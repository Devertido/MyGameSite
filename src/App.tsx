import { TimelineLocationMap } from './components/TimelineLocationMap'
import { sameHouse } from './domain/houseTree'
import { t } from './i18n.ts'
import { useRef, useState, type FormEvent } from 'react'
import { StatusFilter } from './components/EntryMedia'
import type { EntryStatus } from './domain/timeline'
import { createPortal } from 'react-dom'
import { TrashIcon } from './components/TrashIcon'
import { displayCalendarName, displayMonthName, displayWeekdayName, standardYear, validateMonths, validateWeek } from './domain/calendar'
import { ArchivePage } from './components/ArchivePage'
import { OrganizationsPage } from './components/OrganizationsPage'
import { CharactersPage } from './components/CharactersPage'
import { EventsPage } from './components/EventsPage'
import { TimelineScale } from './components/TimelineScale'
import { LorePage } from './components/LorePage'
import { removeMissingLoreLinks } from './domain/lore'
import { WorldMap } from './components/WorldMap'
import { validateCalendarEra } from './domain/calendarYear'
import { calendarDay, validateEvent, validateTimelineBounds, type Timeline, type TimelineCalendar, type TimelineEvent, type TimelineCharacter } from './domain/timeline'
import { deleteTimeline, exportAtlas, exportTimeline, previewBackup, saveTimelineCopies, loadTimelines, rememberSelection, restoreSelection, saveTimeline, timelineSnapshot } from './data/timelineStorage'

function App({ backupTools, english, page, eventYear, eventId, characterId, organizationId, entryId, loreSection, familyOpen }: { backupTools: HTMLDivElement | null; english: boolean; page: 'timeline' | 'events' | 'characters' | 'organizations' | 'chronicles' | 'lore'; loreSection?: string; familyOpen?: boolean; eventYear?: number; eventId?: string; characterId?: string; organizationId?: string; entryId?: string }) {
  const [entryFilter, setEntryFilter] = useState<EntryStatus | 'all'>('all')
  const [backupMessage, setBackupMessage] = useState('')
  const [backupPreview, setBackupPreview] = useState<Timeline[] | null>(null)
  const backupDialogRef = useRef<HTMLDialogElement>(null)
  const [importing, setImporting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const eventPickerRef = useRef<HTMLDialogElement>(null)
  const [eventPickerError, setEventPickerError] = useState('')
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nextId = useRef(2)
  const [yearMode, setYearMode] = useState<'standard' | 'custom'>('standard')
  const [monthIds, setMonthIds] = useState([1])
  const [weekdays, setWeekdays] = useState([{ id: 1, name: '' }])
  const [library, setLibrary] = useState(() => {
    try {
      const { entries, skipped } = loadTimelines()
      const warning = skipped ? `${t("Не удалось прочитать записей: ")}${skipped}.` : ''
      return { entries, warning }
    } catch {
      return { entries: [], warning: t('Локальное хранилище недоступно.') }
    }
  })
  const [selection, setSelection] = useState(() => restoreSelection(library.entries))
  const { id: selectedId, calendarIndex } = selection
  const selected = library.entries.find(({ id }) => id === selectedId)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<typeof selected>(undefined)
  const [formVersion, setFormVersion] = useState(0)
  const original = editing?.timeline
  const [editCalendarIndex, setEditCalendarIndex] = useState(0)
  const originalCalendar = original?.calendars[editCalendarIndex]
  const addingCalendar = Boolean(original && !originalCalendar)
  const fixedYearLength = addingCalendar || (original?.calendars.length ?? 0) > 1

  function selectTimeline(id: string, calendarIndex = 0) {
    const selection = { id, calendarIndex }
    setSelection(selection)
    rememberSelection(selection)
  }

  function openForm(entry?: NonNullable<typeof selected>, index = calendarIndex) {
    const calendar = entry?.timeline.calendars[index]
    setEditCalendarIndex(index)
    setEditing(entry)
    setYearMode(entry ? 'custom' : 'standard')
    setMonthIds(calendar?.months.map((_, index) => index + 1) ?? [1])
    setWeekdays(calendar?.weekdayNames.map((name, index) => ({ id: index + 1, name })) ?? [{ id: 1, name: '' }])
    nextId.current = Math.max(calendar?.months.length ?? 1, calendar?.weekdayNames.length ?? 1) + 1
    setMessage('')
    setFormVersion((version) => version + 1)
    dialogRef.current?.showModal()
  }

  function submitTimeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get('name') ?? '').trim()
    const startYear = Number(fields.get('startYear'))
    const endYear = Number(fields.get('endYear'))
    const useStandardYear = yearMode === 'standard'
    const daysPerYear = (fixedYearLength ? original?.daysPerYear : undefined) ??
      (useStandardYear ? standardYear.daysPerYear : Number(fields.get('daysPerYear')))
    const enteredCalendarName = String(fields.get('calendarName') ?? '').trim()
    const previousName = originalCalendar?.name ?? (addingCalendar ? '' : 'Основной календарь')
    const calendarName = enteredCalendarName === displayCalendarName(previousName) ? previousName : enteredCalendarName
    if (!calendarName) {
      setMessage(t('Введите название календаря.'))
      return
    }

    if (!name) {
      setMessage(t('Введите название таймлайна.'))
      return
    }

    const boundsError = validateTimelineBounds(startYear, endYear, original)
    if (boundsError) {
      setMessage(boundsError)
      return
    }

    // Идентификаторы строк сохраняют введённые значения при удалении соседней строки.
    const months = useStandardYear ? standardYear.months : monthIds.map((id) => {
      const enteredName = String(fields.get('month-name-' + id) ?? '')
      const previousName = originalCalendar?.months[id - 1]?.name ?? ''
      return {
        name: enteredName === displayMonthName(previousName) ? previousName : enteredName,
        days: Number(fields.get('month-days-' + id)),
      }
    })
    const monthError = validateMonths(months, daysPerYear)
    if (monthError) {
      setMessage(monthError)
      return
    }

    const weekdayNames = useStandardYear ? standardYear.weekdayNames : weekdays.map(({ name }) => name.trim())
    const firstWeekday = useStandardYear ? standardYear.firstWeekday : weekdays.findIndex(({ id }) => String(id) === fields.get('firstWeekday'))
    const epochWeekday = useStandardYear ? standardYear.epochWeekday : weekdays.findIndex(({ id }) => String(id) === fields.get('epochWeekday'))
    const weekError = validateWeek(weekdayNames, firstWeekday, epochWeekday)

    if (weekError) {
      setMessage(weekError)
      return
    }

    const era = {
      systemAnchorYear: Number(fields.get('systemAnchorYear')),
      calendarAnchorYear: Number(fields.get('calendarAnchorYear')),
      hasYearZero: fields.has('hasYearZero'),
    }
    const eraError = validateCalendarEra(era)
    if (eraError) {
      setMessage(eraError)
      return
    }

    const calendar: TimelineCalendar = { name: calendarName, months, weekdayNames, firstWeekday, epochWeekday, era }
    const calendars: Timeline['calendars'] = original ? [...original.calendars] : [calendar]
    if (original) calendars[editCalendarIndex] = calendar

    const timeline: Timeline = {
      ...original,
      name,
      startYear,
      endYear,
      daysPerYear,
      calendars,
    }

    if (timeline.events?.some((event) => validateEvent(event, timeline))) {
      setMessage(t('Новые настройки года выходят за пределы дат существующих событий.'))
      return
    }

    let id: string
    try {
      id = editing?.id ?? crypto.randomUUID()
      if (editing) {
        const latest = loadTimelines().entries.find((entry) => entry.id === id)
        if (!latest || timelineSnapshot(latest.timeline) !== timelineSnapshot(editing.timeline)) {
          setMessage(t('Таймлайн изменился в другой вкладке. Обновите страницу перед сохранением.'))
          return
        }
      }
      saveTimeline(id, timeline)
    } catch {
      setMessage(t('Не удалось сохранить таймлайн. Проверьте доступ к локальному хранилищу браузера и повторите попытку.'))
      return
    }

    const entry = { id, timeline }
    setLibrary((current) => ({
      ...current,
      entries: editing
        ? current.entries.map((item) => item.id === id ? entry : item)
        : [...current.entries, entry],
    }))
    selectTimeline(id, original ? editCalendarIndex : 0)
    setMessage('')
    dialogRef.current?.close()
  }

  function deleteSelectedTimeline() {
    if (!selected) return

    try {
      deleteTimeline(selected.id)
    } catch {
      setDeleteError(t('Не удалось удалить таймлайн из локального хранилища.'))
      return
    }

    const entries = library.entries.filter(({ id }) => id !== selected.id)
    setLibrary({ ...library, entries })
    selectTimeline(entries[0]?.id ?? '')
    setDeleteError('')
    deleteDialogRef.current?.close()
    createButtonRef.current?.focus()
  }

  function saveSelectedContent(update: (timeline: Timeline) => Timeline) {
    if (!selected) throw new Error(t('Выберите таймлайн.'))
    const { id } = selected
    const latest = loadTimelines().entries.find((item) => item.id === id)
    if (!latest || timelineSnapshot(latest.timeline) !== timelineSnapshot(selected.timeline)) {
      throw new Error(t('Таймлайн изменился в другой вкладке. Обновите страницу.'))
    }

    const timeline = removeMissingLoreLinks(update(latest.timeline))
    try {
      saveTimeline(id, timeline)
    } catch (error) {
      if (error instanceof DOMException) throw new Error(t('Не удалось записать изменения в хранилище браузера.'))
      throw error
    }
    setLibrary((current) => ({
      ...current,
      entries: current.entries.map((item) => item.id === id ? { id, timeline } : item),
    }))
  }

  function placeEvent(id: string) {
    try {
      saveSelectedContent((timeline) => ({
        ...timeline,
        events: timeline.events?.map((event) => event.id === id ? { ...event, onTimeline: true } : event),
      }))
      setEventPickerError('')
    } catch (error) {
      setEventPickerError(error instanceof Error ? error.message : t('Не удалось добавить событие на шкалу.'))
    }
  }

  function saveCharacters(characters: TimelineCharacter[]) {
    const ids = new Set(characters.map(({ id }) => id))
    saveSelectedContent((timeline) => ({
      ...timeline,
      characters: characters.map((character) => character.parentIds ? {
        ...character, parentIds: character.parentIds.filter((id) => ids.has(id)),
      } : character),
      chronicles: timeline.chronicles?.map((entry) => ({
        ...entry,
        characterIds: entry.characterIds?.filter((id) => ids.has(id)),
      })),
      items: timeline.items?.map((entry) => entry.ownerId && !ids.has(entry.ownerId)
        ? { ...entry, ownerId: undefined }
        : entry),
      organizations: timeline.organizations?.map((organization) => ({
        ...organization,
        memberIds: organization.memberIds.filter((id) => ids.has(id)),
      })),
      events: timeline.events?.map((event) => event.characterIds
        ? {
          ...event,
          characterIds: event.characterIds.filter((id) => ids.has(id)),
          sides: event.sides?.map((side) => ({
            ...side,
            characterIds: side.characterIds.filter((id) => ids.has(id)),
          })),
        }
        : event),
    }))
  }

  function downloadBackup(all = false) {
    if (!all && !selected) return
    const json = all ? exportAtlas(library.entries.map(({ timeline }) => timeline))
      : exportTimeline(selected!.timeline)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = all ? 'arena-atlas.json' : 'atlas-timeline.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function uploadBackup(input: HTMLInputElement) {
    const file = input.files?.[0]
    if (!file || importing) return
    setImporting(true)
    setBackupMessage('')
    try {
      const preview = previewBackup(await file.text())
      setBackupPreview(preview)
      backupDialogRef.current?.showModal()
    } catch {
      setBackupMessage(t('Не удалось прочитать копию. Проверьте JSON-файл.'))
    } finally {
      input.value = ''
      setImporting(false)
    }
  }


  function confirmBackup() {
    if (!backupPreview) return
    try {
      const entries = saveTimelineCopies(backupPreview)
      setLibrary((current) => ({ ...current, entries: [...current.entries, ...entries] }))
      if (entries[0]) selectTimeline(entries[0].id)
      setBackupMessage(`${t("Импортировано копий: ")}${entries.length}.`)
    } catch {
      setBackupMessage(t('Не удалось сохранить копии. Проверьте доступное место в хранилище браузера.'))
    }
    backupDialogRef.current?.close()
    setBackupPreview(null)
  }

  function addMonth() {
    const id = nextId.current++
    setMonthIds((ids) => [...ids, id])
    setMessage('')
  }

  function removeMonth(id: number) {
    setMonthIds((ids) => ids.filter((monthId) => monthId !== id))
    setMessage('')
  }

  function addWeekday() {
    const id = nextId.current++
    setWeekdays((days) => [...days, { id, name: '' }])
    setMessage('')
  }

  function removeWeekday(id: number) {
    setWeekdays((days) => days.filter((day) => day.id !== id))
    setMessage('')
  }

  function renameWeekday(id: number, name: string) {
    setWeekdays((days) => days.map((day) => day.id === id ? { id, name } : day))
  }

  function renderPage() {
    if (page !== 'timeline') {
      if (!selected) {
        return (
          <main className="section-page">
            <h1>{page === 'lore' ? t('Справочник мира') : page === 'chronicles' ? t('Летописи') : page === 'events' ? t('События') : page === 'organizations' ? t('Фракции и организации') : t('Персонажи')}</h1>
            <p>{t("Сначала создайте или импортируйте таймлайн.")}</p>
            <a href="#timeline">{t("К таймлайну")}</a>
          </main>
        )
      }

      if (page === 'lore') {
        const kind = loreSection === 'items' || loreSection === 'locations' ? loreSection : undefined
        return <LorePage key={JSON.stringify([selected.id, loreSection])} initialSection={loreSection}
          archive={kind && <ArchivePage embedded timeline={selected.timeline} kind={kind} entryId={entryId}
            entries={selected.timeline[kind] ?? []}
            save={(entries) => {
              const ids = new Set(entries.map(({ id }) => id))
              saveSelectedContent((timeline) => ({
                ...timeline,
                [kind]: entries,
                ...(kind === 'locations' && timeline.organizations ? {
                  organizations: timeline.organizations.map((organization) => organization.locationIds ? {
                    ...organization, locationIds: organization.locationIds.filter((id) => ids.has(id)),
                  } : organization),
                } : {}),
              }))
            }} />}
          timeline={selected.timeline} save={(lore, rename) => saveSelectedContent((timeline) => ({
            ...timeline,
            lore,
            ...(rename && timeline.characters ? {
              characters: timeline.characters.map((character) => sameHouse(character.dynasty, rename.from)
                ? { ...character, dynasty: rename.to } : character),
            } : {}),
          }))} />
      }

      if (page === 'chronicles') {
        return <ArchivePage key={selected.id}
          timeline={selected.timeline} kind="chronicles" entryId={entryId} entries={selected.timeline.chronicles ?? []}
          save={(entries) => {
            const ids = new Set(entries.map(({ id }) => id))
            saveSelectedContent((timeline) => ({
              ...timeline,
              chronicles: entries.map((entry) => entry.chronicleIds ? {
                ...entry, chronicleIds: entry.chronicleIds.filter((id) => ids.has(id)),
              } : entry),
            }))
          }} />
      }

      if (page === 'organizations') {
        return <OrganizationsPage key={JSON.stringify([selected.id, organizationId])} organizationId={organizationId} timeline={selected.timeline}
          save={(organizations) => {
            const remaining = new Set(organizations.map(({ id }) => id))
            saveSelectedContent((timeline) => ({
              ...timeline,
              organizations,
              events: timeline.events?.map((event) => ({
                ...event,
                sides: event.sides?.map((side) => {
                  if (!side.organizationId || remaining.has(side.organizationId)) return side
                  const name = timeline.organizations?.find(({ id }) => id === side.organizationId)?.name ?? side.name
                  return { ...side, name, organizationId: undefined }
                }),
              })),
            }))
          }} />
      }

      if (page === 'characters') {
        return <CharactersPage key={selected.id} characterId={characterId} familyOpen={familyOpen} timeline={selected.timeline} save={saveCharacters} />
      }

      return (
        <EventsPage
          key={JSON.stringify([selected.id, eventYear, eventId])}
          yearFilter={eventYear}
          eventId={eventId}
          timeline={selected.timeline}
          calendar={selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]}
          save={(events: TimelineEvent[]) => {
            const ids = new Set(events.map(({ id }) => id))
            saveSelectedContent((timeline) => ({
              ...timeline,
              events,
              chronicles: timeline.chronicles?.map((entry) => ({
                ...entry,
                eventIds: entry.eventIds?.filter((id) => ids.has(id)),
              })),
            }))
          }}
        />
      )
    }


    return (
      <main className={selected ? 'timeline-library' : 'start-screen'}>
        <div className={selected ? "timeline-toolbar calendar-toolbar" : "timeline-toolbar"}>
          {selected && (
            <>
            <label className="timeline-select">
              <span>{t("Календарь")}</span>
              <select value={calendarIndex} onChange={(event) => selectTimeline(selectedId, Number(event.currentTarget.value))}>
                {selected.timeline.calendars.map((calendar, index) => (
                  <option key={index} value={index}>{index + 1}. {displayCalendarName(calendar.name)}</option>
                ))}
              </select>
            </label>
            <button className="calendar-action" type="button" title={t("Создать календарь в текущем таймлайне")} onClick={() => openForm(selected, selected.timeline.calendars.length)}>{t("Добавить календарь")}</button>
            <button className="calendar-action" type="button" title={t("Выбрать событие для шкалы")} onClick={() => {
              setEventPickerError('')
              eventPickerRef.current?.showModal()
            }}>{t("Добавить событие")}</button>
            </>
          )}
          {selected && (
            <label className="timeline-select">
              <span>{t("Таймлайн")}</span>
              <select value={selectedId} onChange={(event) => selectTimeline(event.currentTarget.value)}>
                {library.entries.map(({ id, timeline }) => (
                  <option key={id} value={id}>
                    {timeline.name} ({timeline.startYear} — {timeline.endYear})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button ref={createButtonRef} type="button" title={t("Создать новый таймлайн")} onClick={() => openForm()}>{t("Создать таймлайн")}</button>
          {selected && (
            <button type="button" title={t("Изменить настройки текущего таймлайна")} onClick={() => openForm(selected)}>{t("Настройки таймлайна")}</button>
          )}
          {selected && (
            <button className="timeline-delete" type="button" aria-label={t("Удалить текущий таймлайн")} title={t("Удалить текущий таймлайн")} onClick={() => {
              setDeleteError('')
              deleteDialogRef.current?.showModal()
            }}>
              <TrashIcon />
            </button>
          )}
          {backupMessage && <p role="status">{backupMessage}</p>}
          {library.warning && <p role="status">{library.warning}</p>}
        </div>

        {selected && (
          <>
            <TimelineScale
              key={selected.id}
              timeline={selected.timeline}
              calendar={selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]}
            />
            <div className="timeline-maps">
              <section className="timeline-map" aria-labelledby="world-map-title">
                <h2 id="world-map-title">{t("Карта мира")}</h2>
                <WorldMap />
              </section>
              <TimelineLocationMap key={selected.id} locations={selected.timeline.locations} />
            </div>
          </>
        )}

        <dialog ref={eventPickerRef} aria-labelledby="event-picker-title">
          <h2 id="event-picker-title">{t("События таймлайна")}</h2>
          {selected && (selected.timeline.events?.length ? (
            <ul className="event-list">
              {[...selected.timeline.events].sort((left, right) =>
                left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1)
              ).map((event) => (
                <li key={event.id}>
                  <strong>{event.title}</strong>
                  <p>{t("Системный год ")}{event.year}
                    {event.date && ` · ${calendarDay(
                      (selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]).months,
                      event.date.first,
                    )}`}
                  </p>
                  {event.onTimeline === false ? (
                    <button type="button" onClick={() => placeEvent(event.id)}>{t("Добавить на таймлайн")}</button>
                  ) : <span>{t("Уже на таймлайне")}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="event-picker-empty">{t("Перейдите во вкладку «События».")}</p>)}
          {eventPickerError && <p role="alert">{eventPickerError}</p>}
          <button type="button" onClick={() => eventPickerRef.current?.close()}>{t("Закрыть")}</button>
        </dialog>

        <dialog ref={deleteDialogRef} aria-labelledby="delete-title" aria-describedby="delete-description">
          <h2 id="delete-title">{t("Удалить таймлайн?")}</h2>
          <p id="delete-description">{t("Таймлайн «")}{selected?.timeline.name}{t("» вместе с календарями, событиями и персонажами будет удалён без возможности восстановления.")}</p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <button type="button" autoFocus onClick={() => deleteDialogRef.current?.close()}>{t("Отмена")}</button>{' '}
          <button type="button" onClick={deleteSelectedTimeline}>{t("Удалить")}</button>
        </dialog>

        <dialog ref={dialogRef} aria-labelledby="timeline-form-title">
          <h1 id="timeline-form-title">{addingCalendar ? t('Добавить календарь') : editing ? t('Настройки таймлайна') : t('Создать таймлайн')}</h1>

          <form key={formVersion} onSubmit={submitTimeline} onInput={() => setMessage('')}>
            <p>
              <label>{t("Название таймлайна")}<br /><input name="name" defaultValue={original?.name} required /></label>
            </p>
            <p>
              <label>{t("Начальный год")}<br /><input name="startYear" defaultValue={original?.startYear} type="number" step={1} required /></label>
            </p>
            <p>
              <label>{t("Конечный год")}<br /><input name="endYear" defaultValue={original?.endYear} type="number" step={1} required /></label>
            </p>
            {editing && <p>{t("Начальный год можно сдвинуть назад, конечный — вперёд.")}</p>}
            <p>
              <label>{t("Название календаря")}<br />
                <input name="calendarName" defaultValue={originalCalendar ? displayCalendarName(originalCalendar.name) : (addingCalendar ? '' : t('Основной календарь'))} required />
              </label>
            </p>
            {original && <p>{t("Общая продолжительность года: ")}{original.daysPerYear}{t(" дней.")}</p>}
            <fieldset>
              <legend>{t("Тип года")}</legend>
              <label>
                <input
                  type="radio"
                  name="yearMode"
                  checked={yearMode === 'standard'}
                  disabled={fixedYearLength && original?.daysPerYear !== standardYear.daysPerYear}
                  onChange={() => setYearMode('standard')}
                />
                {' '}{t("Стандартный год")}</label>
              <br />
              <label>
                <input
                  type="radio"
                  name="yearMode"
                  checked={yearMode === 'custom'}
                  onChange={() => setYearMode('custom')}
                />
                {' '}{editing ? t('Свой календарь') : t('Создать свой')}
              </label>
              {yearMode === 'standard' && (
                <p>{t("365 дней, 12 месяцев, 7 дней в неделе. Первый день недели и начало системного года 0 — понедельник.")}</p>
              )}
            </fieldset>

            <fieldset hidden={yearMode !== 'custom'} disabled={yearMode !== 'custom'}>
              <legend>{t("Свой календарь")}</legend>
              <p>
                <label>{t("Дней в году")}<br /><input name="daysPerYear" defaultValue={original?.daysPerYear} readOnly={fixedYearLength} type="number" min={1} step={1} required /></label>
              </p>

              <fieldset>
                <legend>{t("Месяцы календаря (")}{monthIds.length})</legend>
                {monthIds.map((id, index) => (
                  <fieldset key={id}>
                    <legend>{t("Месяц ")}{index + 1}</legend>
                    <p>
                      <label>{t("Название месяца")}<br />
                        <input name={`month-name-${id}`} defaultValue={displayMonthName(originalCalendar?.months[id - 1]?.name ?? '')} required />
                      </label>
                    </p>
                    <p>
                      <label>{t("Дней в месяце")}<br />
                        <input name={`month-days-${id}`} defaultValue={originalCalendar?.months[id - 1]?.days} type="number" min={1} step={1} required />
                      </label>
                    </p>
                    {monthIds.length > 1 && (
                      <button type="button" onClick={() => removeMonth(id)}>{t("Удалить месяц ")}{index + 1}
                      </button>
                    )}
                  </fieldset>
                ))}
                <p><button type="button" onClick={addMonth}>{t("Добавить месяц")}</button></p>
              </fieldset>

              <fieldset>
                <legend>{t("Дни недели (")}{weekdays.length})</legend>
                {weekdays.map(({ id, name }, index) => (
                  <p key={id}>
                    <label>{t("Название дня ")}{index + 1}<br />
                      <input value={displayWeekdayName(name)} onChange={(event) => renameWeekday(id, event.currentTarget.value)} required />
                    </label>{' '}
                    {weekdays.length > 1 && (
                      <button type="button" onClick={() => removeWeekday(id)}>{t("Удалить день ")}{index + 1}
                      </button>
                    )}
                  </p>
                ))}
                <p><button type="button" onClick={addWeekday}>{t("Добавить день недели")}</button></p>

                {[
                  { field: 'firstWeekday', label: t('Первый день недели') },
                  { field: 'epochWeekday', label: t('День недели в первый день системного года 0') },
                ].map(({ field, label }) => (
                  <p key={field}>
                    <label>
                      {label}<br />
                      <select name={field} defaultValue={originalCalendar ? (field === 'firstWeekday' ? originalCalendar.firstWeekday : originalCalendar.epochWeekday) + 1 : 1} onChange={() => setMessage('')}>
                        {weekdays.map(({ id, name }, index) => (
                          <option key={id} value={id}>{index + 1}. {displayWeekdayName(name.trim()) || t('Без названия')}</option>
                        ))}
                      </select>
                    </label>
                  </p>
                ))}
              </fieldset>
            </fieldset>

            <fieldset>
              <legend>{t("Летосчисление календаря")}</legend>
              <p>
                <label>{t("Системный год точки отсчёта")}<br />
                  <input name="systemAnchorYear" type="number" step={1} defaultValue={originalCalendar?.era.systemAnchorYear ?? 0} required />
                </label>
              </p>
              <p>
                <label>{t("Соответствующий год в календаре")}<br />
                  <input name="calendarAnchorYear" type="number" step={1} defaultValue={originalCalendar?.era.calendarAnchorYear ?? 0} required />
                </label>
              </p>
              <p>
                <label>
                  <input name="hasYearZero" type="checkbox" defaultChecked={originalCalendar?.era.hasYearZero ?? true} />
                  {' '}{t("В календаре есть год 0")}</label>
              </p>
            </fieldset>

            <p role="status">{message}</p>
            <button type="submit">{addingCalendar ? t('Добавить календарь') : editing ? t('Сохранить изменения') : t('Создать таймлайн')}</button>{' '}
            <button type="button" onClick={() => dialogRef.current?.close()}>{t("Закрыть")}</button>
          </form>
        </dialog>
      </main>
    )
  }

  return (
    <>
      {backupTools && createPortal(
        <>
          <BackupButton icon="⇩" label={english ? 'Export current timeline to JSON' : 'Экспорт текущего таймлайна в JSON'} disabled={!selected} onClick={() => downloadBackup()} />
          <BackupButton icon="▤" label={english ? 'Export all timelines to JSON' : 'Сохранить весь атлас в JSON'} disabled={!selected} onClick={() => downloadBackup(true)} />
          <BackupButton icon="⇧" label={english ? 'Import JSON backup' : 'Импорт резервной копии JSON'}
            disabled={importing} onClick={() => importInputRef.current?.click()} />
        </>,
        backupTools,
      )}
      <input ref={importInputRef} hidden type="file" accept=".json,application/json" disabled={importing}
        onChange={(event) => void uploadBackup(event.currentTarget)} />
      <dialog ref={backupDialogRef} aria-labelledby="backup-preview-title" onClose={() => setBackupPreview(null)}>
        <h2 id="backup-preview-title">{t("Предпросмотр импорта")}</h2>
        <p>{t("Таймлайны будут добавлены как отдельные копии.")}</p>
        <ul>
          {backupPreview?.map((timeline, index) => (
            <li key={index}>
              <strong>{timeline.name}</strong> · {timeline.startYear} — {timeline.endYear}
              <br />{t("Календари: ")}{timeline.calendars.length}{t(", события: ")}{timeline.events?.length ?? 0}{t(", персонажи: ")}{timeline.characters?.length ?? 0}{t(", организации: ")}{timeline.organizations?.length ?? 0}{t(", летописи: ")}{timeline.chronicles?.length ?? 0}{t(", предметы: ")}{timeline.items?.length ?? 0}
            </li>
          ))}
        </ul>
        <button type="button" autoFocus onClick={() => backupDialogRef.current?.close()}>{t("Отмена")}</button>{' '}
        <button type="button" onClick={confirmBackup}>{t("Импортировать копии")}</button>
      </dialog>
      {page !== 'timeline' && backupMessage && <p className="backup-status" role="status">{backupMessage}</p>}
      {selected && page !== 'lore' && (
        <div className="entry-filter">
          <label>{t("Показывать ")}<select value={entryFilter} onChange={(event) => {
            const status = event.currentTarget.value
            setEntryFilter(status === 'canon' || status === 'draft' ? status : 'all')
          }}>
            <option value="all">{t("Все записи")}</option>
            <option value="canon">{t("Канон")}</option>
            <option value="draft">{t("Черновики")}</option>
          </select></label>
        </div>
      )}
      <StatusFilter.Provider value={entryFilter}>{renderPage()}</StatusFilter.Provider>
    </>
  )
}

export default App

function BackupButton({ icon, label, onClick, disabled }: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
