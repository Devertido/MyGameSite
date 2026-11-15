import { useRef, useState, type ChangeEvent } from 'react'
import { prepareImage } from './prepareImage'

export function ImageField({ name, label, initial, allowGif = false }: {
  name: string; label: string; initial?: string; allowGif?: boolean
}) {
  const [image, setImage] = useState(initial ?? '')
  const [error, setError] = useState('')
  const revision = useRef(0)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const current = ++revision.current
    input.value = ''
    input.setCustomValidity('Дождитесь обработки изображения.')
    setError('')
    try {
      if (allowGif && (file.type === 'image/gif' || /\.gif$/i.test(file.name))) {
        if (file.size > 650_000) throw new Error('Выберите GIF размером до 650 КБ.')
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file.slice(0, file.size, 'image/gif'))
        })
        if (!/^data:image\/gif;base64,R0lGOD[dl]h/.test(image)) throw new Error('Не удалось открыть GIF.')
        const bitmap = await createImageBitmap(file)
        bitmap.close()
        if (current === revision.current) setImage(image)
        return
      }
      const prepared = await prepareImage(file)
      if (current === revision.current) setImage(prepared)
    } catch (error) {
      if (current === revision.current) {
        setError(error instanceof DOMException ? 'Не удалось открыть изображение.'
          : error instanceof Error ? error.message : 'Не удалось обработать изображение.')
      }
    } finally {
      input.setCustomValidity('')
    }
  }

  return (
    <fieldset className="atlas-image-field">
      <legend>{label}</legend>
      <label>Выбрать файл <input type="file" accept={allowGif ? "image/png,image/jpeg,image/webp,image/gif,.gif" : "image/png,image/jpeg,image/webp"} onChange={choose} /></label>
      {allowGif && <small> GIF до 650 КБ</small>}
      <input type="hidden" name={name} value={image} />
      {image && (
        <div className="image-preview">
          <img className="atlas-entry-image" src={image} alt="Предпросмотр" />
          <button className="form-icon-button form-icon-remove image-remove" type="button" aria-label="Убрать изображение" title="Убрать изображение"
            onClick={() => { revision.current++; setImage(''); setError('') }}>×</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
