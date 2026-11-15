import { seededRandom, settlementFoundation, type SettlementSettings } from '../domain/settlementFoundation'

import type { Point, SettlementDistrict } from '../domain/settlementDistricts'
import type { BuildingLot } from '../domain/settlementBuildings'
import { mapHeight as height, mapWidth as width, defaultCrossings, waterXAt, type LandscapeFeature, type LocationMapPlan } from '../domain/locationMapPlan'
import { drawLocationMapLabels, type Landmark } from './locationMapLabels'
import { t } from '../i18n.ts'

function drawPath(context: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  context.beginPath()
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
  context.lineWidth = width
  context.strokeStyle = color
  context.stroke()
}

export function locationMap(plan: LocationMapPlan, title: string): string | undefined {
  const { settings, geometry, markers, fortifications, landscape, civicBuildings } = plan
  const { mode, terrain, fortified } = settings
  const canvas = document.createElement('canvas')
  const resolution = mode === 'settlement' ? 2.3 : 1.4
  canvas.width = width * resolution
  canvas.height = height * resolution
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.scale(resolution, resolution)
  const settlement = mode === 'settlement'
  const { centerX, centerY, scale, waterline, water } = settlementFoundation({
    ...settings, water: settlement ? settings.water : 'river',
  })
  const random = seededRandom(settings.seed ^ 0x75a830fb)
  const bank = water === 'river-city' ? 13 : terrain === 'mountains' ? 20 : 27
  const crossing = centerY
  const cityX = (x: number) => centerX + (x - 297) * scale
  const cityY = (y: number) => centerY + (y - 248) * scale


  const parchment = context.createRadialGradient(360, 240, 80, 370, 240, 470)
  parchment.addColorStop(0, '#f5e9cc')
  parchment.addColorStop(1, '#d0b487')
  context.fillStyle = parchment
  context.fillRect(0, 0, width, height)
  for (let index = 0; index < 3300; index++) {
    context.fillStyle = index % 2 ? '#6c4a1d15' : '#fff2d135'
    context.fillRect(random() * width, random() * height, 1 + random() * 2, 1)
  }

  const rx = 192 * scale
  const ry = 162 * scale
  const island = water === 'island' || water === 'peninsula'
  const cave = water === 'cave' || water === 'underground'
  const land = (x: number, y: number) => Math.hypot((x - centerX) / rx, (y - centerY) / ry) <= 1
  if (island || cave) {
    context.fillStyle = island ? '#395b68' : water === 'underground' ? '#302d31' : '#4a4037'
    context.fillRect(0, 0, width, height)
    if (water === 'peninsula') {
      context.beginPath()
      context.moveTo(0, centerY - 77)
      context.bezierCurveTo(centerX * 0.65, centerY - 75, centerX * 0.6, centerY - 22, centerX, centerY - 47)
      context.lineTo(centerX, centerY + 48)
      context.bezierCurveTo(centerX * 0.6, centerY + 20, centerX * 0.5, centerY + 88, 0, centerY + 77)
      context.fillStyle = parchment
      context.fill()
    }
    const count = 64
    const edge = Array.from({ length: count }, (_, i): Point => {
      const a = i / count * Math.PI * 2
      const r = 1 + Math.sin(a * 7) * 0.034 + Math.cos(a * 11) * 0.025
      return [centerX + Math.cos(a) * rx * r, centerY + Math.sin(a) * ry * r]
    })
    context.beginPath()
    edge.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y))
    context.closePath()
    context.fillStyle = cave ? (water === 'underground' ? '#a39279' : '#c3a782') : parchment
    context.fill()
    context.strokeStyle = island ? '#8daa9a' : '#75624d'
    context.lineWidth = cave ? 7 : 3
    context.stroke()
    if (cave) {
      for (let i = 0; i < 110; i++) {
        const x = 22 + random() * (width - 44)
        const y = 22 + random() * (height - 44)
        if (land(x, y)) continue
        const r = 3 + random() * 10
        drawPath(context, [[x - r, y + 3], [x, y - r], [x + r, y]], '#89776780', 1)
      }
    }
  }

  if (water === 'gorge') {
    for (const sign of [-1, 1]) {
      const rim = (x: number) => centerY + sign * (124 * scale + 8 * Math.sin(x / 42) + 5 * Math.cos(x / 83))
      const ridge: Point[] = Array.from({ length: 78 }, (_, i) => [i * 10, rim(i * 10)])
      context.beginPath()
      ridge.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y))
      context.lineTo(width, sign < 0 ? 0 : height)
      context.lineTo(0, sign < 0 ? 0 : height)
      context.closePath()
      context.fillStyle = '#aa8b68'
      context.fill()
      drawPath(context, ridge, '#634c39', 2)
      for (let x = 7; x < width; x += 9) {
        const y = rim(x)
        drawPath(context, [[x, y], [x - 5, y + sign * (12 + random() * 18)]], '#725942', 1.1)
      }
    }
  }
  for (const { kind, point: [x, y], size } of landscape ?? defaultLandscape(settings)) {
    if (kind === 'mountain') {
      const peak = size * 1.9
      context.beginPath()
      context.moveTo(x - size, y)
      context.lineTo(x, y - peak)
      context.lineTo(x + size, y)
      context.closePath()
      context.fillStyle = '#ab8a69'
      context.fill()
      drawPath(context, [[x - size, y], [x, y - peak], [x + size, y]], '#553d30', 1.7)
      drawPath(context, [[x, y - peak], [x + 1, y - 4], [x + size, y]], '#72543b', 1.2)
      drawPath(context, [[x - size * 0.32, y - peak * 0.68], [x + 1, y - peak * 0.78], [x + size * 0.36, y - peak * 0.68]], '#efe0c2', 1.3)
    } else {
      context.fillStyle = '#70805a'
      context.beginPath()
      context.moveTo(x, y - size)
      context.lineTo(x + size * 0.52, y + size * 0.32)
      context.lineTo(x - size * 0.52, y + size * 0.32)
      context.fill()
      drawPath(context, [[x, y + size * 0.32], [x, y + size * 0.65]], '#675335', 1)
    }
  }

  const waterPoints = geometry?.water ?? Array.from({ length: 132 }, (_, index): Point => {
    const y = -12 + index * 4
    return [waterline(y), y]
  })
  context.lineCap = 'round'
  context.lineJoin = 'round'
  if (water === 'river' || water === 'river-city' || water === 'river-mouth') {
    drawPath(context, waterPoints, '#647d7b', bank * 2 + 2)
    drawPath(context, waterPoints, '#395b68', bank * 2 - 3)
    drawPath(context, waterPoints.map(([x, y]) => [x - 5, y]), '#6b9296', 2)
    if (water === 'river-mouth') {
      const shore: Point[] = Array.from({ length: 77 }, (_, i) => [i * 10, 435 + 5 * Math.sin(i / 6) + 4 * Math.cos(i / 9)])
      context.beginPath()
      shore.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y))
      context.lineTo(width, height)
      context.lineTo(0, height)
      context.closePath()
      context.fillStyle = '#395b68'
      context.fill()
      const mouth = waterXAt(waterPoints, 435, waterline)
      for (const side of [-1, 1]) {
        drawPath(context, shore.filter(([x]) => (x - mouth) * side > bank), '#718e89', 3)
      }
    }
  } else if (water === 'coast') {
    context.beginPath()
    waterPoints.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
    context.lineTo(width, height + 12)
    context.lineTo(width, -12)
    context.closePath()
    context.fillStyle = '#395b68'
    context.fill()
    drawPath(context, waterPoints, '#718e89', 3)
    drawPath(context, waterPoints.map(([x, y]) => [x + 8, y]), '#6b9296', 1.5)
  }

  if (geometry) {
    const { districts, network, blocks } = geometry
    drawDistricts(context, districts)
    for (const { lots, alleys } of blocks) {
      for (const alley of alleys) drawPath(context, [...alley], '#e6c99a', 2)
      for (const lot of lots) drawBuilding(context, lot)
    }
    drawSettlementRoutes(context, fortifications ? { ...network, ...fortifications } : network, settings,
      fortified || Boolean(fortifications), waterPoints, bank)
    drawDistrictLegend(context)
    const landmarks: Landmark[] = [{ kind: 'market', label: t('Рынок'), point: network.squareCenter }]
    const citadel = blocks.flatMap(({ lots }) => lots).find(({ kind }) => kind === 'citadel')
    if (citadel) {
      const [a, , c] = citadel.footprint
      if (a && c) landmarks.push({ kind: 'citadel', label: t('Цитадель'), point: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2] })
    }
    for (const { kind, ends: [a, b] } of plan.crossings ?? defaultCrossings(plan)) {
      context.save()
      if (kind === 'ferry') context.setLineDash([5, 4])
      drawPath(context, [a, b], '#503d30', kind === 'ferry' ? 4 : 10)
      drawPath(context, [a, b], kind === 'ferry' ? '#f2d9a1' : '#c9a775', kind === 'ferry' ? 2 : 5)
      context.restore()
      landmarks.push({ kind, label: t(kind === 'bridge' ? 'Мост' : kind === 'pier' ? 'Пристань' : 'Паром'), point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] })
    }
    for (const { kind, point } of civicBuildings ?? []) {
      const [x, y] = point
      const breadth = kind === 'palace' ? 18 : kind === 'barracks' ? 16 : 12
      const depth = kind === 'theatre' ? 15 : 10
      drawBuilding(context, { kind: 'citadel', footprint: [
        [x - breadth, y - depth], [x + breadth, y - depth], [x + breadth, y + depth], [x - breadth, y + depth],
      ] })
      landmarks.push({ kind, point, label: t(civicBuildingLabels[kind]) })
    }
    drawLocationMapLabels(context, title, landmarks)
    for (const { name, vertices } of districts) {
      if (!name) continue
      const x = vertices.reduce((sum, point) => sum + point[0], 0) / vertices.length
      const y = vertices.reduce((sum, point) => sum + point[1], 0) / vertices.length
      context.font = 'bold 11px Georgia'
      context.textAlign = 'center'
      context.lineWidth = 2.5
      context.strokeStyle = '#f5e9cc'
      context.strokeText(name, x, y, 96)
      context.fillStyle = '#392a20'
      context.fillText(name, x, y, 96)
    }
    for (const { point: [x, y] } of markers ?? []) {
      context.beginPath()
      context.arc(x, y, 5, 0, Math.PI * 2)
      context.fillStyle = '#893b32'
      context.fill()
      context.lineWidth = 1.5
      context.strokeStyle = '#fff4db'
      context.stroke()
    }
  } else {
    const roads: Point[][] = [
      [[22, crossing + 20], [cityX(167), crossing], [centerX, crossing], [675, crossing], [739, crossing - 28]],
      [[cityX(115), 24], [cityX(153), cityY(134)], [cityX(167), crossing], [cityX(141), cityY(370)], [cityX(98), 477]],
    ]
    for (const road of roads) {
      drawPath(context, road, '#866847', 4)
      drawPath(context, road, '#e0c599', 2)
    }

    for (const [x, y] of [[cityX(167), crossing], [675, crossing], [cityX(141), cityY(370)]]) {
      context.fillStyle = '#794a37'
      context.beginPath()
      context.arc(x, y, 5, 0, Math.PI * 2)
      context.fill()
    }

    const bridge = waterline(crossing)
    const span: Point[] = [[bridge - bank - 6, crossing], [bridge + bank + 6, crossing]]
    drawPath(context, span, '#503d30', 11)
    drawPath(context, span, '#dec49a', 6)
  }

  // Compass and double rule.
  context.strokeStyle = '#705439'
  context.lineWidth = 2
  context.strokeRect(12, 12, width - 24, height - 24)
  context.lineWidth = 1
  context.strokeRect(17, 17, width - 34, height - 34)
  const compass: Point[] = [[705, 38], [711, 64], [705, 83], [699, 64], [705, 38]]
  drawPath(context, compass, '#604c35', 1.5)
  drawPath(context, [[686, 64], [724, 64]], '#604c35', 1.5)
  context.fillStyle = '#604c35'
  context.font = 'bold 12px Georgia'
  context.textAlign = 'center'
  context.fillText('N', 705, 35)

  for (const quality of [0.83, 0.68, 0.5]) {
    const image = canvas.toDataURL('image/webp', quality)
    if (image.length <= 900_000 && /^data:image\/(webp|png);base64,/.test(image)) return image
  }
  return undefined
}

