import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { brushDisplacement, mapHeight, mapWidth, moveDistrictCorner, rerollDistrict, warpDistricts, type LocationMapPlan } from '../domain/locationMapPlan'
import type { Point } from '../domain/settlementDistricts'
import { t } from '../i18n.ts'
import { locationMap } from './locationMap'

export type MapLocationLink = { id: string; title: string }

export function LocationMapEditor({ plan, image, locations, onChange }: {
  plan: LocationMapPlan
  image: string
  locations: MapLocationLink[]
  onChange: (image: string, plan: LocationMapPlan) => void
}) {
  const [districtIndex, setDistrictIndex] = useState(0)
  const [districtName, setDistrictName] = useState(plan.geometry?.districts[0]?.name ?? '')
  const [point, setPoint] = useState<Point>()
  const [name, setName] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState('')
  const [drag, setDrag] = useState<{ index: number; point: Point }>()
  const view = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{ plan: LocationMapPlan; image: string }>()
  const [radius, setRadius] = useState(90)
  const [cursor, setCursor] = useState<Point>()
  const [stroke, setStroke] = useState<{ origin: Point; target: Point }>()
  const warping = draft !== undefined

  useEffect(() => {
    const canvas = view.current
    if (!warping || !canvas) return
    function resizeBrush(event: WheelEvent) {
      event.preventDefault()
      setRadius((value) => Math.max(25, Math.min(250, value + (event.deltaY < 0 ? 10 : -10))))
    }
    canvas.addEventListener('wheel', resizeBrush, { passive: false })
    return () => canvas.removeEventListener('wheel', resizeBrush)
  }, [warping])

  const geometry = (draft?.plan ?? plan).geometry
  if (!geometry) return null
  const selected = geometry.districts[districtIndex]
  const markers = plan.markers ?? []

  function update(form: HTMLFormElement | null, next: LocationMapPlan) {
    const field = form?.elements.namedItem('title')
    const title = field instanceof HTMLInputElement ? field.value.trim() : ''
    const updated = locationMap(next, title)
    setError(updated ? '' : t('Не удалось сгенерировать карту.'))
    if (updated) onChange(updated, next)
    return Boolean(updated)
  }

  function coordinates(clientX: number, clientY: number): Point {
    const box = view.current!.getBoundingClientRect()
    return [
      Math.round(Math.max(0, Math.min(mapWidth, (clientX - box.left) / box.width * mapWidth))),
      Math.round(Math.max(0, Math.min(mapHeight, (clientY - box.top) / box.height * mapHeight))),
    ]
  }

  return <details className="location-map-editor">
    <summary>{t('Редактор плана поселения')}</summary>
    <div className="location-map-editor-actions">
      <button type="button" aria-pressed={warping} onClick={() => {
        if (warping) setDraft(undefined)
        else setDraft({ plan, image })
        setError('')
        setCursor(undefined)
        setStroke(undefined)
      }}>{t('Планировка')}</button>
      {draft && <>
        <label>{t('Радиус кисти')} <input type="range" min={25} max={250} step={5} value={radius}
          onChange={(event) => setRadius(Number(event.currentTarget.value))} /></label>
        <button type="button" disabled={draft.plan === plan} onClick={() => {
          onChange(draft.image, draft.plan)
          setDraft(undefined)
          setError('')
          setPoint(undefined)
        }}>{t('Применить')}</button>
        <button type="button" onClick={() => {
          setDraft(undefined)
          setError('')
        }}>{t('Отмена')}</button>
      </>}
    </div>
    {warping && <p>{t('Потяните карту кистью. Колёсико изменяет радиус.')}</p>}
    <fieldset hidden={warping} disabled={warping} className="location-map-tools">
    <label>{t('Квартал')}
      <select value={districtIndex} onChange={(event) => {
        const index = Number(event.currentTarget.value)
        setDistrictIndex(index)
        setDistrictName(geometry.districts[index]?.name ?? '')
      }}>
        {geometry.districts.map(({ name, kind }, index) => (
          <option key={index} value={index}>{index + 1} · {name || t(kind === 'square' ? 'Площадь' : kind === 'urban' ? 'Городская застройка' : 'Окраины')}</option>
        ))}
      </select>
    </label>
    <div className="location-map-editor-actions">
      <label>{t('Название квартала')}<input maxLength={80} value={districtName} onChange={(event) => setDistrictName(event.currentTarget.value)} /></label>
      <button type="button" disabled={!selected} onClick={(event) => {
        const name = districtName.trim()
        const districts = geometry.districts.map((district, index) =>
          index === districtIndex ? { ...district, name: name || undefined } : district)
        update(event.currentTarget.form, { ...plan, geometry: { ...geometry, districts } })
      }}>{t('Сохранить название квартала')}</button>
      <button type="button" disabled={!selected} onClick={(event) => {
        update(event.currentTarget.form, rerollDistrict(plan, districtIndex, crypto.getRandomValues(new Uint32Array(1))[0]!))
      }}>{t('Перестроить квартал')}</button>
    </div>
    </fieldset>
    <div className="location-map-edit-view" ref={view}>
      {draft ? <div className="location-map-warp" onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        const origin = coordinates(event.clientX, event.clientY)
        event.currentTarget.setPointerCapture(event.pointerId)
        setStroke({ origin, target: origin })
        setCursor(origin)
        setError('')
      }} onPointerMove={(event) => {
        if (!event.isPrimary) return
        const target = coordinates(event.clientX, event.clientY)
        setCursor(target)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          setStroke((current) => current && { ...current, target })
        }
      }} onPointerLeave={() => setCursor(undefined)} onLostPointerCapture={() => setStroke(undefined)}
        onPointerCancel={() => { setStroke(undefined); setCursor(undefined) }}
        onPointerUp={(event) => {
          if (!stroke || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          const target = coordinates(event.clientX, event.clientY)
          setStroke(undefined)
          if (target[0] === stroke.origin[0] && target[1] === stroke.origin[1]) return
          const next = warpDistricts(draft.plan, stroke.origin, target, radius)
          if (next === draft.plan) {
            setError(t('Кварталы в этой области нельзя сдвинуть.'))
            return
          }
          const title = event.currentTarget.closest('form')?.elements.namedItem('title')
          const preview = locationMap(next, title instanceof HTMLInputElement ? title.value.trim() : '')
          if (preview) setDraft({ plan: next, image: preview })
          else setError(t('Не удалось сгенерировать карту.'))
        }}>
        <img src={draft.image} alt={t('Предпросмотр')} draggable={false} />
        <svg className="location-map-corners location-map-brush" viewBox={'0 0 ' + mapWidth + ' ' + mapHeight} aria-hidden="true">
          {stroke && geometry.districts.map(({ vertices }, index) =>
            <polygon key={index} points={vertices.map((vertex) => {
              const delta = brushDisplacement(vertex, stroke.origin, stroke.target, radius)
              return delta ? [vertex[0] + delta[0], vertex[1] + delta[1]].join(',') : vertex.join(',')
            }).join(' ')} />)}
          {cursor && <circle cx={cursor[0]} cy={cursor[1]} r={radius} />}
        </svg>
      </div> : <>
      <button type="button" className="location-map-select-point" aria-label={t('Выбрать точку для метки')}
        onClick={(event) => setPoint(event.detail === 0 ? [mapWidth / 2, mapHeight / 2] : coordinates(event.clientX, event.clientY))}>
        <img src={image} alt="" />
      </button>
      <svg className="location-map-corners" viewBox={'0 0 ' + mapWidth + ' ' + mapHeight} aria-hidden="true">
        {selected && <polygon points={selected.vertices.map((vertex, i) =>
          (drag?.index === i ? drag.point : vertex).join(',')).join(' ')} />}
        {point && <circle cx={point[0]} cy={point[1]} r="7" />}
        {selected?.vertices.map((vertex, index) => {
          const [x, y] = drag?.index === index ? drag.point : vertex
          return <circle className="location-map-corner" key={index} cx={x} cy={y} r="6"
            onPointerDown={(event: PointerEvent<SVGCircleElement>) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDrag({ index, point: vertex })
              setError('')
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                setDrag({ index, point: coordinates(event.clientX, event.clientY) })
              }
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              setDrag(undefined)
              const target = coordinates(event.clientX, event.clientY)
              const next = moveDistrictCorner(plan, vertex, target)
              if (next === plan) setError(t('Угол нельзя переместить сюда.'))
              else update(event.currentTarget.closest('form'), next)
            }}
            onLostPointerCapture={() => setDrag(undefined)}
            onPointerCancel={() => setDrag(undefined)} />
        })}
      </svg>
      </>}
    </div>
    <fieldset hidden={warping} disabled={warping} className="location-map-tools">
    <p>{t('Перетаскивайте углы выбранного квартала.')}</p>
    <p>{point ? t('Точка выбрана') : t('Нажмите на карту, чтобы выбрать место для метки.')}</p>
    <div className="location-map-editor-actions">
      <label>{t('Название метки')}<input maxLength={80} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <label>{t('Связанная локация')}
        <select value={locationId} onChange={(event) => setLocationId(event.currentTarget.value)}>
          <option value="">{t('Не указана')}</option>
          {locations.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <button type="button" disabled={!point || !name.trim() || markers.length >= 100} onClick={(event) => {
        if (!point) return
        const marker = { id: crypto.randomUUID(), name: name.trim(), point, locationId: locationId || undefined }
        if (update(event.currentTarget.form, { ...plan, markers: [...markers, marker] })) {
          setPoint(undefined)
          setName('')
          setLocationId('')
        }
      }}>{t('Добавить метку')}</button>
    </div>
    {markers.length > 0 && <ul>{markers.map((marker) => (
      <li key={marker.id}>{marker.name}{' '}
        <button type="button" aria-label={t('Удалить метку') + ' · ' + marker.name} onClick={(event) =>
          update(event.currentTarget.form, { ...plan, markers: markers.filter(({ id }) => id !== marker.id) })}>×</button>
      </li>
    ))}</ul>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </details>
}
