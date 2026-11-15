import { useRef, useState, type PointerEvent } from 'react'
import { mapHeight, mapWidth, moveDistrictCorner, rerollDistrict, type LocationMapPlan } from '../domain/locationMapPlan'
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
  const geometry = plan.geometry
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
    <div className="location-map-edit-view" ref={view}>
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
    </div>
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
    {error && <p role="alert">{error}</p>}
  </details>
}