export function defaultLandscape(settings: LocationMapPlan['settings']): LandscapeFeature[] {
  const settlement = settings.mode === 'settlement'
  const { terrain } = settings
  const { centerX, centerY, scale, water, waterline } = settlementFoundation({
    ...settings, water: settlement ? settings.water : 'river',
  })
  if (water === 'cave' || water === 'underground') return []
  const random = seededRandom(settings.seed ^ 0x75a830fb)
  // Continue the original sequence after the paper texture and gorge strokes.
  for (let i = 0; i < 3300 * 3; i++) random()
  if (water === 'gorge') for (let i = 0; i < Math.ceil((width - 7) / 9) * 2; i++) random()
  const island = water === 'island' || water === 'peninsula'
  const bank = water === 'river-city' ? 13 : terrain === 'mountains' ? 20 : 27
  const features: LandscapeFeature[] = []
  const count = terrain === 'forest' ? 275 : terrain === 'mountains' ? 125 : 35
  for (let index = 0; index < count; index++) {
    const x = 32 + random() * (width - 64)
    const y = 32 + random() * (height - 64)
    const dx = (x - centerX) / scale
    const dy = (y - centerY) / scale
    if ((island && Math.hypot(dx / 192, dy / 162) > 1) ||
        (['river', 'river-mouth', 'river-city'].includes(water) && Math.abs(x - waterline(y)) < bank + 19) ||
        (water === 'coast' && x > waterline(y) - 19) ||
        (settlement && dx > -127 && dx < 126 && dy > -123 && dy < 117) || Math.abs(y - centerY) < 20) continue
    features.push({ kind: terrain === 'mountains' ? 'mountain' : 'tree', point: [x, y], size: 5 + random() * 7 })
  }
  return features
}

