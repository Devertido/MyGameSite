import { useRef, useState, type FormEvent } from 'react'
import { standardYear, validateMonths, validateWeek } from './domain/calendar'
import { CharactersPage } from './components/CharactersPage'
import { EventsPage } from './components/EventsPage'
import { TimelineScale } from './components/TimelineScale'
import { validateCalendarEra } from './domain/calendarYear'
import { calendarDay, validateEvent, validateTimelineBounds, type Timeline, type TimelineCalendar, type TimelineEvent, type TimelineCharacter } from './domain/timeline'
import { deleteTimeline, exportTimeline, importTimeline, loadTimelines, rememberSelection, restoreSelection, saveTimeline } from './data/timelineStorage'

function timelineSnapshot({ name, startYear, endYear, daysPerYear, calendars, events, characters }: Timeline) {
  return JSON.stringify([name, startYear, endYear, daysPerYear, calendars, events, characters])
}

function App({ page, eventYear }: { page: 'timeline' | 'events' | 'characters'; eventYear?: number }) {
  const [backupMessage, setBackupMessage] = useState('')
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
      const warning = skipped ? `Не удалось прочитать записей: ${skipped}.` : ''
      return { entries, warning }
    } catch {
      return { entries: [], warning: 'Локальное хранилище недоступно.' }
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
    const calendarName = String(fields.get('calendarName') ?? '').trim()
    if (!calendarName) {
      setMessage('Введите название календаря.')
      return
    }

    if (!name) {
      setMessage('Введите название таймлайна.')
      return
    }

    const boundsError = validateTimelineBounds(startYear, endYear, original)
    if (boundsError) {
      setMessage(boundsError)
      return
    }

    // Идентификаторы строк сохраняют введённые значения при удалении соседней строки.
    const months = useStandardYear ? standardYear.months : monthIds.map((id) => ({
      name: String(fields.get(`month-name-${id}`) ?? ''),
      days: Number(fields.get(`month-days-${id}`)),
    }))
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
      setMessage('Новые настройки года выходят за пределы дат существующих событий.')
      return
    }

    let id: string
    try {
      id = editing?.id ?? crypto.randomUUID()
      if (editing) {
        const latest = loadTimelines().entries.find((entry) => entry.id === id)
        if (!latest || timelineSnapshot(latest.timeline) !== timelineSnapshot(editing.timeline)) {
          setMessage('Таймлайн изменился в другой вкладке. Обновите страницу перед сохранением.')
          return
        }
      }
      saveTimeline(id, timeline)
    } catch {
      setMessage('Не удалось сохранить таймлайн. Проверьте доступ к локальному хранилищу браузера и повторите попытку.')
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
      setDeleteError('Не удалось удалить таймлайн из локального хранилища.')
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
    if (!selected) throw new Error('Выберите таймлайн.')
    const { id } = selected
    const latest = loadTimelines().entries.find((item) => item.id === id)
    if (!latest || timelineSnapshot(latest.timeline) !== timelineSnapshot(selected.timeline)) {
      throw new Error('Таймлайн изменился в другой вкладке. Обновите страницу.')
    }

    const timeline = update(latest.timeline)
    try {
      saveTimeline(id, timeline)
    } catch {
      throw new Error('Не удалось сохранить изменения в браузере.')
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
      setEventPickerError(error instanceof Error ? error.message : 'Не удалось добавить событие на шкалу.')
    }
  }

  function saveCharacters(characters: TimelineCharacter[]) {
    const ids = new Set(characters.map(({ id }) => id))
    saveSelectedContent((timeline) => ({
      ...timeline,
      characters,
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

  function downloadBackup() {
    if (!selected) return
    const url = URL.createObjectURL(new Blob([exportTimeline(selected.timeline)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'atlas-timeline.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function uploadBackup(input: HTMLInputElement) {
    const file = input.files?.[0]
    if (!file || importing) return
    setImporting(true)
    setBackupMessage('')
    try {
      const timeline = importTimeline(await file.text())
      const copy = { ...timeline, name: timeline.name + ' (копия)' }
      const id = crypto.randomUUID()
      saveTimeline(id, copy)
      setLibrary((current) => ({ ...current, entries: [...current.entries, { id, timeline: copy }] }))
      selectTimeline(id)
      setBackupMessage('Копия таймлайна импортирована.')
    } catch {
      setBackupMessage('Не удалось импортировать таймлайн. Проверьте JSON-файл и доступность хранилища.')
    } finally {
      input.value = ''
      setImporting(false)
    }
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

  if (page !== 'timeline') {
    if (!selected) {
      return (
        <main className="section-page">
          <h1>{page === 'events' ? 'События' : 'Персонажи'}</h1>
          <p>Сначала создайте или импортируйте таймлайн.</p>
          <a href="#timeline">К таймлайну</a>
        </main>
      )
    }

    if (page === 'characters') {
      return <CharactersPage key={selected.id} timeline={selected.timeline} save={saveCharacters} />
    }

    return (
      <EventsPage
        key={JSON.stringify([selected.id, eventYear])}
        yearFilter={eventYear}
        timeline={selected.timeline}
        calendar={selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]}
        save={(events: TimelineEvent[]) => saveSelectedContent((timeline) => ({ ...timeline, events }))}
      />
    )
  }


  return (
    <main className={selected ? 'timeline-library' : 'start-screen'}>
      <div className="timeline-toolbar">
        {selected && (
          <label>
            Таймлайн{' '}
            <select value={selectedId} onChange={(event) => selectTimeline(event.currentTarget.value)}>
              {library.entries.map(({ id, timeline }) => (
                <option key={id} value={id}>
                  {timeline.name} ({timeline.startYear} — {timeline.endYear})
                </option>
              ))}
            </select>
          </label>
        )}
        <button ref={createButtonRef} type="button" onClick={() => openForm()}>
          Создать таймлайн
        </button>
        {selected && (
          <button type="button" onClick={() => openForm(selected)}>
            Настройки таймлайна
          </button>
        )}
        {selected && (
          <button type="button" onClick={() => {
            setDeleteError('')
            deleteDialogRef.current?.showModal()
          }}>
            Удалить таймлайн
          </button>
        )}
        {selected && <button type="button" onClick={downloadBackup}>Экспорт JSON</button>}
        <button type="button" disabled={importing} onClick={() => importInputRef.current?.click()}>
          {importing ? 'Импортируем…' : 'Импорт JSON'}
        </button>
        <input ref={importInputRef} hidden type="file" accept=".json,application/json" disabled={importing}
          onChange={(event) => void uploadBackup(event.currentTarget)} />
        {backupMessage && <p role="status">{backupMessage}</p>}
        {library.warning && <p role="status">{library.warning}</p>}
      </div>

      {selected && (
        <>
          <div className="timeline-toolbar calendar-toolbar">
            <label>
              Календарь{' '}
              <select value={calendarIndex} onChange={(event) => selectTimeline(selectedId, Number(event.currentTarget.value))}>
                {selected.timeline.calendars.map((calendar, index) => (
                  <option key={index} value={index}>{index + 1}. {calendar.name}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => openForm(selected, selected.timeline.calendars.length)}>
              Добавить календарь
            </button>
            <button type="button" onClick={() => {
              setEventPickerError('')
              eventPickerRef.current?.showModal()
            }}>
              Добавить событие
            </button>
          </div>
          <TimelineScale
            key={selected.id}
            timeline={selected.timeline}
            calendar={selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]}
          />
        </>
      )}

      <dialog ref={eventPickerRef} aria-labelledby="event-picker-title">
        <h2 id="event-picker-title">События таймлайна</h2>
        {selected && (selected.timeline.events?.length ? (
          <ul className="event-list">
            {[...selected.timeline.events].sort((left, right) =>
              left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1)
            ).map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                <p>
                  Системный год {event.year}
                  {event.date && ` · ${calendarDay(
                    (selected.timeline.calendars[calendarIndex] ?? selected.timeline.calendars[0]).months,
                    event.date.first,
                  )}`}
                </p>
                {event.onTimeline === false ? (
                  <button type="button" onClick={() => placeEvent(event.id)}>Добавить на таймлайн</button>
                ) : <span>Уже на таймлайне</span>}
              </li>
            ))}
          </ul>
        ) : <p className="event-picker-empty">Перейдите во вкладку «События».</p>)}
        {eventPickerError && <p role="alert">{eventPickerError}</p>}
        <button type="button" onClick={() => eventPickerRef.current?.close()}>Закрыть</button>
      </dialog>

      <dialog ref={deleteDialogRef} aria-labelledby="delete-title" aria-describedby="delete-description">
        <h2 id="delete-title">Удалить таймлайн?</h2>
        <p id="delete-description">
          Таймлайн «{selected?.timeline.name}» вместе с календарями, событиями и персонажами будет удалён без возможности восстановления.
        </p>
        {deleteError && <p role="alert">{deleteError}</p>}
        <button type="button" autoFocus onClick={() => deleteDialogRef.current?.close()}>
          Отмена
        </button>{' '}
        <button type="button" onClick={deleteSelectedTimeline}>Удалить</button>
      </dialog>

      <dialog ref={dialogRef} aria-labelledby="timeline-form-title">
        <h1 id="timeline-form-title">{addingCalendar ? 'Добавить календарь' : editing ? 'Настройки таймлайна' : 'Создать таймлайн'}</h1>

        <form key={formVersion} onSubmit={submitTimeline} onInput={() => setMessage('')}>
          <p>
            <label>Название таймлайна<br /><input name="name" defaultValue={original?.name} required /></label>
          </p>
          <p>
            <label>Начальный год<br /><input name="startYear" defaultValue={original?.startYear} type="number" step={1} required /></label>
          </p>
          <p>
            <label>Конечный год<br /><input name="endYear" defaultValue={original?.endYear} type="number" step={1} required /></label>
          </p>
          {editing && <p>Начальный год можно сдвинуть назад, конечный — вперёд.</p>}
          <p>
            <label>
              Название календаря<br />
              <input name="calendarName" defaultValue={originalCalendar?.name ?? (addingCalendar ? '' : 'Основной календарь')} required />
            </label>
          </p>
          {original && <p>Общая продолжительность года: {original.daysPerYear} дней.</p>}
          <fieldset>
            <legend>Тип года</legend>
            <label>
              <input
                type="radio"
                name="yearMode"
                checked={yearMode === 'standard'}
                disabled={fixedYearLength && original?.daysPerYear !== standardYear.daysPerYear}
                onChange={() => setYearMode('standard')}
              />
              {' '}Стандартный год
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="yearMode"
                checked={yearMode === 'custom'}
                onChange={() => setYearMode('custom')}
              />
              {' '}{editing ? 'Свой календарь' : 'Создать свой'}
            </label>
            {yearMode === 'standard' && (
              <p>365 дней, 12 месяцев, 7 дней в неделе. Первый день недели и начало системного года 0 — понедельник.</p>
            )}
          </fieldset>

          <fieldset hidden={yearMode !== 'custom'} disabled={yearMode !== 'custom'}>
            <legend>Свой календарь</legend>
            <p>
              <label>Дней в году<br /><input name="daysPerYear" defaultValue={original?.daysPerYear} readOnly={fixedYearLength} type="number" min={1} step={1} required /></label>
            </p>

            <fieldset>
              <legend>Месяцы календаря ({monthIds.length})</legend>
              {monthIds.map((id, index) => (
                <fieldset key={id}>
                  <legend>Месяц {index + 1}</legend>
                  <p>
                    <label>
                      Название месяца<br />
                      <input name={`month-name-${id}`} defaultValue={originalCalendar?.months[id - 1]?.name} required />
                    </label>
                  </p>
                  <p>
                    <label>
                      Дней в месяце<br />
                      <input name={`month-days-${id}`} defaultValue={originalCalendar?.months[id - 1]?.days} type="number" min={1} step={1} required />
                    </label>
                  </p>
                  {monthIds.length > 1 && (
                    <button type="button" onClick={() => removeMonth(id)}>
                      Удалить месяц {index + 1}
                    </button>
                  )}
                </fieldset>
              ))}
              <p><button type="button" onClick={addMonth}>Добавить месяц</button></p>
            </fieldset>

            <fieldset>
              <legend>Дни недели ({weekdays.length})</legend>
              {weekdays.map(({ id, name }, index) => (
                <p key={id}>
                  <label>
                    Название дня {index + 1}<br />
                    <input value={name} onChange={(event) => renameWeekday(id, event.currentTarget.value)} required />
                  </label>{' '}
                  {weekdays.length > 1 && (
                    <button type="button" onClick={() => removeWeekday(id)}>
                      Удалить день {index + 1}
                    </button>
                  )}
                </p>
              ))}
              <p><button type="button" onClick={addWeekday}>Добавить день недели</button></p>

              {[
                { field: 'firstWeekday', label: 'Первый день недели' },
                { field: 'epochWeekday', label: 'День недели в первый день системного года 0' },
              ].map(({ field, label }) => (
                <p key={field}>
                  <label>
                    {label}<br />
                    <select name={field} defaultValue={originalCalendar ? (field === 'firstWeekday' ? originalCalendar.firstWeekday : originalCalendar.epochWeekday) + 1 : 1} onChange={() => setMessage('')}>
                      {weekdays.map(({ id, name }, index) => (
                        <option key={id} value={id}>{index + 1}. {name.trim() || 'Без названия'}</option>
                      ))}
                    </select>
                  </label>
                </p>
              ))}
            </fieldset>
          </fieldset>

          <fieldset>
            <legend>Летосчисление календаря</legend>
            <p>
              <label>
                Системный год точки отсчёта<br />
                <input name="systemAnchorYear" type="number" step={1} defaultValue={originalCalendar?.era.systemAnchorYear ?? 0} required />
              </label>
            </p>
            <p>
              <label>
                Соответствующий год в календаре<br />
                <input name="calendarAnchorYear" type="number" step={1} defaultValue={originalCalendar?.era.calendarAnchorYear ?? 0} required />
              </label>
            </p>
            <p>
              <label>
                <input name="hasYearZero" type="checkbox" defaultChecked={originalCalendar?.era.hasYearZero ?? true} />
                {' '}В календаре есть год 0
              </label>
            </p>
          </fieldset>

          <p role="status">{message}</p>
          <button type="submit">{addingCalendar ? 'Добавить календарь' : editing ? 'Сохранить изменения' : 'Создать таймлайн'}</button>{' '}
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Закрыть
          </button>
        </form>
      </dialog>
    </main>
  )
}

export default App
