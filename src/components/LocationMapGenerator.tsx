import { useState, type MouseEvent } from 'react'
import { maxSettlementSeed, settlementSizes, waterTypes, type SettlementSize, type WaterType } from '../domain/settlementFoundation'
import { t } from '../i18n.ts'
import { createLocationMapPlan, type LocationMapPlan, type MapMode, type Terrain } from '../domain/locationMapPlan'
import { locationMap } from './locationMap'

const sizes: Record<SettlementSize, { label: string; population: string }> = {
  village: { label: 'Деревня', population: '50–100' },
  town: { label: 'Городок', population: '1 000–6 000' },
  city: { label: 'Город', population: '6 000–20 000' },
  metropolis: { label: 'Метрополия', population: '20 000–500 000' },
  megalopolis: { label: 'Мегалополис', population: '500 000–2 000 000' },
  ecumenopolis: { label: 'Экуменополис', population: 'Миллионы, вплоть до всей планеты' },
}
const waterLabels: Record<WaterType, string> = {
  inland: 'Без водоёма', river: 'У реки', coast: 'На побережье', gorge: 'В ущелье', cave: 'В пещере',
  underground: 'Подземный', island: 'Островной', peninsula: 'На полуострове',
  'river-mouth': 'У впадения реки в водоём', 'river-city': 'Река посреди города',
}

function randomSeed() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0])
}

export function LocationMapGenerator({ initial, onGenerate }: {
  initial?: LocationMapPlan
  onGenerate: (image: string, plan: LocationMapPlan) => void
}) {
  const [mode, setMode] = useState<MapMode>(initial?.settings.mode ?? 'settlement')
  const [terrain, setTerrain] = useState<Terrain>(initial?.settings.terrain ?? 'plains')
  const [size, setSize] = useState<SettlementSize>(initial?.settings.size ?? 'town')
  const [fortified, setFortified] = useState(initial?.settings.fortified ?? false)
  const [water, setWater] = useState<WaterType>(initial?.settings.water ?? 'river')
  const [seed, setSeed] = useState(() => initial ? String(initial.settings.seed) : randomSeed())
  const [error, setError] = useState('')
  const seedNumber = Number(seed)
  const validSeed = /^\d+$/.test(seed) && Number.isSafeInteger(seedNumber) && seedNumber <= maxSettlementSeed

  function generate(event: MouseEvent<HTMLButtonElement>) {
    if (mode === 'settlement' && !validSeed) {
      setError(t('Введите целое число от 0 до 4294967295.'))
      return
    }
    const titleField = event.currentTarget.form?.elements.namedItem('title')
    const title = titleField instanceof HTMLInputElement ? titleField.value.trim() : ''
    const plan = createLocationMapPlan({
      mode, terrain, fortified, seed: mode === 'settlement' ? seedNumber : Number(randomSeed()), size, water,
    })
    const image = locationMap(plan, title)
    setError(image ? '' : t('Не удалось сгенерировать карту.'))
    if (image) onGenerate(image, plan)
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
          {settlementSizes.map((value) => <option key={value} value={value}>{t(sizes[value].label)} · {t(sizes[value].population)}</option>)}
        </select>
      </label>
      <label>{t('География')}
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
