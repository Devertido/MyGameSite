import assert from 'node:assert/strict'
import { test } from 'node:test'
import { standardYear, validateMonths, validateWeek } from '../src/domain/calendar.ts'
import { toCalendarYear } from '../src/domain/calendarYear.ts'
import { validateTimelineBounds } from '../src/domain/timeline.ts'
import { loadTimelines, saveTimeline } from '../src/data/timelineStorage.ts'

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
  const updated = {
    ...timeline,
    startYear: -20,
    calendar: { ...timeline.calendar, era: { ...era, calendarAnchorYear: 5 } },
  }

  saveTimeline('first', timeline, storage)
  saveTimeline('second', timeline, storage)
  saveTimeline('first', updated, storage)
  data.set('arena-atlas:timeline:v1:broken', '{')

  assert.deepEqual(loadTimelines(storage), {
    entries: [{ id: 'first', timeline: updated }, { id: 'second', timeline }],
    skipped: 1,
  })
})
