import assert from 'node:assert/strict'
import { test } from 'node:test'
import { damageRange, parseDamageFormula } from '../src/domain/itemDamage.ts'
import { buildOppositeBank, createLocationMapPlan, editDistricts, mergeDistrictOutline, moveDistrictCorner, moveWaterChannel, waterXAt, rerollDistrict, validLocationMapPlan, warpDistricts } from '../src/domain/locationMapPlan.ts'
import { insideDistrict, settlementBuildings } from '../src/domain/settlementBuildings.ts'
import { settlementStreets } from '../src/domain/settlementStreets.ts'
import { settlementDistricts } from '../src/domain/settlementDistricts.ts'
import { settlementFoundation } from '../src/domain/settlementFoundation.ts'
import { adjustedAbilities, validAbilityScores } from '../src/domain/abilities.ts'
import { standardYear, validateMonths, validateWeek } from '../src/domain/calendar.ts'
import { toCalendarYear } from '../src/domain/calendarYear.ts'
import { calendarDay, eventDays, validateEvent, validateTimelineBounds } from '../src/domain/timeline.ts'
import { timelineSnapshot, deleteTimeline, exportTimeline, importTimeline, loadTimelines, rememberSelection, restoreSelection, saveTimeline } from '../src/data/timelineStorage.ts'

import { emptyLore, parseRaceMeasure, readRaceMeasure, removeMissingLoreLinks } from '../src/domain/lore.ts'
import { addHouseRelationship, houseGenerations, removeHouseRelationship } from '../src/domain/houseTree.ts'

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

test('Копия таймлайна переносит изображение, настройки и геометрию локации', () => {
  const { daysPerYear, ...calendar } = standardYear
  const mapPlan = createLocationMapPlan({
    mode: 'settlement', terrain: 'forest', seed: 42, size: 'city', water: 'coast', fortified: true,
  })
  mapPlan.fortifications = { walls: [[[100, 150], [150, 200]]], towers: [[100, 150]] }
  mapPlan.landscape = [{ kind: 'tree', point: [50, 70], size: 9 }, { kind: 'mountain', point: [120, 80], size: 12 }]
  const location = { id: 'doren', title: 'Дорэн', summary: '', body: '', mapImage: 'data:image/webp;base64,AAAA', mapPlan }
  const timeline = {
    name: 'Арена', startYear: -10, endYear: 100, daysPerYear,
    calendars: [{ ...calendar, name: 'Основной', era }],
    locations: [location],
  }
  assert.deepEqual(importTimeline(exportTimeline(timeline)).locations[0], location)
  const badPlan = structuredClone(mapPlan)
  badPlan.geometry.districts[0].vertices[0][0] = 'bad'
  assert.throws(() => importTimeline(exportTimeline({ ...timeline, locations: [{ ...location, mapPlan: badPlan }] })))
  const { mapPlan: _removed, ...olderLocation } = location
  assert.deepEqual(importTimeline(exportTimeline({ ...timeline, locations: [olderLocation] })).locations[0], olderLocation)
})

test('Перестройка сохраняет остальные кварталы, улицы и метки', () => {
  const plan = createLocationMapPlan({
    mode: 'settlement', terrain: 'forest', seed: 42, size: 'ecumenopolis', water: 'coast', fortified: true,
  })
  plan.markers = [{ id: 'tower', name: 'Сторожевая башня', point: [20, 30], locationId: 'tower-location' }]
  plan.geometry.districts[1].name = 'Медный квартал'
  const updated = rerollDistrict(plan, 1, 99)
  assert.equal(plan.geometry.districts.length, 56)
  assert.notDeepEqual(updated.geometry.blocks[1], plan.geometry.blocks[1])
  assert.strictEqual(updated.geometry.blocks[0], plan.geometry.blocks[0])
  assert.deepEqual(updated.geometry.blocks.slice(2), plan.geometry.blocks.slice(2))
  assert.deepEqual(updated.geometry.districts, plan.geometry.districts)
  assert.deepEqual(updated.geometry.network, plan.geometry.network)
  assert.deepEqual(updated.markers, plan.markers)
  assert.ok(validLocationMapPlan(JSON.parse(JSON.stringify(updated))))
})

