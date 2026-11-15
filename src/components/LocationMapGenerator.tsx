import { useState } from 'react'
import { maxSettlementSeed, settlementSizes, waterTypes, type SettlementSize, type WaterType } from '../domain/settlementFoundation'
import { t } from '../i18n.ts'
import { locationMap, type MapMode, type Terrain } from './locationMap'

const sizeLabels = { village: 'Деревня', town: 'Городок', city: 'Город' }
const waterLabels = { inland: 'Без водоёма', river: 'У реки', coast: 'На побережье' }

function randomSeed() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0])
}

export function LocationMapGenerator({ onGenerate }: { onGenerate: (image: string) => void }) {
  const [mode, setMode] = useState<MapMode>('settlement')
  const [terrain, setTerrain] = useState<Terrain>('plains')
  const [size, setSize] = useState<SettlementSize>('town')
  const [fortified, setFortified] = useState(false)
  const [water, setWater] = useState<WaterType>('river')
  const [seed, setSeed] = useState(randomSeed)
  const [error, setError] = useState('')
  const seedNumber = Number(seed)
  const validSeed = /^\d+$/.test(seed) && Number.isSafeInteger(seedNumber) && seedNumber <= maxSettlementSeed

  function generate() {
    if (mode === 'settlement' && !validSeed) {
      setError(t('Введите целое число от 0 до 4294967295.'))
      return
    }
    const image = locationMap(mode, terrain, {
      seed: mode === 'settlement' ? seedNumber : Number(randomSeed()), size, water,
    }, fortified)
    setError(image ? '' : t('Не удалось сгенерировать карту.'))
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
    {mode === 'settlement' && <>
      <label>{t('Размер поселения')}
        <select value={size} onChange={(event) => setSize(settlementSizes.find((value) => value === event.currentTarget.value) ?? 'town')}>
          {settlementSizes.map((value) => <option key={value} value={value}>{t(sizeLabels[value])}</option>)}
        </select>
      </label>
      <label>{t('Вода')}
        <select value={water} onChange={(event) => setWater(waterTypes.find((value) => value === event.currentTarget.value) ?? 'river')}>
          {waterTypes.map((value) => <option key={value} value={value}>{t(waterLabels[value])}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={fortified} onChange={(event) => setFortified(event.currentTarget.checked)} />{' '}{t('Стены и башни')}</label>
      <label>{t('Число генерации (seed)')}
        <input className="location-map-seed" type="text" inputMode="numeric" value={seed}
          onChange={(event) => { setSeed(event.currentTarget.value); setError('') }} />
      </label>
      <button type="button" onClick={() => { setSeed(randomSeed()); setError('') }}>{t('Новый seed')}</button>
    </>}
    <button type="button" onClick={generate}>{t('Сгенерировать карту')}</button>
    {error && <p role="alert">{error}</p>}
  </div>
}
