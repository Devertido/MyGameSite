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

function buildGeometry(settings: LocationMapSettings) {
  const { waterline } = settlementFoundation(settings)
  const districts = settlementDistricts(settings)
  const network = settlementStreets(districts, settlementSizes.indexOf(settings.size) >= 2 ? 4 : 3)
  const mainSegments = network.routes.flatMap(({ street }) => street.slice(1).map((point, index) =>
    [street[index]!, point] as const))
  const blocks = settlementBuildings(districts, mainSegments, settings, settings.fortified)
  const water: Point[] = []
  if (settings.water !== 'inland') {
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
  const mainSegments = geometry.network.routes.flatMap(({ street }) => street.slice(1).map((point, i) =>
    [street[i]!, point] as const))
  const replacement = settlementBuildings(geometry.districts, mainSegments, { ...plan.settings, seed }, plan.settings.fortified)[index]!
  return { ...plan, geometry: { ...geometry, blocks: geometry.blocks.map((block, i) => i === index ? replacement : block) } }
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
    (settings.water === 'inland' ? Array.isArray(water) && water.length === 0 : path(water))
}
