import { maxSettlementSeed, settlementFoundation, settlementSizes, waterTypes, type SettlementSettings } from './settlementFoundation.ts'
import { settlementDistricts, type Point } from './settlementDistricts.ts'
import { settlementStreets } from './settlementStreets.ts'
import { settlementBuildings } from './settlementBuildings.ts'

export const mapWidth = 760
export const mapHeight = 500
export type LandscapeFeature = { kind: 'tree' | 'mountain'; point: Point; size: number }
export type Fortifications = { walls: (readonly [Point, Point])[]; towers: Point[] }

export const civicKinds = ['temple', 'palace', 'theatre', 'bank', 'barracks'] as const
export const crossingKinds = ['bridge', 'ferry', 'pier'] as const
export type CivicBuilding = { kind: typeof civicKinds[number]; point: Point }
export type MapCrossing = { kind: typeof crossingKinds[number]; ends: readonly [Point, Point] }

export type MapMarker = { id: string; name: string; point: Point; locationId?: string }

export type MapMode = 'settlement' | 'terrain'
export type Terrain = 'plains' | 'forest' | 'mountains'
export type LocationMapSettings = SettlementSettings & { mode: MapMode; terrain: Terrain; fortified: boolean }

export function waterXAt(points: readonly Point[], y: number, fallback: (y: number) => number): number {
  if (!points.length) return fallback(y)
  const index = points.findIndex(([, height]) => height >= y)
  if (index === 0) return points[0]![0]
  if (index < 0) return points.at(-1)![0]
  const [a, b] = [points[index - 1]!, points[index]!]
  return a[0] + (b[0] - a[0]) * (y - a[1]) / Math.max(0.001, b[1] - a[1])
}

const rivers = ['river', 'river-city', 'river-mouth']

function streetsFor(districts: ReturnType<typeof settlementDistricts>, settings: LocationMapSettings, water: Point[] = []) {
  const entrances = settlementSizes.indexOf(settings.size) >= 2 ? 4 : 3
  if (!rivers.includes(settings.water)) return settlementStreets(districts, entrances)
  const { centerY, waterline } = settlementFoundation(settings)
  const riverX = waterXAt(water, centerY, waterline)
  const west = districts.filter(({ vertices }) => vertices.every(([x, y]) => x < waterXAt(water, y, waterline)))
  const east = districts.filter(({ vertices }) => vertices.every(([x, y]) => x > waterXAt(water, y, waterline)))
  if (!west.length || !east.length || west.length + east.length !== districts.length) return settlementStreets(districts, entrances)
  const primary = settlementStreets(west.some(({ kind }) => kind === 'square') ? west :
    west.map((district, index) => index === 0 ? { ...district, kind: 'square' } : district), 3)
  const core = east.reduce((closest, district) => {
    const distance = (vertices: Point[]) => Math.min(...vertices.map(([x, y]) => Math.hypot(x - riverX, y - centerY)))
    return distance(district.vertices) < distance(closest.vertices) ? district : closest
  })
  const secondary = settlementStreets(east.some(({ kind }) => kind === 'square') ? east :
    east.map((district) => district === core ? { ...district, kind: 'square' } : district), 2)
  return {
    ...primary,
    interior: [...primary.interior, ...secondary.interior],
    routes: [...primary.routes.filter(({ direction }) => direction !== 'east'), ...secondary.routes.filter(({ direction }) => direction !== 'west')],
    walls: [...primary.walls, ...secondary.walls],
    towers: [...primary.towers, ...secondary.towers],
    crossing: { west: primary.routes.find(({ direction }) => direction === 'east'),
      east: secondary.routes.find(({ direction }) => direction === 'west') },
  }
}

function buildGeometry(settings: LocationMapSettings) {
  const { waterline } = settlementFoundation(settings)
  const districts = settlementDistricts(settings)
  const water: Point[] = []
  if (['river', 'coast', 'river-city', 'river-mouth'].includes(settings.water)) {
    for (let y = -12; y <= 512; y += 4) water.push([waterline(y), y])
  }
  const network = streetsFor(districts, settings, water)
  const blocks = settlementBuildings(districts, streetSegments(network), settings, settings.fortified)
  return { districts, network, blocks, water }
}

