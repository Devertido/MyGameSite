import { t } from '../i18n.ts'
import { createContext, useContext, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { EntryMetadata, EntryStatus, GalleryImage } from '../domain/timeline'
import { CreationDialog } from './CreationDialog'
import { prepareImage } from './prepareImage'

export const StatusFilter = createContext<EntryStatus | 'all'>('all')

export function useStatusMatch() {
  const filter = useContext(StatusFilter)
  return (entry: EntryMetadata) => filter === 'all' || (entry.status ?? 'canon') === filter
}

export function readEntryMetadata(fields: FormData): EntryMetadata {
  const gallery = fields.getAll('gallery-row').flatMap((row) => {
    const image = String(fields.get('gallery-image-' + row) ?? '')
    const caption = String(fields.get('gallery-caption-' + row) ?? '').trim()
    return image ? [{ image, caption }] : []
  })
  return { status: fields.get('entry-status') === 'draft' ? 'draft' : 'canon', gallery }
}

export function EntryFields({ entry, beforeStatus }: { entry?: EntryMetadata | null; beforeStatus?: ReactNode }) {
  const [rows, setRows] = useState(() => (entry?.gallery ?? []).map((image) => ({
    id: crypto.randomUUID(), ...image,
  })))

  const filePicker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    if (!files.length) return

    input.value = ''
    input.setCustomValidity(t('Дождитесь обработки изображений.'))
    setBusy(true)
    setError('')
    const added: typeof rows = []
    const failed: string[] = []
    try {
      for (const file of files) {
        try {
          const image = await prepareImage(file)
          added.push({ id: crypto.randomUUID(), image, caption: '' })
        } catch {
          failed.push(file.name)
        }
      }
      setRows((current) => [...current, ...added])
      if (failed.length) setError(t('Не удалось добавить: ') + failed.join(', ') + t('. Выберите PNG, JPEG или WebP до 10 МБ.'))
    } finally {
      input.setCustomValidity('')
      setBusy(false)
    }
  }

  function move(index: number, offset: number) {
    setRows((current) => {
      const next = [...current]
      const target = index + offset
      if (target < 0 || target >= next.length) return current
      const row = next[index]!
      next[index] = next[target]!
      next[target] = row
      return next
    })
  }

  return (
    <>
      <div className="entry-status-row">{beforeStatus}<label>{t("Статус ")}<select name="entry-status" defaultValue={entry?.status ?? 'canon'}>
        <option value="canon">{t("Канон")}</option>
        <option value="draft">{t("Черновик")}</option>
      </select></label></div>
      <fieldset>
        <legend>{t("Галерея")}</legend>
        <div className="gallery-editor">
          {rows.map((row, index) => (
            <div key={row.id} className="gallery-editor-row">
              <input type="hidden" name="gallery-row" value={row.id} />
              <input type="hidden" name={'gallery-image-' + row.id} value={row.image} />
              <div className="image-preview">
                <img className="atlas-entry-image" src={row.image} alt={row.caption || t('Изображение галереи')} />
                <button className="form-icon-button form-icon-remove image-remove" type="button"
                  aria-label={t('Убрать изображение ') + (index + 1)} title={t("Убрать изображение")}
                  onClick={() => setRows((current) => current.filter(({ id }) => id !== row.id))}>×</button>
              </div>
              <label>{t("Подпись ")}<input name={'gallery-caption-' + row.id} defaultValue={row.caption} /></label>
              <div className="gallery-order">
                <button type="button" aria-label={t("Переместить раньше")} title={t("Переместить раньше")}
                  disabled={index === 0} onClick={() => move(index, -1)}>←</button>
                <button type="button" aria-label={t("Переместить позже")} title={t("Переместить позже")}
                  disabled={index === rows.length - 1} onClick={() => move(index, 1)}>→</button>
              </div>
            </div>
          ))}
          <button className="form-icon-button form-icon-add gallery-add" type="button" disabled={busy} aria-label={t("Добавить изображения")}
            title={t("Добавить изображения")} onClick={() => filePicker.current?.click()}>+</button>
          <input className="gallery-file-picker" type="file" ref={filePicker} multiple tabIndex={-1}
            aria-label={t("Файлы для галереи")} accept="image/png,image/jpeg,image/webp" onChange={addImages} />
        </div>
        {busy && <p role="status">{t("Обрабатываем изображения…")}</p>}
        {error && <p role="alert">{error}</p>}
      </fieldset>
    </>
  )
}

export function EntryStatusLabel({ entry }: { entry: EntryMetadata }) {
  return entry.status === 'draft' ? <p className="entry-draft">{t("Черновик")}</p> : null
}

export function EntryGallery({ entry }: { entry: EntryMetadata }) {
  const titleId = useId()
  const [open, setOpen] = useState<GalleryImage | null>(null)
  if (!entry.gallery?.length) return null
  return (
    <section>
      <h3>{t("Галерея")}</h3>
      <div className="entry-gallery">
        {entry.gallery.map((image, index) => (
          <figure key={index}>
            <button type="button" onClick={() => setOpen(image)} aria-label={t('Увеличить: ') + (image.caption || t('изображение ') + (index + 1))}>
              <img src={image.image} alt={image.caption || t('Изображение галереи')} loading="lazy" />
            </button>
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open && <CreationDialog titleId={titleId} onCancel={() => setOpen(null)}>
        <h2 id={titleId}>{open.caption || t('Изображение')}</h2>
        <img className="gallery-enlarged" src={open.image} alt={open.caption || t('Изображение галереи')} />
        <button type="button" onClick={() => setOpen(null)}>{t("Закрыть")}</button>
      </CreationDialog>}
    </section>
  )
}
