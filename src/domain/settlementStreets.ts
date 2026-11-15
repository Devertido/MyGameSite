import type { Point, SettlementDistrict } from './settlementDistricts.ts'

type Segment = readonly [Point, Point]
type Edge = { ends: Segment; districts: number[] }
type Route = { direction: 'west' | 'east' | 'north' | 'south'; gate: Point; street: Point[] }
const pointKey = ([x, y]: Point) => Math.round(x * 1e5) + ',' + Math.round(y * 1e5)
const distance = ([x, y]: Point, [a, b]: Point) => Math.hypot(x - a, y - b)
const midpoint = ([a, b]: Segment): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

export function settlementStreets(districts: SettlementDistrict[], entries: number) {
  const edges = new Map<string, Edge>()
  const points = new Map<string, Point>()
  districts.forEach(({ vertices }, district) => vertices.forEach((start, index) => {
    const end = vertices[(index + 1) % vertices.length]!
    const a = pointKey(start)
    const b = pointKey(end)
    if (a === b) return
    points.set(a, start)
    points.set(b, end)
    const key = [a, b].sort().join(':')
    const edge = edges.get(key)
    if (edge) edge.districts.push(district)
    else edges.set(key, { ends: [start, end], districts: [district] })
  }))

  const interior: Segment[] = []
  const boundary: Edge[] = []
  const adjacent = new Map<string, string[]>()
  function connect(a: string, b: string) {
    const neighbors = adjacent.get(a) ?? []
    neighbors.push(b)
    adjacent.set(a, neighbors)
  }
  for (const edge of edges.values()) {
    if (edge.districts.length === 1) {
      boundary.push(edge)
    } else {
      interior.push(edge.ends)
      const [a, b] = edge.ends.map(pointKey)
      connect(a!, b!)
      connect(b!, a!)
    }
  }

  // One multi-source shortest-path search serves all approaches to the central square.
  const square = districts.find(({ kind }) => kind === 'square')!
  const squareCenter: Point = [
    square.vertices.reduce((sum, [x]) => sum + x, 0) / square.vertices.length,
    square.vertices.reduce((sum, [, y]) => sum + y, 0) / square.vertices.length,
  ]
  const pending = new Set<string>()
  const lengths = new Map<string, number>()
  const towardSquare = new Map<string, string>()
  for (const point of square.vertices) {
    const key = pointKey(point)
    lengths.set(key, distance(point, squareCenter))
    pending.add(key)
  }
  while (pending.size > 0) {
    const [current] = [...pending].sort((a, b) => lengths.get(a)! - lengths.get(b)!)
    pending.delete(current!)
    for (const next of adjacent.get(current!) ?? []) {
      const length = lengths.get(current!)! + distance(points.get(current!)!, points.get(next)!)
      if (length >= (lengths.get(next) ?? Infinity)) continue
      lengths.set(next, length)
      towardSquare.set(next, current!)
      pending.add(next)
    }
  }

  const directions = ['west', 'east', 'north', 'south'] as const
  const routes: Route[] = []
  const gates = new Map<Edge, Point>()
  for (const direction of directions.slice(0, entries)) {
    const axis = direction === 'west' || direction === 'east' ? 0 : 1
    const crossAxis = axis === 0 ? 1 : 0
    const sign = direction === 'west' || direction === 'north' ? -1 : 1
    const candidates = boundary.filter((edge) => {
      if (gates.has(edge) || distance(...edge.ends) < 2 ||
        !districts[edge.districts[0]!]!.vertices.some((point) => lengths.has(pointKey(point)))) return false
      const gate = midpoint(edge.ends)
      const side = gate[crossAxis]
      // The approach from outside must meet this edge first.
      return !boundary.some((other) => {
        if (other === edge) return false
        const [a, b] = other.ends
        if (side < Math.min(a[crossAxis], b[crossAxis]) || side > Math.max(a[crossAxis], b[crossAxis])) return false
        if (a[crossAxis] === b[crossAxis]) return Math.max(sign * a[axis], sign * b[axis]) > sign * gate[axis] + 1e-6
        const fraction = (side - a[crossAxis]) / (b[crossAxis] - a[crossAxis])
        return sign * (a[axis] + fraction * (b[axis] - a[axis]) - gate[axis]) > 1e-6
      })
    })
    candidates.sort((a, b) => sign * (midpoint(b.ends)[axis] - midpoint(a.ends)[axis]))
    const edge = candidates.find((candidate) => distance(...candidate.ends) >= 8) ?? candidates[0]
    if (!edge) continue
    const gate = midpoint(edge.ends)
    const district = districts[edge.districts[0]!]!
    const [first] = district.vertices.map(pointKey).filter((key) => lengths.has(key)).sort((a, b) =>
      lengths.get(a)! + distance(gate, points.get(a)!) - lengths.get(b)! - distance(gate, points.get(b)!))
    if (!first) continue
    const street: Point[] = [gate, points.get(first)!]
    for (let next = towardSquare.get(first); next; next = towardSquare.get(next)) street.push(points.get(next)!)
    street.push(squareCenter)
    gates.set(edge, gate)
    routes.push({ direction, gate, street })
  }

  const walls: Segment[] = []
  const towers: Point[] = []
  for (const [index, edge] of boundary.entries()) {
    const gate = gates.get(edge)
    const [a, b] = edge.ends
    if (gate) {
      const fraction = Math.min(0.32, 5 / distance(a, b))
      const left: Point = [gate[0] + (a[0] - b[0]) * fraction, gate[1] + (a[1] - b[1]) * fraction]
      const right: Point = [gate[0] + (b[0] - a[0]) * fraction, gate[1] + (b[1] - a[1]) * fraction]
      walls.push([a, left], [right, b])
      towers.push(left, right)
    } else {
      walls.push(edge.ends)
      if (index % 3 === 0 && distance(a, b) > 12) towers.push(midpoint(edge.ends))
    }
  }

  return { interior, routes, walls, towers, squareCenter }
}