test('Новая география сохраняется, а кварталы на реке занимают оба берега', () => {
  for (const water of ['gorge', 'cave', 'underground', 'island', 'peninsula', 'river-mouth', 'river-city']) {
    const settings = { mode: 'settlement', terrain: 'mountains', seed: 42, size: 'city', water, fortified: true }
    const plan = createLocationMapPlan(settings)
    assert.ok(validLocationMapPlan(JSON.parse(JSON.stringify(plan))))
    if (water === 'river-city') {
      const riverX = settlementFoundation(settings).waterline(250)
      const banks = new Set(plan.geometry.districts.map(({ vertices }) => {
        assert.ok(vertices.every(([x]) => Math.abs(x - riverX) >= 16 - 1e-6))
        const bank = Math.sign(vertices[0][0] - riverX)
        assert.ok(vertices.every(([x]) => Math.sign(x - riverX) === bank))
        return bank
      }))
      assert.deepEqual(new Set([-1, 1]), banks)
      assert.ok(plan.geometry.network.crossing.west && plan.geometry.network.crossing.east)
    }
  }
})

test('Перетаскивание меняет общий угол во всех примыкающих кварталах', () => {
  const plan = createLocationMapPlan({ mode: 'settlement', terrain: 'forest', seed: 42, size: 'city', water: 'river', fortified: true })
  const [x, y] = plan.geometry.districts[0].vertices[0]
  const updated = moveDistrictCorner(plan, [x, y], [x + 4, y + 3])
  assert.notEqual(updated, plan)
  const touches = (district) => district.vertices.some(([a, b]) => Math.hypot(a - x, b - y) < 1e-5)
  const affected = plan.geometry.districts.map((district, i) => touches(district) ? i : -1).filter((i) => i >= 0)
  assert.ok(affected.length >= 2)
  const target = updated.geometry.districts[0].vertices[0]
  for (const i of affected) assert.ok(updated.geometry.districts[i].vertices.some((vertex) => vertex === target))
  assert.ok(validLocationMapPlan(JSON.parse(JSON.stringify(updated))))
})

test('Кисть сдвигает несколько углов, сохраняет общие границы и не меняет дальние кварталы', () => {
  const plan = createLocationMapPlan({ mode: 'settlement', terrain: 'forest', seed: 42, size: 'city', water: 'inland', fortified: true })
  const origin = plan.geometry.districts[0].vertices[0]
  const target = [origin[0] + 4, origin[1] + 2]
  const radius = 75
  const updated = warpDistricts(plan, origin, target, radius)
  assert.notEqual(updated, plan)
  const moved = new Map()
  for (const [i, district] of plan.geometry.districts.entries()) {
    for (const [j, vertex] of district.vertices.entries()) {
      const next = updated.geometry.districts[i].vertices[j]
      if (Math.hypot(vertex[0] - origin[0], vertex[1] - origin[1]) >= radius) {
        assert.equal(next, vertex)
      } else {
        const key = vertex.map((value) => Math.round(value * 1e6)).join(',')
        if (moved.has(key)) assert.deepEqual(next, moved.get(key))
        moved.set(key, next)
      }
    }
  }
  assert.ok(moved.size > 1)
  assert.ok(updated.geometry.districts.some((district, index) => district === plan.geometry.districts[index]))
  assert.ok(validLocationMapPlan(JSON.parse(JSON.stringify(updated))))
  assert.equal(warpDistricts(plan, origin, origin, radius), plan)
})