export type LocationMapPlan = {
  version: 1
  settings: LocationMapSettings
  geometry?: ReturnType<typeof buildGeometry>
  markers?: MapMarker[]
  fortifications?: Fortifications
  landscape?: LandscapeFeature[]
  civicBuildings?: CivicBuilding[]
  crossings?: MapCrossing[]
}

export function createLocationMapPlan(settings: LocationMapSettings): LocationMapPlan {
  return { version: 1, settings, ...(settings.mode === 'settlement' ? { geometry: buildGeometry(settings) } : {}) }
}

type District = ReturnType<typeof settlementDistricts>[number]

export function defaultCrossings(plan: LocationMapPlan): MapCrossing[] {
  const network = plan.geometry?.network
  if (!network) return []
  const { water, waterline } = settlementFoundation(plan.settings)
  const bank = water === 'river-city' ? 13 : plan.settings.terrain === 'mountains' ? 20 : 27
  const crossing = 'crossing' in network ? network.crossing : undefined
  if (crossing?.west && crossing.east) return [{ kind: 'bridge', ends: [crossing.west.gate, crossing.east.gate] }]
  const east = network.routes.find(({ direction }) => direction === 'east')
  if (!east) return []
  const y = east.gate[1]
  const x = waterXAt(plan.geometry?.water ?? [], y, waterline)
  if (water === 'coast') return [{ kind: 'pier', ends: [[x - 4, y], [x + 35, y]] }]
  return water === 'river' || water === 'river-mouth'
    ? [{ kind: 'bridge', ends: [[x - bank - 5, y], [x + bank + 5, y]] }] : []
}

export function moveWaterChannel(plan: LocationMapPlan, origin: Point, x: number): LocationMapPlan {
  const geometry = plan.geometry
  if (!geometry?.water.length || !rivers.includes(plan.settings.water) || Math.abs(x - origin[0]) < 1) return plan
  const { waterline } = settlementFoundation(plan.settings)
  const bank = plan.settings.water === 'river-city' ? 13 : plan.settings.terrain === 'mountains' ? 20 : 27
  for (let strength = 1; strength >= 1 / 32; strength /= 2) {
    const water = geometry.water.map(([currentX, y]): Point => {
      const weight = Math.max(0, 1 - ((y - origin[1]) / 100) ** 2) ** 2
      return [Math.max(40, Math.min(mapWidth - 40, currentX + (x - origin[0]) * weight * strength)), y]
    })
    const intersectsDistrict = geometry.districts.some(({ vertices }) => vertices.some(([px, py]) => {
      const previous = px - waterXAt(geometry.water, py, waterline)
      const next = px - waterXAt(water, py, waterline)
      return next * Math.sign(previous) < Math.min(bank + 2, Math.abs(previous)) - 1e-6
    }))
    if (!intersectsDistrict) return { ...plan, geometry: { ...geometry, water } }
  }
  return plan
}

export function buildOppositeBank(plan: LocationMapPlan): LocationMapPlan {
  const geometry = plan.geometry
  if (!geometry?.water.length || !rivers.includes(plan.settings.water)) return plan
  const { waterline, centerY } = settlementFoundation(plan.settings)
  if (geometry.districts.some(({ vertices }) => vertices.every(([x, y]) => x > waterXAt(geometry.water, y, waterline)))) return plan
  const template = { ...plan.settings, water: 'river-city' as const }
  const divider = settlementFoundation(template).waterline(centerY)
  const east = settlementDistricts(template).filter(({ vertices }) => vertices.every(([x]) => x > divider))
  if (!east.length) return plan
  const points = east.flatMap(({ vertices }) => vertices)
  const left = Math.min(...points.map(([x]) => x))
  const right = Math.max(...points.map(([x]) => x))
  const top = Math.min(...points.map(([, y]) => y))
  const bottom = Math.max(...points.map(([, y]) => y))
  const newTop = Math.max(35, centerY - 85)
  const newBottom = Math.min(405, centerY + 85)
  const newLeft = Math.max(...geometry.water.filter(([, y]) => y >= newTop - 4 && y <= newBottom + 4).map(([x]) => x)) + 35
  const newRight = mapWidth - 28
  if (newRight - newLeft < 32) return plan
  const districts = east.map((district): District => ({
    ...district, kind: district.kind === 'square' ? 'urban' : district.kind,
    vertices: district.vertices.map(([x, y]) => [
      newLeft + (x - left) / (right - left) * (newRight - newLeft),
      newTop + (y - top) / (bottom - top) * (newBottom - newTop),
    ]),
  }))
  return rebuildDistricts(plan, geometry, [...geometry.districts, ...districts])
}

