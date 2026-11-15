import { seededRandom, settlementFoundation, type SettlementSettings } from '../domain/settlementFoundation'

import { settlementDistricts, type Point, type SettlementDistrict } from '../domain/settlementDistricts'
import { settlementStreets } from '../domain/settlementStreets'
import { t } from '../i18n.ts'

export type MapMode = 'settlement' | 'terrain'
export type Terrain = 'plains' | 'forest' | 'mountains'

const width = 760
const height = 500

function drawPath(context: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  context.beginPath()
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
  context.lineWidth = width
  context.strokeStyle = color
  context.stroke()
}

export function locationMap(mode: MapMode, terrain: Terrain, settings: SettlementSettings, fortified: boolean): string | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const settlement = mode === 'settlement'
  const { centerX, centerY, scale, waterline, water } = settlementFoundation({
    ...settings, water: settlement ? settings.water : 'river',
  })
  const random = seededRandom(settings.seed ^ 0x75a830fb)
  const bank = terrain === 'mountains' ? 20 : 27
  const crossing = centerY
  const cityX = (x: number) => centerX + (x - 297) * scale
  const cityY = (y: number) => centerY + (y - 248) * scale


  const parchment = context.createRadialGradient(360, 240, 80, 370, 240, 470)
  parchment.addColorStop(0, '#f4e6c4')
  parchment.addColorStop(1, '#d8bc8a')
  context.fillStyle = parchment
  context.fillRect(0, 0, width, height)
  for (let index = 0; index < 3300; index++) {
    context.fillStyle = index % 2 ? '#6c4a1d15' : '#fff2d135'
    context.fillRect(random() * width, random() * height, 1 + random() * 2, 1)
  }

  // Sketch mountain ridges and woodland outside the settlement and river.
  for (let index = 0; index < (terrain === 'plains' ? 35 : 94); index++) {
    const x = 32 + random() * (width - 64)
    const y = 32 + random() * (height - 64)
    if ((water === 'river' && Math.abs(x - waterline(y)) < bank + 19) ||
      (water === 'coast' && x > waterline(y) - 19) ||
      (settlement && x > cityX(170) && x < cityX(423) && y > cityY(125) && y < cityY(365)) ||
      Math.abs(y - crossing) < 20) continue
    const size = 5 + random() * 7
    if (terrain === 'mountains') {
      const peak = size * 1.65
      drawPath(context, [[x - size, y], [x, y - peak], [x + size, y]], '#765a40', 1.4)
      drawPath(context, [[x, y - peak], [x + 2, y - 4], [x + size, y]], '#9c7b55', 1)
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

  const waterPoints: Point[] = []
  for (let y = -12; y <= height + 12; y += 4) waterPoints.push([waterline(y), y])
  context.lineCap = 'round'
  context.lineJoin = 'round'
  if (water === 'river') {
    drawPath(context, waterPoints, '#647d7b', bank * 2 + 2)
    drawPath(context, waterPoints, '#426771', bank * 2 - 3)
    drawPath(context, waterPoints.map(([x, y]) => [x - 5, y]), '#6b9296', 2)
  } else if (water === 'coast') {
    context.beginPath()
    waterPoints.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
    context.lineTo(width, height + 12)
    context.lineTo(width, -12)
    context.closePath()
    context.fillStyle = '#426771'
    context.fill()
    drawPath(context, waterPoints, '#718e89', 3)
    drawPath(context, waterPoints.map(([x, y]) => [x + 8, y]), '#6b9296', 1.5)
  }

  if (settlement) {
    const districts = settlementDistricts(settings)
    drawDistricts(context, districts)
    drawSettlementRoutes(context, districts, settings, fortified, bank)
    drawDistrictLegend(context)
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

  const image = canvas.toDataURL('image/webp', 0.8)
  return image.length <= 900_000 && image.startsWith('data:image/') ? image : undefined
}

const districtStyle = {
  square: { color: '#d4a556', label: 'Площадь' },
  urban: { color: '#bf8664', label: 'Городская застройка' },
  outskirts: { color: '#a5ab7d', label: 'Окраины' },
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
  context: CanvasRenderingContext2D, districts: SettlementDistrict[], settings: SettlementSettings, fortified: boolean, bank: number,
) {
  const { interior, routes, walls, towers } = settlementStreets(districts, settings.size === 'city' ? 4 : 3)
  const { water, waterline } = settlementFoundation(settings)
  for (const segment of interior) {
    drawPath(context, [...segment], '#94704f', 3.5)
    drawPath(context, [...segment], '#f0d8a6', 2)
  }

  for (const { direction, gate, street } of routes) {
    const [x, y] = gate
    const east = water === 'coast' ? waterline(y) - 4 : width - 21
    const exits: Record<typeof direction, Point> = {
      west: [21, y], east: [east, y], north: [x, 21], south: [x, height - 21],
    }
    const path = [exits[direction], ...street]
    drawPath(context, path, '#7d603f', 7)
    drawPath(context, path, '#ead1a0', 4.5)
    if (direction === 'east' && water === 'river') {
      const crossing = waterline(y)
      const bridge: Point[] = [[crossing - bank - 5, y], [crossing + bank + 5, y]]
      drawPath(context, bridge, '#4c3f35', 10)
      drawPath(context, bridge, '#d9b88c', 6)
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
