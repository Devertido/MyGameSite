import { createContext, useContext, useId, useState } from 'react'
import type { EntryMetadata, EntryStatus, GalleryImage } from '../domain/timeline'
import { CreationDialog } from './CreationDialog'
import { ImageField } from './ImageField'

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

export function EntryFields({ entry }: { entry?: EntryMetadata | null }) {
  const [rows, setRows] = useState(() => (entry?.gallery ?? []).map((image) => ({
    id: crypto.randomUUID(), ...image,
  })))

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
      <p><label>Статус <select name="entry-status" defaultValue={entry?.status ?? 'canon'}>
        <option value="canon">Канон</option>
        <option value="draft">Черновик</option>
      </select></label></p>
      <fieldset>
        <legend>Галерея</legend>
        {rows.map((row, index) => (
          <div key={row.id} className="gallery-editor-row">
            <input type="hidden" name="gallery-row" value={row.id} />
            <ImageField name={'gallery-image-' + row.id} label="Изображение" initial={row.image} />
            <p><label>Подпись <input name={'gallery-caption-' + row.id} defaultValue={row.caption} /></label></p>
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Выше</button>{' '}
            <button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>Ниже</button>{' '}
            <button type="button" onClick={() => setRows((current) => current.filter(({ id }) => id !== row.id))}>Убрать из галереи</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), image: '', caption: '' }])}>
          Добавить изображение
        </button>
      </fieldset>
    </>
  )
}

export function EntryStatusLabel({ entry }: { entry: EntryMetadata }) {
  return entry.status === 'draft' ? <p className="entry-draft">Черновик</p> : null
}

export function EntryGallery({ entry }: { entry: EntryMetadata }) {
  const titleId = useId()
  const [open, setOpen] = useState<GalleryImage | null>(null)
  if (!entry.gallery?.length) return null
  return (
    <section>
      <h3>Галерея</h3>
      <div className="entry-gallery">
        {entry.gallery.map((image, index) => (
          <figure key={index}>
            <button type="button" onClick={() => setOpen(image)} aria-label={'Увеличить: ' + (image.caption || 'изображение ' + (index + 1))}>
              <img src={image.image} alt={image.caption || 'Изображение галереи'} loading="lazy" />
            </button>
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open && <CreationDialog titleId={titleId} onCancel={() => setOpen(null)}>
        <h2 id={titleId}>{open.caption || 'Изображение'}</h2>
        <img className="gallery-enlarged" src={open.image} alt={open.caption || 'Изображение галереи'} />
        <button type="button" onClick={() => setOpen(null)}>Закрыть</button>
      </CreationDialog>}
    </section>
  )
}
