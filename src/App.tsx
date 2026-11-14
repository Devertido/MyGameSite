import { useRef, useState, type FormEvent } from 'react'
import { standardYear, validateMonths, validateWeek } from './domain/calendar'
import { TimelineScale } from './components/TimelineScale'
import { validateCalendarEra } from './domain/calendarYear'
import { validateTimelineBounds, type Timeline } from './domain/timeline'
import { loadTimelines, saveTimeline } from './data/timelineStorage'

function App() {
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
  const [selectedId, setSelectedId] = useState(library.entries[0]?.id ?? '')
  const selected = library.entries.find(({ id }) => id === selectedId)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<typeof selected>(undefined)
  const [formVersion, setFormVersion] = useState(0)
  const original = editing?.timeline

  function openForm(entry?: NonNullable<typeof selected>) {
    const calendar = entry?.timeline.calendar
    setEditing(entry)
    setYearMode(calendar ? 'custom' : 'standard')
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
    const daysPerYear = useStandardYear ? standardYear.daysPerYear : Number(fields.get('daysPerYear'))

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

    const timeline: Timeline = {
      name,
      startYear,
      endYear,
      daysPerYear,
      calendar: { months, weekdayNames, firstWeekday, epochWeekday, era },
    }

    let id: string
    try {
      id = editing?.id ?? crypto.randomUUID()
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
    setSelectedId(id)
    setMessage('')
    dialogRef.current?.close()
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

  return (
    <main className={selected ? 'timeline-library' : 'start-screen'}>
      <div className="timeline-toolbar">
        {selected && (
          <label>
            Таймлайн{' '}
            <select value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)}>
              {library.entries.map(({ id, timeline }) => (
                <option key={id} value={id}>
                  {timeline.name} ({timeline.startYear} — {timeline.endYear})
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={() => openForm()}>
          Создать таймлайн
        </button>
        {selected && (
          <button type="button" onClick={() => openForm(selected)}>
            Настройки таймлайна
          </button>
        )}
        {library.warning && <p role="status">{library.warning}</p>}
      </div>

      {selected && <TimelineScale key={selected.id} timeline={selected.timeline} />}

      <dialog ref={dialogRef} aria-labelledby="timeline-form-title">
        <h1 id="timeline-form-title">{editing ? 'Настройки таймлайна' : 'Создать таймлайн'}</h1>

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
          <fieldset>
            <legend>Тип года</legend>
            <label>
              <input
                type="radio"
                name="yearMode"
                checked={yearMode === 'standard'}
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
              <label>Дней в году<br /><input name="daysPerYear" defaultValue={original?.daysPerYear} type="number" min={1} step={1} required /></label>
            </p>

            <fieldset>
              <legend>Месяцы календаря ({monthIds.length})</legend>
              {monthIds.map((id, index) => (
                <fieldset key={id}>
                  <legend>Месяц {index + 1}</legend>
                  <p>
                    <label>
                      Название месяца<br />
                      <input name={`month-name-${id}`} defaultValue={original?.calendar.months[id - 1]?.name} required />
                    </label>
                  </p>
                  <p>
                    <label>
                      Дней в месяце<br />
                      <input name={`month-days-${id}`} defaultValue={original?.calendar.months[id - 1]?.days} type="number" min={1} step={1} required />
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
                    <select name={field} defaultValue={original ? (field === 'firstWeekday' ? original.calendar.firstWeekday : original.calendar.epochWeekday) + 1 : 1} onChange={() => setMessage('')}>
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
                <input name="systemAnchorYear" type="number" step={1} defaultValue={original?.calendar.era.systemAnchorYear ?? 0} required />
              </label>
            </p>
            <p>
              <label>
                Соответствующий год в календаре<br />
                <input name="calendarAnchorYear" type="number" step={1} defaultValue={original?.calendar.era.calendarAnchorYear ?? 0} required />
              </label>
            </p>
            <p>
              <label>
                <input name="hasYearZero" type="checkbox" defaultChecked={original?.calendar.era.hasYearZero ?? true} />
                {' '}В календаре есть год 0
              </label>
            </p>
          </fieldset>

          <p role="status">{message}</p>
          <button type="submit">{editing ? 'Сохранить изменения' : 'Создать таймлайн'}</button>{' '}
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Закрыть
          </button>
        </form>
      </dialog>
    </main>
  )
}

export default App
