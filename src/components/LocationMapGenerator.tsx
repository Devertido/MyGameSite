import { useState } from 'react'
import { t } from '../i18n.ts'
import { locationMap, type MapMode, type Terrain } from './locationMap'

export function LocationMapGenerator({ onGenerate }: { onGenerate: (image: string) => void }) {
  const [mode, setMode] = useState<MapMode>('settlement')
  const [terrain, setTerrain] = useState<Terrain>('plains')
  const [error, setError] = useState(false)

  function generate() {
    const image = locationMap(mode, terrain)
    setError(!image)
    if (image) onGenerate(image)
  }

  return <div className="location-map-generator">
    <label>{t('Тип карты')}
      <select value={mode} onChange={(event) => setMode(event.currentTarget.value === 'settlement' ? 'settlement' : 'terrain')}>
        <option value="settlement">{t('План поселения')}</option>
        <option value="terrain">{t('Карта местности')}</option>
      </select>
    </label>
    <label>{t('Ландшафт')}
      <select value={terrain} onChange={(event) => {
        const value = event.currentTarget.value
        setTerrain(value === 'forest' || value === 'mountains' ? value : 'plains')
      }}>
        <option value="plains">{t('Равнина')}</option>
        <option value="forest">{t('Лес')}</option>
        <option value="mountains">{t('Горы')}</option>
      </select>
    </label>
    <button type="button" onClick={generate}>{t('Сгенерировать карту')}</button>
    {error && <p role="alert">{t('Не удалось сгенерировать карту.')}</p>}
  </div>
}
