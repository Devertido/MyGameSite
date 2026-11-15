export type MapMode = 'settlement' | 'terrain'
export type Terrain = 'plains' | 'forest' | 'mountains'
type Point = readonly [number, number]

const width = 760
const height = 500

function drawPath(context: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  context.beginPath()
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
  context.lineWidth = width
  context.strokeStyle = color
  context.stroke()
}

export function locationMap(mode: MapMode, terrain: Terrain): string | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const random = Math.random
  const offset = random() * Math.PI * 2
  const river = (y: number) => 487 + 38 * Math.sin(y / 89 + offset) + 20 * Math.cos(y / 57)
  const bank = terrain === 'mountains' ? 20 : 27
  const crossing = 220 + Math.round(random() * 55)
  const settlement = mode === 'settlement'

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
    if (Math.abs(x - river(y)) < bank + 19 ||
      (settlement && x > 170 && x < 423 && y > 125 && y < 365) ||
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

  const riverPoints: Point[] = []
  for (let y = -12; y <= height + 12; y += 4) riverPoints.push([river(y), y])
  context.lineCap = 'round'
  context.lineJoin = 'round'
  drawPath(context, riverPoints, '#647d7b', bank * 2 + 2)
  drawPath(context, riverPoints, '#426771', bank * 2 - 3)
  drawPath(context, riverPoints.map(([x, y]) => [x - 5, y]), '#6b9296', 2)

  const roads: Point[][] = [
    [[22, crossing + 20], [166, crossing], [389, crossing], [river(crossing), crossing], [610, crossing], [739, crossing - 28]],
    [[104, 24], [155, 134], [166, crossing], [119, 366], [75, 477]],
  ]
  if (settlement) {
    roads.push([[210, 152], [385, 152], [410, 186], [410, 315], [385, 345], [208, 345], [182, 312], [182, 184], [210, 152]])
    roads.push([[251, 152], [251, 345]], [[336, 152], [336, 345]])
  }
  for (const road of roads) {
    drawPath(context, road, '#866847', settlement ? 8 : 4)
    drawPath(context, road, '#e0c599', settlement ? 5 : 2)
  }

  if (settlement) {
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 9; column++) {
        const x = 206 + column * 22 + random() * 5
        const y = 170 + row * 24 + random() * 6
        if (Math.abs(y - crossing) < 13 || Math.abs(x - 251) < 11 ||
          Math.abs(x - 336) < 11 || (row >= 2 && row <= 4 && column === 4) || random() < 0.18) continue
        const w = 9 + random() * 7
        const h = 8 + random() * 8
        context.fillStyle = row % 3 === 0 ? '#95734c' : '#985b43'
        context.fillRect(x, y, w, h)
        context.strokeStyle = '#5f432d'
        context.lineWidth = 1
        context.strokeRect(x, y, w, h)
        drawPath(context, [[x, y + h / 2], [x + w, y + h / 2]], '#e5b98d', 0.8)
      }
    }
    context.fillStyle = '#ae9161'
    context.fillRect(278, crossing - 14, 38, 28)
    context.strokeStyle = '#745436'
    context.strokeRect(278, crossing - 14, 38, 28)
    context.fillStyle = '#66513c'
    context.fillRect(291, crossing - 6, 12, 12)
  } else {
    for (const [x, y] of [[166, crossing], [610, crossing], [119, 366]]) {
      context.fillStyle = '#794a37'
      context.beginPath()
      context.arc(x, y, 5, 0, Math.PI * 2)
      context.fill()
    }
  }

  const bridge = river(crossing)
  drawPath(context, [[bridge - bank - 6, crossing], [bridge + bank + 6, crossing]], '#503d30', 11)
  drawPath(context, [[bridge - bank - 6, crossing], [bridge + bank + 6, crossing]], '#dec49a', 6)

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
