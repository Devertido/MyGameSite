import { useState } from 'react'
import { mapHeight, mapWidth, type MapMarker } from '../domain/locationMapPlan'
import { t } from '../i18n.ts'
import { CreationDialog } from './CreationDialog'

const levels = [1, 1.5, 2, 3, 4]

export function LocationMapZoom({ image, name, markers = [] }: { image: string; name: string; markers?: MapMarker[] }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(0)

  return <>
    <button type="button" onClick={() => { setLevel(0); setOpen(true) }}>{t('Открыть карту целиком')}</button>
    {open && <CreationDialog onCancel={() => setOpen(false)}>
      <h2 id="creation-dialog-title">{name}</h2>
      <div className="location-map-zoom-controls">
        <button type="button" aria-label={t('Уменьшить')} disabled={level === 0}
          onClick={() => setLevel((current) => current - 1)}>−</button>
        <output aria-live="polite">{levels[level]}×</output>
        <button type="button" aria-label={t('Увеличить')} disabled={level === levels.length - 1}
          onClick={() => setLevel((current) => current + 1)}>+</button>
        <button type="button" onClick={() => setOpen(false)}>{t('Закрыть')}</button>
      </div>
      <div tabIndex={0} role="region" aria-label={t('Карта локации')} className="location-map-zoom-viewport">
        <div className="location-map-zoom-sheet" style={{ width: levels[level]! * 100 + '%' }}>
          <img src={image} alt={t('Карта локации') + ' · ' + name} />
          {markers.map(({ id, point: [x, y], name, locationId }) => {
            const style = { left: x / mapWidth * 100 + '%', top: y / mapHeight * 100 + '%' }
            return locationId ? (
              <a key={id} className="location-map-pin" style={style} href={'#lore?section=locations&entry=' + encodeURIComponent(locationId)}
                onClick={() => setOpen(false)}>{name}</a>
            ) : <span key={id} className="location-map-pin" style={style}>{name}</span>
          })}
        </div>
      </div>
    </CreationDialog>}
  </>
}
