import type { Point } from '../domain/settlementDistricts'

export type Landmark = { point: Point; label: string; kind: 'market' | 'citadel' | 'bridge' | 'pier' | 'ferry' | 'temple' | 'palace' | 'theatre' | 'bank' | 'barracks' }
type Box = { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function drawLocationMapLabels(context: CanvasRenderingContext2D, title: string, landmarks: Landmark[]) {
  const occupied: Box[] = [
    { x: 18, y: 438, w: 430, h: 40 },
    { x: 681, y: 23, w: 48, h: 66 },
    ...landmarks.map(({ point: [x, y] }) => ({ x: x - 9, y: y - 9, w: 18, h: 18 })),
  ]
  context.save()
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  if (title) {
    context.font = 'bold 26px Georgia'
    const titleWidth = Math.min(440, context.measureText(title).width + 28)
    context.fillStyle = '#f0dfb8'
    context.fillRect(27, 28, titleWidth, 42)
    context.strokeStyle = '#795e40'
    context.lineWidth = 1
    context.strokeRect(27, 28, titleWidth, 42)
    context.fillStyle = '#483521'
    context.fillText(title, 41, 49, titleWidth - 28)
    occupied.push({ x: 22, y: 23, w: titleWidth + 10, h: 52 })
  }

  for (const { point: [x, y], label, kind } of landmarks) {
    drawLandmarkIcon(context, x, y, kind)
    context.font = 'bold 14px Georgia'
    const w = context.measureText(label).width + 14
    const h = 21
    const options: Box[] = [
      { x: x + 12, y: y - h / 2, w, h },
      { x: x - 12 - w, y: y - h / 2, w, h },
      { x: x - w / 2, y: y + 12, w, h },
      { x: x - w / 2, y: y - 12 - h, w, h },
    ]
    const box = options.find((candidate) =>
      candidate.x >= 20 && candidate.x + w <= 740 &&
      candidate.y >= 20 && candidate.y + h <= 480 &&
      !occupied.some((other) => overlaps(candidate, other)))
    if (!box) continue
    occupied.push(box)
    context.fillStyle = '#f6e7c8'
    context.fillRect(box.x, box.y, w, h)
    context.strokeStyle = '#795e40'
    context.lineWidth = 0.8
    context.strokeRect(box.x, box.y, w, h)
    context.fillStyle = '#483521'
    context.fillText(label, box.x + 7, box.y + h / 2)
  }
  context.restore()
}

function drawLandmarkIcon(context: CanvasRenderingContext2D, x: number, y: number, kind: Landmark['kind']) {
  context.save()
  context.translate(x, y)
  context.beginPath()
  context.arc(0, 0, 8, 0, Math.PI * 2)
  context.fillStyle = '#f5e7c9'
  context.fill()
  context.strokeStyle = '#563d29'
  context.lineWidth = 1
  context.stroke()

  const icons: Record<Landmark['kind'], Point[]> = {
    market: [[-5, -1], [0, -5], [5, -1], [-5, -1], [-4, 4], [4, 4], [5, -1]],
    citadel: [[-5, 4], [-5, -4], [-3, -4], [-3, -1], [-1, -1], [-1, -4], [1, -4], [1, -1], [3, -1], [3, -4], [5, -4], [5, 4], [-5, 4]],
    bridge: [[-5, 3], [-3, -3], [3, -3], [5, 3], [3, 3], [1, 0], [-1, 0], [-3, 3], [-5, 3]],
    ferry: [[-6, 0], [6, 0], [3, 4], [-3, 4], [-6, 0], [0, -5], [0, 0]],
    temple: [[-5, 4], [-5, -1], [0, -5], [5, -1], [5, 4], [-5, 4]],
    palace: [[-6, 4], [-6, -3], [-3, -1], [0, -5], [3, -1], [6, -3], [6, 4], [-6, 4]],
    theatre: [[-6, -3], [-4, 3], [0, 5], [4, 3], [6, -3], [-6, -3]],
    bank: [[-6, -1], [0, -5], [6, -1], [-6, -1], [-4, 4], [4, 4], [4, -1]],
    barracks: [[-5, 4], [-5, -4], [5, -4], [5, 4], [-5, 4], [0, 0], [5, -4]],
    pier: [[-5, -3], [5, -3], [5, -1], [1, -1], [1, 5], [-1, 5], [-1, -1], [-5, -1], [-5, -3]],
  }
  context.beginPath()
  icons[kind].forEach(([dx, dy], index) => index ? context.lineTo(dx, dy) : context.moveTo(dx, dy))
  context.stroke()
  context.restore()
}
