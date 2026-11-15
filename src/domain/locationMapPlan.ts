import { maxSettlementSeed, settlementFoundation, settlementSizes, waterTypes, type SettlementSettings } from './settlementFoundation.ts'
import { settlementDistricts, type Point } from './settlementDistricts.ts'
import { settlementStreets } from './settlementStreets.ts'
import { settlementBuildings } from './settlementBuildings.ts'

export const mapWidth = 760
export const mapHeight = 500
export type MapMarker = { id: string; name: string; point: Point; locationId?: string }

export type MapMode = 'settlement' | 'terrain'
export type Terrain = 'plains' | 'forest' | 'mountains'
export type LocationMapSettings = SettlementSettings & { mode: MapMode; terrain: Terrain; fortified: boolean }

function streetsFor(districts: ReturnType<typeof settlementDistricts>, settings: LocationMapSettings) {
  if (settings.water !== 'river-city') return settlementStreets(districts, settlementSizes.indexOf(settings.size) >= 2 ? 4 : 3)
  const { centerY, waterline } = settlementFoundation(settings)
  const riverX = waterline(centerY)
  const west = districts.filter(({ vertices }) => vertices.every(([x]) => x < riverX))
  const east = districts.filter(({ vertices }) => vertices.every(([x]) => x > riverX))
  const primary = settlementStreets(west, 3)
  if (east.length === 0) return primary
  const core = east.reduce((closest, district) => {
    const distance = (vertices: Point[]) => Math.min(...vertices.map(([x, y]) => Math.hypot(x - riverX, y - centerY)))
    return distance(district.vertices) < distance(closest.vertices) ? district : closest
  })
  const secondary = settlementStreets(east.map((district) => district === core ? { ...district, kind: 'square' } : district), 2)
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
  const network = streetsFor(districts, settings)
  const mainSegments = streetSegments(network)
  const blocks = settlementBuildings(districts, mainSegments, settings, settings.fortified)
  const water: Point[] = []
  if (['river', 'coast', 'river-city', 'river-mouth'].includes(settings.water)) {
    for (let y = -12; y <= 512; y += 4) water.push([waterline(y), y])
  }
  return { districts, network, blocks, water }
}

export type LocationMapPlan = {
  version: 1
  settings: LocationMapSettings
  geometry?: ReturnType<typeof buildGeometry>
  markers?: MapMarker[]
}

export function createLocationMapPlan(settings: LocationMapSettings): LocationMapPlan {
  return { version: 1, settings, ...(settings.mode === 'settlement' ? { geometry: buildGeometry(settings) } : {}) }
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

function moveDistrictVertices(plan: LocationMapPlan, targetFor: (point: Point, fraction: number) => Point): LocationMapPlan {
  const geometry = plan.geometry
  if (!geometry) return plan
  const { centerX, centerY, scale, waterline } = settlementFoundation(plan.settings)
  const { water } = plan.settings
  function allowed([x, y]: Point, original: Point) {
    if (x < 23 || x > mapWidth - 23 || y < 23 || y > mapHeight - 75) return false
    if ((water === 'river' || water === 'river-mouth') && x > waterline(y) - 28) return false
    if (water === 'coast' && x > waterline(y) - 2) return false
    if (['island', 'peninsula', 'cave', 'underground'].includes(water) &&
        Math.hypot((x - centerX) / (192 * scale), (y - centerY) / (162 * scale)) > 0.93) return false
    if (water === 'gorge' && Math.abs(y - centerY) > 124 * scale - 13) return false
    return water !== 'river-city' || (Math.abs(x - waterline(y)) >= 16 - 1e-5 &&
      (x < waterline(y)) === (original[0] < waterline(original[1])))
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
      return Math.hypot(b[0] - a[0], b[1] - a[1]) < minimumLength ||
        (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-6
    }))) continue
    districts = proposed
    break
  }
  if (districts === geometry.districts || districts.every((district, index) => district === geometry.districts[index])) return plan
  const network = streetsFor(districts, plan.settings)
  const blocks = settlementBuildings(districts, streetSegments(network), plan.settings, plan.settings.fortified)
  return { ...plan, geometry: { ...geometry, districts, network, blocks } }
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
    (network.crossing === undefined || (settings.water === 'river-city' && record(network.crossing) &&
      [network.crossing.west, network.crossing.east].every((route) => route === undefined ||
        (record(route) && point(route.gate) && path(route.street) && (route.direction === 'east' || route.direction === 'west'))))) &&
    (['river', 'coast', 'river-city', 'river-mouth'].includes(settings.water as string) ? path(water) :
      Array.isArray(water) && (water.length === 0 || path(water)))
}
