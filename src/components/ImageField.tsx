import type { LocationMapPlan } from '../domain/locationMapPlan'
import { t } from '../i18n.ts'
import { useRef, useState, type ChangeEvent } from 'react'
import { LocationMapEditor, type MapLocationLink } from './LocationMapEditor'
import { LocationMapGenerator } from './LocationMapGenerator'
import { prepareImage } from './prepareImage'

export function ImageField({ name, label, initial, allowGif = false, generateMap = false, initialMapPlan, mapLocations = [] }: {
  name: string; label: string; initial?: string; allowGif?: boolean; generateMap?: boolean; initialMapPlan?: LocationMapPlan; mapLocations?: MapLocationLink[]
}) {
  const [image, setImage] = useState(initial ?? '')
  const [mapPlan, setMapPlan] = useState(initialMapPlan)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const [mapRevision, setMapRevision] = useState(0)

  function useGeneratedMap(map: string, plan: LocationMapPlan) {
    revision.current++
    setImage(map)
    setMapPlan(plan)
    setError('')
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const current = ++revision.current
    input.value = ''
    input.setCustomValidity(t('Дождитесь обработки изображения.'))
    setError('')
    try {
      if (allowGif && (file.type === 'image/gif' || /\.gif$/i.test(file.name))) {
        if (file.size > 650_000) throw new Error(t('Выберите GIF размером до 650 КБ.'))
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file.slice(0, file.size, 'image/gif'))
        })
        if (!/^data:image\/gif;base64,R0lGOD[dl]h/.test(image)) throw new Error(t('Не удалось открыть GIF.'))
        const bitmap = await createImageBitmap(file)
        bitmap.close()
        if (current === revision.current) setImage(image)
        return
      }
      const prepared = await prepareImage(file)
      if (current === revision.current) {
        setImage(prepared)
        setMapPlan(undefined)
      }
    } catch (error) {
      if (current === revision.current) {
        setError(error instanceof DOMException ? t('Не удалось открыть изображение.')
          : error instanceof Error ? error.message : t('Не удалось обработать изображение.'))
      }
    } finally {
      input.setCustomValidity('')
    }
  }

  return (
    <fieldset className="atlas-image-field">
      <legend>{label}</legend>
      <label>{t("Выбрать файл ")}<input type="file" accept={allowGif ? "image/png,image/jpeg,image/webp,image/gif,.gif" : "image/png,image/jpeg,image/webp"} onChange={choose} /></label>
      {generateMap && <LocationMapGenerator initial={initialMapPlan} onGenerate={(map, plan) => {
        useGeneratedMap(map, plan)
        setMapRevision((current) => current + 1)
      }} />}
      {generateMap && mapPlan?.geometry && image && <LocationMapEditor key={mapRevision} plan={mapPlan}
        image={image} locations={mapLocations} onChange={useGeneratedMap} />}
      {allowGif && <small>{t(" GIF до 650 КБ")}</small>}
      <input type="hidden" name={name} value={image} />
      {generateMap && mapPlan && <input type="hidden" name="mapPlan" value={JSON.stringify(mapPlan)} />}
      {image && (
        <div className={generateMap ? "image-preview location-map-preview" : "image-preview"}>
          <img className="atlas-entry-image" src={image} alt={t("Предпросмотр")} />
          <button className="form-icon-button form-icon-remove image-remove" type="button" aria-label={t("Убрать изображение")} title={t("Убрать изображение")}
            onClick={() => { revision.current++; setImage(''); setMapPlan(undefined); setError('') }}>×</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
