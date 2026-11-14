import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { ImageField } from './ImageField'
import { useState, type CSSProperties, type FormEvent } from 'react'
import type { ArchiveEntry, Timeline } from '../domain/timeline'

const rarities = ['Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный']

export function ArchivePage({ kind, entries, entryId, timeline, save }: {
  kind: 'chronicles' | 'items' | 'locations'
  entries: ArchiveEntry[]
  timeline: Timeline
  entryId?: string
  save: (entries: ArchiveEntry[]) => void
}) {
  const chronicle = kind === 'chronicles'
  const location = kind === 'locations'
  const title = location ? 'Локации' : chronicle ? 'Летописи' : 'Предметы'
  const [draft, setDraft] = useState<ArchiveEntry | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ArchiveEntry | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const original = draft === 'new' ? null : draft
  const selected = entries.find(({ id }) => id === entryId)
  const matches = entries.filter(({ title }) => title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const read = (name: string) => String(fields.get(name) ?? '').trim()
    const title = read('title')
    if (!title) {
      setError('Введите название.')
      return
    }

    try {
      const entry = {
        id: original?.id ?? crypto.randomUUID(),
        title,
        summary: read('summary'),
        body: read('body'),
        ...(chronicle
          ? { eventIds: fields.getAll('events').map(String), characterIds: fields.getAll('characters').map(String) }
          : location ? { type: read('type'), image: read('image') || undefined }
          : { type: read('type'), rarity: read('rarity'), ownerId: read('ownerId') || undefined, image: read('image') || undefined }),
      }
      save(original ? entries.map((item) => item.id === original.id ? entry : item) : [...entries, entry])
      setDraft(null)
      setError('')
      window.location.hash = kind + '?entry=' + encodeURIComponent(entry.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить запись.')
    }
  }

  return (
    <main className="section-page">
      <h1>{title}</h1>
      {entryId !== undefined && <p><a href={'#' + kind}>{!location && <span aria-hidden="true">← </span>}
        {location ? 'Все локации' : chronicle ? 'Назад к летописям' : 'Назад к предметам'}
      </a></p>}
      {draft === null && (
        <div className="timeline-controls">
          <button type="button" onClick={() => setDraft('new')}>{location ? 'Добавить локацию' : chronicle ? 'Создать летопись' : 'Добавить предмет'}</button>
          {entryId === undefined && entries.length > 0 && <label>Поиск <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>}
        </div>
      )}
      {draft !== null && (
        <form className={chronicle ? 'archive-form parchment' : 'archive-form'} onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать' : location ? 'Новая локация' : chronicle ? 'Новая летопись' : 'Новый предмет'}</h2>
          <label>Название<input name="title" defaultValue={original?.title} required /></label>
          {!chronicle && (
            <>
              <ImageField name="image" label={location ? "Изображение локации" : "Изображение предмета"} initial={original?.image} />
              <label>Тип<input name="type" defaultValue={original?.type} placeholder={location ? "Город, крепость, регион" : "Оружие, броня, артефакт"} /></label>
              {!location && <label>Редкость<select name="rarity" defaultValue={original?.rarity ?? rarities[0]}>
                {rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}
              </select></label>}
            </>
          )}
          <label>{chronicle ? 'Краткая справка' : 'Краткое описание'}<textarea name="summary" rows={3} defaultValue={original?.summary} /></label>
          <label>{location ? 'История локации' : chronicle ? 'Текст летописи' : 'Свойства и история'}<textarea name="body" rows={8} defaultValue={original?.body} /></label>
          {chronicle ? (
            <>
              <fieldset>
                <legend>Связанные события</legend>
                {(timeline.events ?? []).map(({ id, title, year }) => (
                  <label key={id}><span><input type="checkbox" name="events" value={id}
                    defaultChecked={original?.eventIds?.includes(id)} /> {year} · {title}</span></label>
                ))}
                {!timeline.events?.length && <p>В таймлайне пока нет событий.</p>}
              </fieldset>
              <fieldset>
                <legend>Связанные персонажи</legend>
                {(timeline.characters ?? []).map(({ id, name }) => (
                  <label key={id}><span><input type="checkbox" name="characters" value={id}
                    defaultChecked={original?.characterIds?.includes(id)} /> {name}</span></label>
                ))}
                {!timeline.characters?.length && <p>В таймлайне пока нет персонажей.</p>}
              </fieldset>
            </>
          ) : !location && (
            <label>Владелец<select name="ownerId" defaultValue={original?.ownerId ?? ''}>
              <option value="">Не указан</option>
              {(timeline.characters ?? []).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select></label>
          )}
          {error && <p role="alert">{error}</p>}
          <div><button type="submit">Сохранить</button>{' '}
            <button type="button" onClick={() => { setDraft(null); setError('') }}>Отмена</button></div>
        </form>
      )}
      {draft === null && selected && (
        <article className={chronicle ? 'archive-card parchment' : 'archive-card item-card item-tooltip'} style={chronicle ? undefined : itemAccent(selected)}>
          {!chronicle && <ItemImage entry={selected} />}
          <h2>{selected.title}</h2>
          {!chronicle && <p className="item-rarity">{[selected.type, selected.rarity].filter(Boolean).join(' · ')}</p>}
          {selected.summary && <p className="archive-copy">{selected.summary}</p>}
          {selected.body && (
            <section className="archive-body">
              <h3>{location ? 'История локации' : chronicle ? 'Хроника' : 'Свойства и история'}</h3>
              <p className="archive-copy">{selected.body}</p>
            </section>
          )}
          {selected.eventIds?.length ? (
            <section>
              <h3>Связанные события</h3>
              <ul>{timeline.events?.filter(({ id }) => selected.eventIds?.includes(id)).map(({ id, title, year }) => (
                <li key={id}><a href={'#events?event=' + encodeURIComponent(id)}>{year} · {title}</a></li>
              ))}</ul>
            </section>
          ) : null}
          {selected.characterIds?.length || selected.ownerId ? (
            <section>
              <h3>{chronicle ? 'Связанные персонажи' : 'Владелец'}</h3>
              <ul>{timeline.characters?.filter(({ id }) => chronicle
                ? selected.characterIds?.includes(id) : selected.ownerId === id).map(({ id, name }) => (
                <li key={id}><a href={'#characters?character=' + encodeURIComponent(id)}>{name}</a></li>
              ))}</ul>
            </section>
          ) : null}
          <button type="button" onClick={() => setDraft(selected)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>{' '}
          <button type="button" aria-label="Удалить запись" title="Удалить запись"
            onClick={() => { setError(''); setDeleting(selected) }}><TrashIcon /></button>
        </article>
      )}
      {draft === null && entryId !== undefined && !selected && <p>Запись не найдена в выбранном таймлайне.</p>}
      {draft === null && entryId === undefined && (
        matches.length ? (
          <ul className="archive-grid">
            {matches.map((entry) => (
              <li className={chronicle ? 'archive-card parchment' : 'archive-card item-card'} key={entry.id}>
                {!chronicle && <ItemImage entry={entry} />}
                <h2><a href={'#' + kind + '?entry=' + encodeURIComponent(entry.id)}>{entry.title}</a></h2>
                {!chronicle && <p className="item-rarity">{[entry.type, entry.rarity].filter(Boolean).join(' · ')}</p>}
                {entry.summary && <p className="archive-copy">{entry.summary}</p>}
              </li>
            ))}
          </ul>
        ) : <p>{entries.length ? 'По этому запросу ничего не найдено.' : location ? 'Здесь пока нет локаций.' : chronicle ? 'Здесь пока нет летописей.' : 'Здесь пока нет предметов.'}</p>
      )}
      {deleting && (
        <dialog open className="card-delete-dialog" aria-labelledby="card-delete-title">
          <h2 id="card-delete-title">Удалить запись «{deleting.title}»?</h2>
          <p>Запись будет удалена из текущего таймлайна.</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>Отмена</button>{' '}
          <button type="button" onClick={() => {
            try {
              save(entries.filter(({ id }) => id !== deleting.id))
              setDeleting(null)
              window.location.hash = kind
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Не удалось удалить запись.')
            }
          }}>Удалить</button>
        </dialog>
      )}
    </main>
  )
}

function ItemImage({ entry }: { entry: ArchiveEntry }) {
  return (
    <div className="item-image-frame" style={itemAccent(entry)}>
      {entry.image && <img className="atlas-entry-image" src={entry.image} alt={entry.title} />}
    </div>
  )
}

function itemAccent(entry: ArchiveEntry): CSSProperties {
  const colors = ['#acb8bc', '#68bd76', '#68b7ef', '#ba83ef', '#edbb59']
  const color = colors[rarities.indexOf(entry.rarity ?? '')] ?? colors[0]
  return { '--item-accent': color } as CSSProperties
}