export function mergeDistrictOutline(a: District, b: District): Point[] | undefined {
  const key = ([x, y]: Point) => Math.round(x * 1e5) + ',' + Math.round(y * 1e5)
  const edges = new Map<string, readonly [Point, Point]>()
  let shared = false
  for (const { vertices } of [a, b]) {
    vertices.forEach((from, i) => {
      const to = vertices[(i + 1) % vertices.length]!
      const reverse = key(to) + ':' + key(from)
      if (edges.delete(reverse)) shared = true
      else edges.set(key(from) + ':' + key(to), [from, to])
    })
  }
  if (!shared || edges.size > 64) return
  const outgoing = new Map([...edges.values()].map(([from, to]) => [key(from), [from, to] as const]))
  if (outgoing.size !== edges.size) return
  const first = outgoing.keys().next().value
  if (first === undefined) return
  const outline: Point[] = []
  let current = first
  while (outgoing.has(current)) {
    const [from, to] = outgoing.get(current)!
    outgoing.delete(current)
    outline.push(from)
    current = key(to)
  }
  return current === first && outgoing.size === 0 && outline.length >= 3 ? outline : undefined
}

export function editDistricts(plan: LocationMapPlan, index: number, mergeWith?: number): LocationMapPlan {
  const geometry = plan.geometry
  const district = geometry?.districts[index]
  if (!geometry || !district || geometry.districts.length <= 1) return plan
  let replacement: District | undefined
  if (mergeWith !== undefined) {
    const neighbor = geometry.districts[mergeWith]
    const vertices = neighbor && mergeWith !== index ? mergeDistrictOutline(district, neighbor) : undefined
    if (!neighbor || !vertices) return plan
    replacement = {
      ...district, vertices, kind: neighbor.kind === 'square' ? 'square' : district.kind,
      name: district.name || neighbor.name,
    }
  }
  const districts = geometry.districts.flatMap((entry, i) =>
    i === index ? replacement ? [replacement] : [] : i === mergeWith ? [] : [entry])
  if (!districts.some(({ kind }) => kind === 'square')) districts[0] = { ...districts[0]!, kind: 'square' }
  return rebuildDistricts(plan, geometry, districts)
}

function rebuildDistricts(plan: LocationMapPlan, geometry: NonNullable<LocationMapPlan['geometry']>, districts: District[]): LocationMapPlan {
  const network = streetsFor(districts, plan.settings, geometry.water)
  const blocks = settlementBuildings(districts, streetSegments(network), plan.settings, plan.settings.fortified)
  return { ...plan, geometry: { ...geometry, districts, network, blocks } }
}

export function rerollDistrict(plan: LocationMapPlan, index: number, seed: number): LocationMapPlan {
  const geometry = plan.geometry
  if (!geometry || !geometry.blocks[index]) return plan
  const mainSegments = streetSegments(geometry.network)
  const replacement = settlementBuildings(geometry.districts, mainSegments, { ...plan.settings, seed }, plan.settings.fortified)[index]!
  return { ...plan, geometry: { ...geometry, blocks: geometry.blocks.map((block, i) => i === index ? replacement : block) } }
}

function streetSegments(network: NonNullable<LocationMapPlan['geometry']>['network']) {
  const crossing = 'crossing' in network ? network.crossing : undefined
  return [...network.routes, ...(crossing?.west ? [crossing.west] : []), ...(crossing?.east ? [crossing.east] : [])]
    .flatMap(({ street }) => street.slice(1).map((point, i) => [street[i]!, point] as const))
}

export function moveDistrictCorner(plan: LocationMapPlan, original: Point, target: Point): LocationMapPlan {
  const same = (point: Point) => Math.hypot(point[0] - original[0], point[1] - original[1]) < 1e-5
  const [dx, dy] = [target[0] - original[0], target[1] - original[1]]
  if (!dx && !dy) return plan
  const targets = new Map<number, Point>()
  return moveDistrictVertices(plan, (point, fraction) => {
    if (!same(point)) return point
    const next: Point = targets.get(fraction) ?? [original[0] + dx * fraction, original[1] + dy * fraction]
    targets.set(fraction, next)
    return next
  })
}