export const civicBuildingLabels = {
  temple: 'Храм', palace: 'Дворец', theatre: 'Театр', bank: 'Банк', barracks: 'Казармы',
} as const

const districtStyle = {
  square: { color: '#d4b16b', label: 'Площадь' },
  urban: { color: '#c99b7d', label: 'Городская застройка' },
  outskirts: { color: '#a7ab83', label: 'Окраины' },
} as const

function drawDistricts(context: CanvasRenderingContext2D, districts: SettlementDistrict[]) {
  for (const { kind, vertices } of districts) {
    context.beginPath()
    vertices.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
    context.closePath()
    context.fillStyle = districtStyle[kind].color
    context.fill()
    context.strokeStyle = '#654d38'
    context.lineWidth = 1.5
    context.stroke()
  }

}

function drawDistrictLegend(context: CanvasRenderingContext2D) {
  context.fillStyle = '#f2e1ba'
  context.fillRect(25, 438, 420, 32)
  context.strokeStyle = '#8b6a46'
  context.lineWidth = 1
  context.strokeRect(25, 438, 420, 32)
  context.font = '14px Georgia'
  context.textAlign = 'left'
  let x = 37
  for (const { color, label } of Object.values(districtStyle)) {
    const text = t(label)
    context.fillStyle = color
    context.fillRect(x, 447, 14, 14)
    context.strokeRect(x, 447, 14, 14)
    context.fillStyle = '#493625'
    context.fillText(text, x + 22, 458)
    x += context.measureText(text).width + 44
  }
}

