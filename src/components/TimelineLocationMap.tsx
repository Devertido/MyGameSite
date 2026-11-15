import { useState } from 'react'
import { LocationMapZoom } from './LocationMapZoom'
import { t } from '../i18n.ts'
import type { ArchiveEntry } from '../domain/timeline'

export function TimelineLocationMap({ locations = [] }: { locations?: ArchiveEntry[] }) {
  const [sample] = useState(Math.random)
  const withMaps = locations.filter((location) => location.mapImage)
  const location = withMaps[Math.floor(sample * withMaps.length)]

  return (
    <section className="timeline-map timeline-map-location" aria-labelledby="location-map-title">
      <h2 id="location-map-title">{t('Карта локации')}</h2>
      {location ? (
        <figure className="timeline-location-map">
          <div className="timeline-location-viewport">
            <img src={location.mapImage} alt={t('Карта локации') + ' · ' + location.title} />
          </div>
          <figcaption>
            <a href={'#lore?section=locations&entry=' + encodeURIComponent(location.id)}>{location.title}</a>
            {location.mapImage && <LocationMapZoom image={location.mapImage} name={location.title} markers={location.mapPlan?.markers} />}
          </figcaption>
        </figure>
      ) : <p>{t('В справочнике пока нет сохранённых карт локаций.')}</p>}
    </section>
  )
}
