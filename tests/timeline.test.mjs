import assert from 'node:assert/strict'
import { test } from 'node:test'
import { standardYear, validateMonths, validateWeek } from '../src/domain/calendar.ts'
import { toCalendarYear } from '../src/domain/calendarYear.ts'
import { calendarDay, eventDays, validateEvent, validateTimelineBounds } from '../src/domain/timeline.ts'
import { timelineSnapshot, deleteTimeline, exportTimeline, importTimeline, loadTimelines, rememberSelection, restoreSelection, saveTimeline } from '../src/data/timelineStorage.ts'

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

test('События сохраняются в своём таймлайне, включая системный год 0', () => {
  const data = new Map()
  const storage = {
    get length() { return data.size },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
  const { daysPerYear, ...calendar } = standardYear
  const timeline = {
    name: 'Арена', startYear: -10, endYear: 0, daysPerYear,
    calendars: [{ ...calendar, name: 'Основной', era }],
  }
  const event = { id: 'event-1', year: -10, title: 'Основание', description: '<текст>' }
  assert.equal(validateEvent(event, timeline), null)
  assert.equal(validateEvent({ ...event, year: 0 }, timeline), null)
  assert.match(validateEvent({ ...event, year: 1 }, timeline), /в пределах/)
  assert.match(validateEvent({ ...event, title: ' ' }, timeline), /название/)

  saveTimeline('arena', { ...timeline, events: [event] }, storage)
  saveTimeline('other', timeline, storage)
  const edited = { ...event, year: 0, title: 'Основание Арены' }
  saveTimeline('arena', { ...timeline, events: [edited] }, storage)
  assert.deepEqual(loadTimelines(storage).entries, [
    { id: 'arena', timeline: { ...timeline, events: [edited] } },
    { id: 'other', timeline },
  ])

  saveTimeline('arena', { ...timeline, events: [] }, storage)
  assert.deepEqual(loadTimelines(storage).entries[0].timeline.events, [])
})

test('Резервная копия сохраняет персонажей и связи с событиями', () => {
  const { daysPerYear, ...calendar } = standardYear
  const timeline = {
    name: 'Арена', startYear: -10, endYear: 100, daysPerYear,
    calendars: [{ ...calendar, name: 'Основной', era }],
    characters: [{ id: 'c1', name: 'Мира', description: 'Летописец' }],
    events: [{ id: 'e1', year: 0, title: 'Основание', description: '', characterIds: ['c1'] }],
  }
  assert.deepEqual(importTimeline(exportTimeline(timeline)), timeline)
  assert.throws(() => importTimeline(exportTimeline({ ...timeline, characters: [] })))
  assert.throws(() => importTimeline('{"version":2}'))
  assert.throws(() => importTimeline('{'))
})

test('Сохранённая правка персонажа не выглядит как изменение из другой вкладки', () => {
  const { daysPerYear, ...calendar } = standardYear
  const timeline = {
    name: 'Арена', startYear: -10, endYear: 100, daysPerYear,
    calendars: [{ ...calendar, name: 'Основной', era }],
    characters: [{
      id: 'c1', name: 'Артур', description: '', biography: '', color: '#ff0000', surname: 'Дорэн',
    }],
  }
  const loaded = importTimeline(exportTimeline(timeline))
  assert.equal(timelineSnapshot(timeline), timelineSnapshot(loaded))
  loaded.characters[0].name = 'Мариус'
  assert.notEqual(timelineSnapshot(timeline), timelineSnapshot(loaded))
})

test('Даты сохраняют порядковый день при смене календаря', () => {
  const months = standardYear.months
  assert.deepEqual(eventDays(months, 2), { first: 32, last: 59 })
  assert.equal(eventDays(months, 2, 29), null)
  assert.deepEqual(eventDays(months, 3, 1), { first: 60, last: 60 })
  assert.equal(calendarDay([{ name: 'Зима', days: 365 }], 60), '60 · Зима')
})

test('Периоды проходят через системный год 0 и проверяют порядок дат', () => {
  const bounds = { startYear: -1, endYear: 1, daysPerYear: 365 }
  const event = { year: -1, title: 'Период', description: '', date: { first: 365, last: 365 } }
  assert.equal(validateEvent({ ...event, end: { year: 0, date: { first: 1, last: 1 } } }, bounds), null)
  assert.match(validateEvent({ ...event, end: { year: -1, date: { first: 1, last: 1 } } }, bounds), /не раньше/)
  assert.match(validateEvent({ ...event, end: { year: 2 } }, bounds), /пределах/)
  assert.match(validateEvent({ ...event, date: { first: 366, last: 366 } }, bounds), /пределах/)
  assert.match(validateEvent({ ...event, end: null }, bounds), /пределах/)
})