test('Правки планировки, родство, бестиарий и расы переживают сохранение и импорт', () => {
  assert.deepEqual(parseRaceMeasure('1000лет-10000 лет', 'lifespan'), ['1000', '10000'])
  assert.deepEqual(parseRaceMeasure('2-2.5м', 'height'), ['200', '250'])
  const form = new FormData()
  form.set('height', '200')
  form.set('height-max', '250')
  const { daysPerYear, ...calendar } = standardYear
  const base = createLocationMapPlan({ mode: 'settlement', terrain: 'forest', seed: 42, size: 'city', water: 'inland', fortified: true })
  const origin = base.geometry.districts[0].vertices[0]
  const mapPlan = warpDistricts(base, origin, [origin[0] + 4, origin[1] + 2], 75)
  assert.notEqual(mapPlan, base)
  const image = 'data:image/webp;base64,AAAA'
  const location = { id: 'doren', title: 'Дорэн', summary: '', body: '', mapImage: image, mapPlan }
  const race = { name: 'Альвы', image, lifespan: '1000–10000', height: readRaceMeasure(form, 'height'), size: '2', bonuses: '', debuffs: '' }
  assert.equal(race.height, '200–250')
  const beast = { id: 'beast', name: 'Грифон', type: 'Зверь', description: '', image, abilities: {}, combat: { challenge: '1/2', level: '3' } }
  const people = [
    { id: 'a', name: 'А', description: '', sex: 'Муж' },
    { id: 'b', name: 'Б', description: '', sex: 'Жен' },
    { id: 'c', name: 'В', description: '' },
  ]
  const couple = addHouseRelationship(people, people[0], people[1], 'spouse')
  const characters = addHouseRelationship(couple, couple[0], couple[2], 'child')
  const timeline = {
    name: 'Арена', startYear: -10, endYear: 100, daysPerYear,
    calendars: [{ ...calendar, name: 'Основной', era }],
    locations: [location], characters,
    lore: { ...emptyLore, races: [race.name], raceDetails: [race], bestiary: [beast],
      dynasties: ['House'], houseDetails: [{ name: 'House', startYear: -10, endYear: 0, locationIds: [location.id] }] },
  }
  const spell = { name: 'Fireball', image, mana: 15, components: [], school: 'Evocation',
    damageFormula: '2d6 + 3', castingTime: { amount: 0.5, unit: 'second' }, cooldown: { amount: 2, unit: 'minute' } }
  timeline.lore.spells = [spell.name]
  timeline.lore.spellDetails = [spell]
  timeline.lore.classes = ['Mage']
  timeline.lore.classProgression = [{ name: 'Mage', levels: [
    { level: 1, skills: 'Arcana', abilities: '', spells: [] },
    { level: 20, skills: '', abilities: 'Mastery', spells: [spell.name] },
  ] }]
  const ability = { ...spell, name: 'Arcane pulse' }
  timeline.lore.abilities = [ability.name]
  timeline.lore.abilityDetails = [ability]
  timeline.lore.classProgression[0].levels[1].abilityNames = [ability.name]
  race.abilityNames = [ability.name]
  characters[0].abilityNames = [ability.name]
  const invalidClass = structuredClone(timeline)
  invalidClass.lore.classProgression[0].levels[1].level = 21
  assert.throws(() => importTimeline(exportTimeline(invalidClass)))
  let saved
  const storage = { length: 1, key: () => 'arena-atlas:timeline:v1:verification',
    getItem: () => saved, setItem: (key, value) => { storage.key = () => key; saved = value } }
  saveTimeline('verification', timeline, storage)
  const { entries, skipped } = loadTimelines(storage)
  assert.equal(skipped, 0)
  for (const restored of [entries[0].timeline, importTimeline(exportTimeline(timeline))]) {
    assert.deepEqual(restored.locations[0], location)
    assert.deepEqual(restored.characters, characters)
    assert.deepEqual(restored.lore.raceDetails[0], race)
    assert.deepEqual(restored.lore.bestiary[0], beast)
    assert.deepEqual(restored.lore.houseDetails, timeline.lore.houseDetails)
    assert.deepEqual(restored.lore.spellDetails, [spell])
    assert.deepEqual(restored.lore.classProgression, timeline.lore.classProgression)
    assert.deepEqual(restored.lore.abilityDetails, [ability])
    assert.deepEqual(removeMissingLoreLinks({ ...restored, locations: [] }).lore.houseDetails[0].locationIds, [])
  }
})

