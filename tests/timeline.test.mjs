import assert from 'node:assert/strict'
import { test } from 'node:test'
import { insideDistrict, settlementBuildings } from '../src/domain/settlementBuildings.ts'
import { settlementStreets } from '../src/domain/settlementStreets.ts'
import { settlementDistricts } from '../src/domain/settlementDistricts.ts'
import { settlementFoundation } from '../src/domain/settlementFoundation.ts'
import { adjustedAbilities, validAbilityScores } from '../src/domain/abilities.ts'
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

test('Расовые поправки ограничивают итог от 0 до 30 и сохраняют базовые статы', () => {
  const base = { strength: 29, wisdom: 0, charisma: 0 }
  const bonuses = { strength: 3, constitution: 2, charisma: 2 }
  const penalties = { wisdom: 2, charisma: 1 }
  assert.equal(validAbilityScores(base), true)
  assert.equal(validAbilityScores({ strength: -1 }), false)
  assert.equal(validAbilityScores({ strength: 31 }), false)
  assert.deepEqual(adjustedAbilities(base, bonuses, penalties),
    { strength: 30, constitution: 12, wisdom: 0, charisma: 1 })
  assert.deepEqual(adjustedAbilities(base), { strength: 29, wisdom: 0, charisma: 0 })
})

test('Основа поселения повторяется по seed, но меняется с другим seed', () => {
  const settings = { seed: 0, size: 'town', water: 'coast' }
  const snapshot = ({ centerX, centerY, scale, waterline, water }) =>
    [centerX, centerY, scale, waterline(0), waterline(250), waterline(500), water]
  const first = settlementFoundation(settings)
  assert.deepEqual(snapshot(first), snapshot(settlementFoundation(settings)))
  assert.notDeepEqual(snapshot(first), snapshot(settlementFoundation({ ...settings, seed: 4294967295 })))
  assert.ok(settlementFoundation({ ...settings, size: 'city' }).scale > first.scale)
  assert.ok(first.centerX < first.waterline(first.centerY))
})

test('Кварталы Вороного воспроизводятся по seed, лежат на суше и не перекрываются', () => {
  const settings = { seed: 42, size: 'city', water: 'river' }
  const districts = settlementDistricts(settings)
  assert.deepEqual(districts, settlementDistricts(settings))
  assert.notDeepEqual(districts, settlementDistricts({ ...settings, seed: 43 }))
  assert.equal(districts.filter(({ kind }) => kind === 'square').length, 1)
  assert.equal(districts.length, 23)
  assert.ok(settlementDistricts({ ...settings, size: 'village' }).length < districts.length)

  const strictlyInside = ([x, y], vertices) => vertices.every(([ax, ay], index) => {
    const [bx, by] = vertices[(index + 1) % vertices.length]
    return (bx - ax) * (y - ay) - (by - ay) * (x - ax) > 1e-6
  })
  for (const water of ['river', 'coast']) {
    for (const seed of [0, 1, 42, 2026, 4294967295]) {
      const options = { ...settings, seed, water }
      const { waterline } = settlementFoundation(options)
      const cells = settlementDistricts(options)
      for (const [index, { vertices }] of cells.entries()) {
        assert.ok(vertices.length >= 3)
        assert.ok(vertices.every(([x, y]) => x < waterline(y) - (water === 'river' ? 28 : 2)))
        const center = vertices.reduce(([x, y], [vx, vy]) => [x + vx / vertices.length, y + vy / vertices.length], [0, 0])
        assert.ok(strictlyInside(center, vertices))
        assert.equal(cells.filter((cell, other) => index !== other &&
          [...vertices, center].some((point) => strictlyInside(point, cell.vertices))).length, 0)
      }
    }
  }
})

test('Подъезды входят через ворота, улицы ведут к площади, а у кварталов есть выходы к улицам', () => {
  for (const size of ['village', 'town', 'city']) {
    for (const seed of [0, 1, 42, 43, 2026, 4294967295]) {
      const districts = settlementDistricts({ seed, size, water: 'river' })
      const { routes, walls, towers, interior, squareCenter } = settlementStreets(districts, size === 'city' ? 4 : 3)
      assert.equal(routes.length, size === 'city' ? 4 : 3)
      assert.ok(routes.some(({ direction }) => direction === 'east'))
      assert.ok(towers.length >= routes.length * 2)
      for (const { gate, street } of routes) {
        assert.deepEqual(street[0], gate)
        assert.deepEqual(street.at(-1), squareCenter)
        assert.ok(walls.every(([a, b]) => {
          const separation = Math.hypot(a[0] - gate[0], a[1] - gate[1]) + Math.hypot(b[0] - gate[0], b[1] - gate[1])
          return separation > Math.hypot(a[0] - b[0], a[1] - b[1]) + 1e-6
        }))
      }
      const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5
      for (const { vertices } of districts) {
        assert.ok(interior.some(([a, b]) => vertices.some((v) => samePoint(v, a)) && vertices.some((v) => samePoint(v, b))))
      }
    }
  }
})

test('Застройка помещается в кварталы, а укреплённый город получает цитадель', () => {
  const settings = { seed: 42, size: 'city', water: 'coast' }
  const districts = settlementDistricts(settings)
  const { routes } = settlementStreets(districts, 4)
  const streets = routes.flatMap(({ street }) => street.slice(1).map((point, i) => [street[i], point]))
  const blocks = settlementBuildings(districts, streets, settings, true)
  assert.deepEqual(blocks, settlementBuildings(districts, streets, settings, true))
  const kinds = new Set(blocks.flatMap(({ lots }) => lots.map(({ kind }) => kind)))
  for (const kind of ['house', 'workshop', 'stall', 'citadel', 'courtyard']) assert.ok(kinds.has(kind), kind)
  assert.ok(blocks.some(({ alleys }) => alleys.length > 0))
  for (const [index, { lots }] of blocks.entries()) {
    const { vertices } = districts[index]
    assert.ok(lots.every(({ footprint }) => footprint.every((point) => insideDistrict(point, vertices, 1))))
  }
  assert.ok(!settlementBuildings(districts, streets, settings, false).some(({ lots }) =>
    lots.some(({ kind }) => kind === 'citadel')))
})
