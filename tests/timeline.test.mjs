import assert from 'node:assert/strict'
import { test } from 'node:test'
import { standardYear, validateMonths, validateWeek } from '../src/domain/calendar.ts'
import { toCalendarYear } from '../src/domain/calendarYear.ts'
import { validateTimelineBounds } from '../src/domain/timeline.ts'
import { deleteTimeline, loadTimelines, rememberSelection, restoreSelection, saveTimeline } from '../src/data/timelineStorage.ts'

const era = { systemAnchorYear: 100, calendarAnchorYear: 1, hasYearZero: false }

test('Местные годы до и после точки отсчёта без года 0', () => {
  assert.deepEqual([98, 99, 100, 101].map((year) => toCalendarYear(year, era)), [-2n, -1n, 1n, 2n])
  assert.throws(() => toCalendarYear(100, { ...era, calendarAnchorYear: 0 }), RangeError)
})

test('Местный год 0 и точность для крайних значений', () => {
  assert.equal(toCalendarYear(99, { ...era, hasYearZero: true }), 0n)
  const max = Number.MAX_SAFE_INTEGER
  assert.equal(toCalendarYear(max, { ...era, systemAnchorYear: -max }), 2n * BigInt(max) + 1n)
})

test('Сумма дней месяцев и настройки недели', () => {
  assert.equal(validateMonths(standardYear.months, 365), null)
  assert.match(validateMonths(standardYear.months, 366), /не хватает/)
  assert.match(validateMonths(standardYear.months, 364), /превышает/)
  assert.equal(validateWeek(['Рассвет', 'Закат'], 0, 1), null)
  assert.match(validateWeek(['Рассвет', 'Закат'], 0, 2), /системного года 0/)
})

test('Границы можно расширять в обе стороны и оставлять прежними', () => {
  const original = { startYear: -10, endYear: 0 }
  assert.equal(validateTimelineBounds(-20, 10, original), null)
  assert.equal(validateTimelineBounds(-10, 0, original), null)
  assert.match(validateTimelineBounds(-9, 10, original), /весь текущий диапазон/)
  assert.match(validateTimelineBounds(-20, -1, original), /весь текущий диапазон/)
  assert.match(validateTimelineBounds(1, 0), /не раньше/)
  assert.match(validateTimelineBounds(-1.5, 0), /целые годы/)
})

test('Правки переживают повторную загрузку и сохраняют соседние записи', () => {
  const data = new Map()
  const storage = {
    get length() { return data.size },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
  const { daysPerYear, ...calendar } = standardYear
  const timeline = { name: 'Арена', startYear: -10, endYear: 0, daysPerYear, calendar: { ...calendar, era } }
  const main = { ...timeline.calendar, name: 'Основной календарь' }
  const northern = { ...main, name: 'Календарь Севера', months: [{ name: 'Зима', days: 365 }] }
  const updated = {
    name: timeline.name,
    startYear: -20,
    endYear: timeline.endYear,
    daysPerYear,
    calendars: [{ ...main, era: { ...era, calendarAnchorYear: 5 } }, northern],
  }

  data.set('arena-atlas:timeline:v1:second', JSON.stringify(timeline))
  data.set('arena-atlas:timeline:v1:first', JSON.stringify(timeline))
  saveTimeline('first', updated, storage)
  data.set('arena-atlas:timeline:v1:broken', '{')
  data.set('arena-atlas:timeline:v1:wrong-year', JSON.stringify({ ...updated, daysPerYear: 360 }))
  data.set('arena-atlas:timeline:v1:no-calendars', JSON.stringify({ ...updated, calendars: [] }))

  assert.deepEqual(loadTimelines(storage), {
    entries: [
      { id: 'second', timeline: { name: timeline.name, startYear: -10, endYear: 0, daysPerYear, calendars: [main] } },
      { id: 'first', timeline: updated },
    ],
    skipped: 3,
  })
})

test('Выбранный календарь восстанавливается, устаревший индекс сбрасывается', () => {
  let json = null
  const storage = { getItem: () => json, setItem: (_, value) => { json = value } }
  const entries = [
    { id: 'first', timeline: { calendars: [{}] } },
    { id: 'second', timeline: { calendars: [{}, {}] } },
  ]

  rememberSelection({ id: 'second', calendarIndex: 1 }, storage)
  assert.deepEqual(restoreSelection(entries, storage), { id: 'second', calendarIndex: 1 })

  rememberSelection({ id: 'second', calendarIndex: 2 }, storage)
  assert.deepEqual(restoreSelection(entries, storage), { id: 'second', calendarIndex: 0 })
  assert.deepEqual(restoreSelection(entries.slice(0, 1), storage), { id: 'first', calendarIndex: 0 })

  json = '{'
  assert.deepEqual(restoreSelection(entries, storage), { id: 'first', calendarIndex: 0 })
  assert.deepEqual(restoreSelection([], storage), { id: '', calendarIndex: 0 })
})

test('Удаление затрагивает только выбранный таймлайн', () => {
  const keys = new Set(['arena-atlas:timeline:v1:first', 'arena-atlas:timeline:v1:second', 'other'])
  const storage = { removeItem: (key) => keys.delete(key) }

  deleteTimeline('first', storage)
  assert.deepEqual([...keys], ['arena-atlas:timeline:v1:second', 'other'])
  assert.throws(() => deleteTimeline(' ', storage), /идентификатор/)
})