function drawSettlementRoutes(
  context: CanvasRenderingContext2D, network: NonNullable<LocationMapPlan['geometry']>['network'], settings: SettlementSettings, fortified: boolean, waterPoints: Point[], bank: number,
) {
  const { interior, routes, walls, towers } = network
  const { water, waterline, centerX, centerY, scale } = settlementFoundation(settings)
  const enclosed = ['island', 'peninsula', 'cave', 'underground'].includes(water)
  const ellipseX = (y: number) => 192 * scale * Math.sqrt(Math.max(0, 1 - ((y - centerY) / (162 * scale)) ** 2))
  const ellipseY = (x: number) => 162 * scale * Math.sqrt(Math.max(0, 1 - ((x - centerX) / (192 * scale)) ** 2))
  for (const segment of interior) {
    drawPath(context, [...segment], '#94704f', 3.5)
    drawPath(context, [...segment], '#f0d8a6', 2)
  }

  for (const { direction, gate, street } of routes) {
    const [x, y] = gate
    const shore = waterXAt(waterPoints, y, waterline)
    const east = water === 'coast' ? shore - 4 : water === 'river' || water === 'river-mouth' ? shore - bank :
      enclosed ? Math.min(width - 21, centerX + ellipseX(y) - 10) : width - 21
    const exits: Record<typeof direction, Point> = {
      west: [enclosed && water !== 'peninsula' ? Math.max(21, centerX - ellipseX(y) + 10) : 21, y],
      east: [east, y],
      north: [x, enclosed ? Math.max(21, centerY - ellipseY(x) + 10) : 21],
      south: [x, enclosed ? Math.min(height - 21, centerY + ellipseY(x) - 10) : height - 21],
    }
    const path = [exits[direction], ...street]
    drawPath(context, path, '#7d603f', 7)
    drawPath(context, path, '#ead1a0', 4.5)

  }

  const crossing = 'crossing' in network ? network.crossing : undefined
  if (crossing?.west && crossing.east) {
    for (const half of [crossing.west, crossing.east]) {
      drawPath(context, half.street, '#7d603f', 7)
      drawPath(context, half.street, '#ead1a0', 4.5)
    }

  }

  if (fortified) {
    for (const wall of walls) {
      drawPath(context, [...wall], '#4b433b', 5)
      drawPath(context, [...wall], '#aea297', 2.5)
    }
    for (const [x, y] of towers) {
      context.beginPath()
      context.arc(x, y, 4, 0, Math.PI * 2)
      context.fillStyle = '#c1b3a5'
      context.fill()
      context.strokeStyle = '#4b433b'
      context.lineWidth = 1.5
      context.stroke()
    }
  }
}

