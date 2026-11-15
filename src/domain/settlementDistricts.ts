import { seededRandom, settlementFoundation, type SettlementSettings } from './settlementFoundation.ts'

export type Point = readonly [x: number, y: number]
type DistrictKind = 'square' | 'urban' | 'outskirts'
export type SettlementDistrict = { kind: DistrictKind; vertices: Point[]; name?: string }

const rings = {
  village: [4, 5],
  town: [6, 9],
  city: [8, 14],
  metropolis: [11, 19],
  megalopolis: [15, 26],
  ecumenopolis: [21, 34],
} as const

function clipCell(vertices: Point[], site: Point, neighbor: Point): Point[] {
  const dx = neighbor[0] - site[0]
  const dy = neighbor[1] - site[1]
  const midpointX = (site[0] + neighbor[0]) / 2
  const midpointY = (site[1] + neighbor[1]) / 2
  const result: Point[] = []

  for (let index = 0; index < vertices.length; index++) {
    const end = vertices[index]!
    const start = vertices[(index + vertices.length - 1) % vertices.length]!
    const from = (start[0] - midpointX) * dx + (start[1] - midpointY) * dy
    const to = (end[0] - midpointX) * dx + (end[1] - midpointY) * dy

    if ((from <= 0) !== (to <= 0)) {
      const fraction = from / (from - to)
      result.push([
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ])
    }
    if (to <= 0) result.push(end)
  }

  return result
}

export function settlementDistricts(settings: SettlementSettings): SettlementDistrict[] {
  const { centerX, centerY, scale } = settlementFoundation(settings)
  const random = seededRandom(settings.seed ^ 0x2f5184b9)
  const radiusX = 124 * scale
  const radiusY = 106 * scale
  const [urbanCount, outskirtsCount] = rings[settings.size]

  function ring(count: number, inner: number, outer: number): Point[] {
    const rotation = random() * Math.PI * 2
    return Array.from({ length: count }, (_, index) => {
      const angle = rotation + (index + (random() - 0.5) * 0.38) * Math.PI * 2 / count
      const radius = inner + random() * (outer - inner)
      return [centerX + Math.cos(angle) * radiusX * radius, centerY + Math.sin(angle) * radiusY * radius]
    })
  }

  const sites: Point[] = [[centerX, centerY], ...ring(urbanCount, 0.36, 0.55), ...ring(outskirtsCount, 0.63, 0.79)]
  // Extra sites terminate the town's outer cells at different distances.
  const neighbors = [...sites, ...ring(outskirtsCount + 5, 1.0, 1.32)]
  const bounds: Point[] = [
    [centerX - radiusX, centerY - radiusY], [centerX + radiusX, centerY - radiusY],
    [centerX + radiusX, centerY + radiusY], [centerX - radiusX, centerY + radiusY],
  ]

  return sites.map((site, index) => ({
    kind: index === 0 ? 'square' : index <= urbanCount ? 'urban' : 'outskirts',
    vertices: neighbors.reduce((polygon, neighbor) =>
      neighbor === site ? polygon : clipCell(polygon, site, neighbor), bounds),
  }))
}
