import { useState, type MouseEvent } from 'react'
import { mapHeight, mapWidth, rerollDistrict, type LocationMapPlan } from '../domain/locationMapPlan'
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
  const [error, setError] = useState(false)
  const geometry = plan.geometry
  if (!geometry) return null
  const selected = geometry.districts[districtIndex]
  const markers = plan.markers ?? []

  function update(event: MouseEvent<HTMLButtonElement>, next: LocationMapPlan) {
    const field = event.currentTarget.form?.elements.namedItem('title')
    const title = field instanceof HTMLInputElement ? field.value.trim() : ''
    const updated = locationMap(next, title)
    setError(!updated)
    if (updated) onChange(updated, next)
    return Boolean(updated)
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
        update(event, { ...plan, geometry: { ...geometry, districts } })
      }}>{t('Сохранить название квартала')}</button>
      <button type="button" disabled={!selected} onClick={(event) => {
        update(event, rerollDistrict(plan, districtIndex, crypto.getRandomValues(new Uint32Array(1))[0]!))
      }}>{t('Перестроить квартал')}</button>
    </div>
    <button type="button" className="location-map-select-point" aria-label={t('Выбрать точку для метки')}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        setPoint(event.detail === 0 ? [mapWidth / 2, mapHeight / 2] : [
          Math.round(Math.max(0, Math.min(mapWidth, (event.clientX - box.left) / box.width * mapWidth))),
          Math.round(Math.max(0, Math.min(mapHeight, (event.clientY - box.top) / box.height * mapHeight))),
        ])
      }}>
      <img src={image} alt="" />
      <svg viewBox={'0 0 ' + mapWidth + ' ' + mapHeight} aria-hidden="true">
        {selected && <polygon points={selected.vertices.map(([x, y]) => x + ',' + y).join(' ')} />}
        {point && <circle cx={point[0]} cy={point[1]} r="7" />}
      </svg>
    </button>
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
        if (update(event, { ...plan, markers: [...markers, marker] })) {
          setPoint(undefined)
          setName('')
          setLocationId('')
        }
      }}>{t('Добавить метку')}</button>
    </div>
    {markers.length > 0 && <ul>{markers.map((marker) => (
      <li key={marker.id}>{marker.name}{' '}
        <button type="button" aria-label={t('Удалить метку') + ' · ' + marker.name} onClick={(event) =>
          update(event, { ...plan, markers: markers.filter(({ id }) => id !== marker.id) })}>×</button>
      </li>
    ))}</ul>}
    {error && <p role="alert">{t('Не удалось сгенерировать карту.')}</p>}
  </details>
}
