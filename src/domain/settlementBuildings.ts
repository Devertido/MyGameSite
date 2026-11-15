import type { Point, SettlementDistrict } from './settlementDistricts.ts'
import { seededRandom, settlementSizes, type SettlementSettings } from './settlementFoundation.ts'

type Segment = readonly [Point, Point]
type BuildingKind = 'house' | 'workshop' | 'stall' | 'citadel' | 'courtyard'
export type BuildingLot = { kind: BuildingKind; footprint: Point[] }

function area(vertices: Point[]) {
  return vertices.reduce((sum, [x, y], index) => {
    const [nx, ny] = vertices[(index + 1) % vertices.length]!
    return sum + x * ny - y * nx
  }, 0) / 2
}

export function insideDistrict([x, y]: Point, polygon: Point[], margin = 0) {
  return polygon.every(([ax, ay], index) => {
    const [bx, by] = polygon[(index + 1) % polygon.length]!
    return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= margin * Math.hypot(bx - ax, by - ay)
  })
}

function segmentHitsBox([a, b]: Segment, low: Point, high: Point) {
  let enter = 0
  let exit = 1
  for (const axis of [0, 1] as const) {
    const delta = b[axis] - a[axis]
    if (Math.abs(delta) < 1e-8) {
      if (a[axis] < low[axis] || a[axis] > high[axis]) return false
      continue
    }
    const from = (low[axis] - a[axis]) / delta
    const to = (high[axis] - a[axis]) / delta
    enter = Math.max(enter, Math.min(from, to))
    exit = Math.min(exit, Math.max(from, to))
    if (enter > exit) return false
  }
  return true
}

export function settlementBuildings(
  districts: SettlementDistrict[], streets: Segment[], settings: SettlementSettings, fortified: boolean,
) {
  const random = seededRandom(settings.seed ^ 0x4db4a32e)
  const citadel = fortified && settlementSizes.indexOf(settings.size) >= 2 ? districts.filter(({ kind }) => kind === 'urban')
    .sort((a, b) => area(b.vertices) - area(a.vertices))[0] : undefined

  return districts.map((district, districtIndex) => {
    const { kind, vertices } = district
    const market = kind === 'square'
    const workshop = kind === 'outskirts' && districtIndex % 3 !== 0
    const fortress = district === citadel
    const lots: BuildingLot[] = []
    const alleys: Segment[] = []
    const sides = vertices.map((start, index) => {
      const end = vertices[(index + 1) % vertices.length]!
      return { start, size: Math.hypot(end[0] - start[0], end[1] - start[1]),
        angle: Math.atan2(end[1] - start[1], end[0] - start[0]) }
    })
    const { start, angle } = sides.reduce((longest, side) => side.size > longest.size ? side : longest)
    const [ox, oy] = start
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const local = ([x, y]: Point): Point => [(x - ox) * cos + (y - oy) * sin, -(x - ox) * sin + (y - oy) * cos]
    const world = ([x, y]: Point): Point => [ox + x * cos - y * sin, oy + x * sin + y * cos]
    const polygon = vertices.map(local)
    const minX = Math.min(...polygon.map(([x]) => x))
    const maxX = Math.max(...polygon.map(([x]) => x))
    const minY = Math.min(...polygon.map(([, y]) => y))
    const maxY = Math.max(...polygon.map(([, y]) => y))
    const middleX = (minX + maxX) / 2
    const localStreets: Segment[] = streets.map(([a, b]) => [local(a), local(b)])
    const stepX = market ? 7 : workshop ? 14 : 11
    const stepY = market ? 7 : workshop ? 11 : 10

    if (!market && !fortress && maxX - minX >= 33 && maxY - minY >= 24) {
      const hits = polygon.flatMap(([x, y], index) => {
        const [nx, ny] = polygon[(index + 1) % polygon.length]!
        if ((x < middleX) === (nx < middleX)) return []
        return [y + (ny - y) * (middleX - x) / (nx - x)]
      }).sort((a, b) => a - b)
      // Reach the block edges so alleys meet the streets or block frontage.
      if (hits.length === 2) {
        const alley: Segment = [[middleX, hits[0]!], [middleX, hits[1]!]]
        alleys.push([world(alley[0]), world(alley[1])])
        localStreets.push(alley)
      }
    }

    function footprint(x: number, y: number, w: number, h: number): Point[] | undefined {
      const bounds: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
      const clearance = market ? 3.7 : 4.1
      if (bounds.some((corner) => !insideDistrict(corner, polygon, market ? 1.4 : 3))) return undefined
      if (localStreets.some((segment) =>
        segmentHitsBox(segment, [x - clearance, y - clearance], [x + w + clearance, y + h + clearance]))) return undefined
      return bounds.map(world)
    }

    if (fortress) {
      for (const [w, h] of [[23, 17], [19, 14], [15, 11], [11, 8], [8, 6]]) {
        const candidates: { shape: Point[]; distance: number }[] = []
        for (let y = minY + 2; y + h < maxY; y += 2) {
          for (let x = minX + 2; x + w < maxX; x += 2) {
            const shape = footprint(x, y, w, h)
            if (shape) candidates.push({ shape, distance: Math.hypot(x + w / 2 - middleX, y + h / 2 - (minY + maxY) / 2) })
          }
        }
        candidates.sort((a, b) => a.distance - b.distance)
        if (candidates[0]) {
          lots.push({ kind: 'citadel', footprint: candidates[0].shape })
          return { lots, alleys }
        }
      }
    }

    for (let y = minY + 2; y < maxY; y += stepY) {
      for (let x = minX + 2; x < maxX; x += stepX) {
        const w = stepX * (0.55 + random() * 0.21)
        const h = stepY * (0.52 + random() * 0.23)
        const shape = footprint(x + random(), y + random(), w, h)
        if (shape && random() > (market ? 0.15 : workshop ? 0.25 : 0.13)) {
          lots.push({ kind: market ? 'stall' : workshop ? 'workshop' : 'house', footprint: shape })
        }
      }
    }

    if (!market && lots.length >= 4) {
      const courtyard = lots[Math.floor(random() * lots.length)]!
      courtyard.kind = 'courtyard'
    }
    return { lots, alleys }
  })
}