const buildingColors = {
  house: '#8e503c', workshop: '#6b6250', stall: '#b55c33', citadel: '#716d69', courtyard: '#b6a477',
} as const

function drawBuilding(context: CanvasRenderingContext2D, { kind, footprint }: BuildingLot) {
  const [a, b, c, d] = footprint
  if (!a || !b || !c || !d) return
  context.beginPath()
  context.moveTo(...a)
  for (const point of footprint.slice(1)) context.lineTo(...point)
  context.closePath()
  context.fillStyle = buildingColors[kind]
  context.fill()
  context.strokeStyle = '#503d31'
  context.lineWidth = kind === 'citadel' ? 2 : 0.7
  context.stroke()
  if (kind === 'courtyard') return

  const ridgeStart: Point = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2]
  const ridgeEnd: Point = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]
  context.save()
  context.beginPath()
  context.moveTo(...ridgeStart)
  context.lineTo(...a)
  context.lineTo(...b)
  context.lineTo(...ridgeEnd)
  context.closePath()
  context.fillStyle = '#fff0c940'
  context.fill()
  drawPath(context, [ridgeStart, ridgeEnd], '#f1d39e', kind === 'citadel' ? 1.5 : 1)
  context.restore()
  if (kind === 'citadel') {
    for (const [x, y] of footprint) {
      context.fillStyle = '#a89c8e'
      context.fillRect(x - 1.4, y - 1.4, 2.8, 2.8)
    }
  }
}
