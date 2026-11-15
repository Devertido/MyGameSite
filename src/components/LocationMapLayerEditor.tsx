import { useState, type PointerEvent } from 'react'
import { mapHeight, mapWidth, type Fortifications, type LocationMapPlan } from '../domain/locationMapPlan'
import type { Point } from '../domain/settlementDistricts'
import { t } from '../i18n.ts'
import { defaultLandscape } from './locationMap'

export type MapLayer = 'walls' | 'landscape'

type Tool = 'move' | 'remove' | 'wall' | 'tower' | 'tree' | 'mountain'
type Handle = { kind: 'wall' | 'tower' | 'feature'; index: number; point: Point }

const toolNames: Record<Tool, string> = {
  move: 'Переместить', remove: 'Удалить', wall: 'Добавить стену', tower: 'Добавить башню',
  tree: 'Добавить дерево', mountain: 'Добавить гору',
}

function near(a: Point, b: Point, tolerance = 0.001) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < tolerance
}

export function LocationMapLayerEditor({ layer, plan, image, onUpdate }: {
  layer: MapLayer
  plan: LocationMapPlan
  image: string
  onUpdate: (form: HTMLFormElement | null, plan: LocationMapPlan) => boolean
}) {
  const [tool, setTool] = useState<Tool>('move')
  const [wallStart, setWallStart] = useState<Point>()
  const [drag, setDrag] = useState<{ handle: Handle; target: Point }>()
  const wallsMode = layer === 'walls'
  const network = plan.geometry?.network
  const fortifications: Fortifications = plan.fortifications ?? {
    walls: plan.settings.fortified ? network?.walls ?? [] : [],
    towers: plan.settings.fortified ? network?.towers ?? [] : [],
  }
  const { walls, towers } = fortifications
  const features = wallsMode ? [] : plan.landscape ?? defaultLandscape(plan.settings)
  const tools: Tool[] = wallsMode ? ['move', 'wall', 'tower', 'remove'] : ['move', 'tree', 'mountain', 'remove']
  const svgCoordinates = (event: PointerEvent<SVGElement>): Point => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement!
    const box = svg.getBoundingClientRect()
    return [
      Math.round(Math.max(0, Math.min(mapWidth, (event.clientX - box.left) / box.width * mapWidth))),
      Math.round(Math.max(0, Math.min(mapHeight, (event.clientY - box.top) / box.height * mapHeight))),
    ]
  }
  const saveWalls = (form: HTMLFormElement | null, changes: Partial<Fortifications>) =>
    onUpdate(form, { ...plan, fortifications: { ...fortifications, ...changes } })
  const saveFeatures = (form: HTMLFormElement | null, landscape: typeof features) =>
    onUpdate(form, { ...plan, landscape })
  const endpoints = Array.from(new Map(walls.flat().map((point) => [
    point.map((coordinate) => coordinate.toFixed(3)).join(','), point,
  ])).values())

  function add(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !event.isPrimary) return
    const form = event.currentTarget.closest('form')
    const cursor = svgCoordinates(event)
    const point = endpoints.find((endpoint) => near(endpoint, cursor, 7)) ?? cursor
    if (tool === 'wall' && walls.length < 2048) {
      if (!wallStart) setWallStart(point)
      else if (!near(wallStart, point, 3) && !walls.some(([a, b]) =>
        (near(a, wallStart) && near(b, point)) || (near(b, wallStart) && near(a, point)))) {
        if (saveWalls(form, { walls: [...walls, [wallStart, point]] })) setWallStart(undefined)
      }
    } else if (tool === 'tower' && towers.length < 2048 && !towers.some((tower) => near(tower, point, 3))) {
      saveWalls(form, { towers: [...towers, point] })
    } else if ((tool === 'tree' || tool === 'mountain') && features.length < 400) {
      saveFeatures(form, [...features, { kind: tool, point: cursor, size: tool === 'tree' ? 9 : 12 }])
    }
  }

  function move(form: HTMLFormElement | null, handle: Handle, target: Point) {
    if (near(handle.point, target, 1)) return
    if (handle.kind === 'feature') {
      const [dx, dy] = [target[0] - handle.point[0], target[1] - handle.point[1]]
      saveFeatures(form, features.map((feature, index) => index === handle.index ? {
        ...feature, point: [
          Math.max(0, Math.min(mapWidth, feature.point[0] + dx)),
          Math.max(0, Math.min(mapHeight, feature.point[1] + dy)),
        ],
      } : feature))
      return
    }
    const replace = (point: Point) => near(point, handle.point) ? target : point
    if (handle.kind === 'tower' && !endpoints.some((point) => near(point, handle.point))) {
      saveWalls(form, { towers: towers.map((point, index) => index === handle.index ? target : point) })
      return
    }
    const shifted = walls.map(([a, b]) => [replace(a), replace(b)] as const)
    if (shifted.some(([a, b]) => near(a, b, 1))) return
    saveWalls(form, { walls: shifted, towers: towers.map(replace) })
  }

  function renderHandle(handle: Handle) {
    const selected = drag?.handle.kind === handle.kind && drag.handle.index === handle.index
    const [x, y] = selected && drag ? drag.target : handle.point
    return <circle key={handle.kind + '-' + handle.index} className="location-map-layer-handle"
      data-tool={tool} cx={x} cy={y} r={handle.kind === 'tower' ? 5 : 4}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        const form = event.currentTarget.closest('form')
        if (tool === 'remove') {
          if (handle.kind === 'tower') saveWalls(form, { towers: towers.filter((_, index) => index !== handle.index) })
          if (handle.kind === 'feature') saveFeatures(form, features.filter((_, index) => index !== handle.index))
          return
        }
        if (tool !== 'move') return
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ handle, target: handle.point })
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setDrag({ handle, target: svgCoordinates(event) })
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        move(event.currentTarget.closest('form'), handle, svgCoordinates(event))
        setDrag(undefined)
      }}
      onLostPointerCapture={() => setDrag(undefined)} onPointerCancel={() => setDrag(undefined)} />
  }

  return <>
    <div className="location-map-editor-actions">
      {tools.map((action) => <button key={action} type="button" aria-pressed={action === tool}
        onClick={() => { setTool(action); setWallStart(undefined) }}>{t(toolNames[action])}</button>)}
    </div>
    <p>{t(tool === 'wall' ? (wallStart ? 'Выберите конец стены.' : 'Выберите начало стены.')
      : tool === 'move' ? 'Перетащите точку на карте.'
        : tool === 'remove' ? 'Нажмите на элемент, который хотите убрать.' : 'Нажмите на карту, чтобы добавить элемент.')}</p>
    <div className="location-map-edit-view">
      <img className="location-map-layer-image" src={image} alt={t('Предпросмотр')} draggable={false} />
      <svg className="location-map-layer" data-tool={tool} viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        aria-hidden="true" onPointerDown={add}>
        {wallsMode && walls.map(([a, b], index) => <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          onPointerDown={(event) => {
            if (tool === 'remove' && event.button === 0 && event.isPrimary) {
              saveWalls(event.currentTarget.closest('form'), { walls: walls.filter((_, i) => i !== index) })
            }
          }} />)}
        {wallsMode && tool === 'move' && endpoints.map((point, index) => renderHandle({ kind: 'wall', point, index }))}
        {wallsMode && towers.map((point, index) => renderHandle({ kind: 'tower', point, index }))}
        {!wallsMode && features.map(({ point, size, kind }, index) => renderHandle({
          kind: 'feature', index, point: [point[0], point[1] - size * (kind === 'tree' ? 0.35 : 0.7)],
        }))}
        {wallStart && <circle className="location-map-wall-start" cx={wallStart[0]} cy={wallStart[1]} r="5" />}
      </svg>
    </div>
  </>
}