export function brushDisplacement(point: Point, origin: Point, target: Point, radius: number): Point | undefined {
  const distance = Math.hypot(point[0] - origin[0], point[1] - origin[1])
  if (distance >= radius) return
  const weight = (1 - (distance / radius) ** 2) ** 2
  return [(target[0] - origin[0]) * weight, (target[1] - origin[1]) * weight]
}

export function warpDistricts(plan: LocationMapPlan, origin: Point, target: Point, radius: number): LocationMapPlan {
  if (radius <= 0) return plan
  if (origin[0] === target[0] && origin[1] === target[1]) return plan
  return moveDistrictVertices(plan, (point, fraction) => {
    const vertex: Point = [Math.round(point[0] * 1e6) / 1e6, Math.round(point[1] * 1e6) / 1e6]
    const delta = brushDisplacement(vertex, origin, target, radius)
    return delta ? [vertex[0] + delta[0] * fraction, vertex[1] + delta[1] * fraction] : point
  })
}

function turn(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
}

function moveDistrictVertices(plan: LocationMapPlan, targetFor: (point: Point, fraction: number) => Point): LocationMapPlan {
  const geometry = plan.geometry
  if (!geometry) return plan
  const { centerX, centerY, scale, waterline } = settlementFoundation(plan.settings)
  const { water } = plan.settings
  const channel = geometry.water
  function allowed([x, y]: Point, original: Point) {
    if (x < 23 || x > mapWidth - 23 || y < 23 || y > mapHeight - 75) return false
    const shoreline = waterXAt(channel, y, waterline)
    if ((water === 'river' || water === 'river-mouth') &&
        (x - shoreline) * Math.sign(original[0] - waterXAt(channel, original[1], waterline)) < 28) return false
    if (water === 'coast' && x > shoreline - 2) return false
    if (['island', 'peninsula', 'cave', 'underground'].includes(water) &&
        Math.hypot((x - centerX) / (192 * scale), (y - centerY) / (162 * scale)) > 0.93) return false
    if (water === 'gorge' && Math.abs(y - centerY) > 124 * scale - 13) return false
    return water !== 'river-city' || (Math.abs(x - shoreline) >= 16 - 1e-5 &&
      (x < shoreline) === (original[0] < waterXAt(channel, original[1], waterline)))
  }

  let districts = geometry.districts
  for (let fraction = 1; fraction >= 1 / 32; fraction /= 2) {
    let valid = true
    const proposed = geometry.districts.map((district) => {
      const vertices = district.vertices.map((original) => {
        const next = targetFor(original, fraction)
        if (next !== original && !allowed(next, original)) valid = false
        return next
      })
      return vertices.some((point, i) => point !== district.vertices[i]) ? { ...district, vertices } : district
    })
    if (!valid) continue
    if (proposed.some((district, index) => district !== geometry.districts[index] && district.vertices.some((a, i, vertices) => {
      const b = vertices[(i + 1) % vertices.length]!
      const c = vertices[(i + 2) % vertices.length]!
      const originals = geometry.districts[index]!.vertices
      const previous = originals[i]!
      const next = originals[(i + 1) % vertices.length]!
      const minimumLength = Math.min(0.1, Math.hypot(next[0] - previous[0], next[1] - previous[1]) / 2)
      const previousTurn = turn(previous, next, originals[(i + 2) % vertices.length]!)
      return Math.hypot(b[0] - a[0], b[1] - a[1]) < minimumLength ||
        (turn(a, b, c) < -1e-6 && previousTurn >= -1e-6) ||
        vertices.some((d, j) => {
          if (j <= i + 1 || (i === 0 && j === vertices.length - 1)) return false
          const e = vertices[(j + 1) % vertices.length]!
          return turn(a, b, d) * turn(a, b, e) < -1e-8 && turn(d, e, a) * turn(d, e, b) < -1e-8
        })
    }))) continue
    districts = proposed
    break
  }
  if (districts === geometry.districts || districts.every((district, index) => district === geometry.districts[index])) return plan
  return rebuildDistricts(plan, geometry, districts)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function list(value: unknown, max: number, check: (item: unknown) => boolean): value is unknown[] {
  return Array.isArray(value) && value.length <= max && value.every(check)
}

function point(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2 &&
    value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= -32 && coordinate <= 800)
}