test('An affair can coexist with a marriage and the child keeps biological parents', () => {
  const people = [
    { id: 'mother', name: 'Mother', description: '', sex: 'Жен', dynasty: 'House', spouseId: 'spouse' },
    { id: 'spouse', name: 'Spouse', description: '', sex: 'Муж', spouseId: 'mother' },
    { id: 'father', name: 'Father', description: '' },
    { id: 'child', name: 'Child', description: '', parentIds: ['mother', 'father'], bornOutsideMarriage: true, level: 20 },
  ]
  const characters = addHouseRelationship(people, people[0], people[2], 'lover')
  assert.equal(characters[0].spouseId, 'spouse')
  assert.deepEqual(characters[0].loverIds, ['father'])
  assert.deepEqual(characters[2].loverIds, ['mother'])
  assert.deepEqual(houseGenerations(characters, 'House').linkedParents.get('child'), ['mother', 'father'])
  const { daysPerYear, ...calendar } = standardYear
  const timeline = { name: 'Atlas', startYear: -10, endYear: 100, daysPerYear,
    calendars: [{ ...calendar, name: 'Main', era }], characters }
  assert.deepEqual(importTimeline(exportTimeline(timeline)).characters, characters)
  const afterRemoval = removeHouseRelationship(characters, 'mother', 'father', 'lover')
  assert.deepEqual(afterRemoval[0].loverIds, [])
  assert.deepEqual(afterRemoval[2].loverIds, [])
  assert.equal(afterRemoval[0].spouseId, 'spouse')
  assert.deepEqual(afterRemoval[3].parentIds, ['mother', 'father'])
})

test('Districts can merge or be removed, and edits to the river and both banks survive serialization', () => {
  const settings = { mode: 'settlement', terrain: 'plains', seed: 42, size: 'city', water: 'river-mouth', fortified: true }
  const plan = createLocationMapPlan(settings)
  const districts = plan.geometry.districts
  const neighbor = districts.findIndex((entry, index) => index > 0 && mergeDistrictOutline(districts[0], entry))
  assert.ok(neighbor > 0)
  const merged = editDistricts(plan, 0, neighbor)
  assert.equal(merged.geometry.districts.length, districts.length - 1)
  assert.equal(merged.geometry.districts[0].kind, 'square')
  assert.ok(validLocationMapPlan(merged))
  const removed = editDistricts(merged, 0)
  assert.equal(removed.geometry.districts.length, districts.length - 2)
  assert.ok(validLocationMapPlan(removed))
  const origin = plan.geometry.water[62]
  const curved = moveWaterChannel(plan, origin, origin[0] + 12)
  assert.ok(waterXAt(curved.geometry.water, origin[1], () => 0) > origin[0])
  const developed = buildOppositeBank(curved)
  assert.ok(developed.geometry.districts.length > districts.length)
  assert.deepEqual(developed.geometry.districts.slice(0, districts.length), districts)
  assert.ok(developed.geometry.districts.slice(districts.length).every(({ vertices }) => vertices.every(([x, y]) =>
    x > waterXAt(developed.geometry.water, y, () => 0))))
  const crossings = ['bridge', 'ferry', 'pier'].map((kind) => ({ kind, ends: [[530, 190], [620, 190]] }))
  const civicBuildings = ['temple', 'palace', 'theatre', 'bank', 'barracks'].map((kind) => ({ kind, point: [200, 200] }))
  const { daysPerYear, ...calendar } = standardYear
  const mapPlan = { ...developed, crossings, civicBuildings }
  const timeline = {
    name: 'Atlas', startYear: -10, endYear: 100, daysPerYear, calendars: [{ ...calendar, name: 'Main', era }],
    locations: [{ id: 'port', title: 'Port', summary: '', body: '', mapImage: 'data:image/webp;base64,AAAA', mapPlan }],
  }
  assert.deepEqual(importTimeline(exportTimeline(timeline)).locations[0].mapPlan, mapPlan)
})

test('Damage range follows dice, signs and operator precedence', () => {
  assert.deepEqual(damageRange('1d8'), [1, 8])
  assert.deepEqual(damageRange('1d12 + 5'), [6, 17])
  assert.deepEqual(damageRange('1d8 + СИЛ + 5', 14), [20, 27])
  assert.deepEqual(damageRange('(2d6 + 4) / 2 - 1 * -3'), [6, 11])
  assert.deepEqual(damageRange('12 - 1d8'), [4, 11])
  assert.deepEqual(damageRange('15 + (1d4 - 5) * 1d2'), [7, 14])
  assert.deepEqual(damageRange('2,5 + 1'), [3, 3])
  assert.equal(damageRange('1 / (1d4 - 2)'), undefined)
  assert.equal(damageRange('СИЛ + 2'), undefined)
  for (const formula of ['1d1', '500d20', '1d8 +', '2(3)', 'alert(1)', '(1 + 2', '5 ^ 2']) {
    assert.equal(parseDamageFormula(formula), undefined, formula)
  }
})