function path(value: unknown, min = 2, max = 256) {
  return list(value, max, point) && value.length >= min
}

function segment(value: unknown) {
  return path(value, 2, 2)
}

export function validLocationMapPlan(value: unknown): value is LocationMapPlan {
  if (!record(value) || value.version !== 1 || !record(value.settings)) return false
  const { settings, geometry } = value
  if (typeof settings.seed !== 'number' || !Number.isInteger(settings.seed) ||
      settings.seed < 0 || settings.seed > maxSettlementSeed ||
      !settlementSizes.some((size) => size === settings.size) || !waterTypes.some((water) => water === settings.water) ||
      typeof settings.terrain !== 'string' || !['plains', 'forest', 'mountains'].includes(settings.terrain) ||
      typeof settings.fortified !== 'boolean') return false
  if (value.markers !== undefined && (!list(value.markers, 100, (marker) => record(marker) &&
      typeof marker.id === 'string' && marker.id.length > 0 && marker.id.length <= 128 &&
      typeof marker.name === 'string' && marker.name.trim().length > 0 && marker.name.length <= 80 &&
      point(marker.point) && marker.point[0] >= 0 && marker.point[0] <= mapWidth &&
      marker.point[1] >= 0 && marker.point[1] <= mapHeight &&
      (marker.locationId === undefined || (typeof marker.locationId === 'string' && marker.locationId.length > 0))) ||
      new Set(value.markers.map((marker) => record(marker) && marker.id)).size !== value.markers.length)) return false
  if (value.fortifications !== undefined && (!record(value.fortifications) ||
      !list(value.fortifications.walls, 2048, segment) || !list(value.fortifications.towers, 2048, point))) return false
  if (value.landscape !== undefined && !list(value.landscape, 400, (feature) => record(feature) &&
      (feature.kind === 'tree' || feature.kind === 'mountain') && point(feature.point) &&
      typeof feature.size === 'number' && feature.size >= 3 && feature.size <= 28)) return false
  if (value.civicBuildings !== undefined && !list(value.civicBuildings, 120, (item) => record(item) &&
      civicKinds.some((kind) => kind === item.kind) && point(item.point))) return false
  if (value.crossings !== undefined && !list(value.crossings, 120, (item) => record(item) &&
      crossingKinds.some((kind) => kind === item.kind) && segment(item.ends))) return false
  if (settings.mode === 'terrain') return geometry === undefined && value.markers === undefined
  if (settings.mode !== 'settlement' || !record(geometry) || !record(geometry.network)) return false

  const { districts, blocks, network, water } = geometry
  return list(districts, 256, (district) => record(district) &&
    (district.kind === 'square' || district.kind === 'urban' || district.kind === 'outskirts') && path(district.vertices, 3, 64) &&
    (district.name === undefined || (typeof district.name === 'string' && district.name.length <= 80))) &&
    districts.filter((district) => record(district) && district.kind === 'square').length === 1 &&
    list(blocks, 256, (block) => record(block) && list(block.alleys, 32, segment) &&
      list(block.lots, 256, (lot) => record(lot) && typeof lot.kind === 'string' &&
        ['house', 'workshop', 'stall', 'citadel', 'courtyard'].includes(lot.kind) && path(lot.footprint, 4, 4))) &&
    blocks.length === districts.length &&
    point(network.squareCenter) && list(network.interior, 2048, segment) &&
    list(network.walls, 2048, segment) && list(network.towers, 2048, point) &&
    list(network.routes, 16, (route) => record(route) && typeof route.direction === 'string' &&
      ['west', 'east', 'north', 'south'].includes(route.direction) && point(route.gate) && path(route.street)) &&
    (network.crossing === undefined || (rivers.includes(settings.water as string) && record(network.crossing) &&
      [network.crossing.west, network.crossing.east].every((route) => route === undefined ||
        (record(route) && point(route.gate) && path(route.street) && (route.direction === 'east' || route.direction === 'west'))))) &&
    (['river', 'coast', 'river-city', 'river-mouth'].includes(settings.water as string) ? path(water) :
      Array.isArray(water) && (water.length === 0 || path(water)))
}
