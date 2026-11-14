import { useState, type FormEvent } from 'react'
import type { ArchiveEntry } from '../domain/timeline'

const rarities = ['Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный']

export function ArchivePage({ kind, entries, entryId, save }: {
  kind: 'chronicles' | 'items'
  entries: ArchiveEntry[]
  entryId?: string
  save: (entries: ArchiveEntry[]) => void
}) {
  const chronicle = kind === 'chronicles'
  const title = chronicle ? 'Летописи' : 'Предметы'
  const [draft, setDraft] = useState<ArchiveEntry | 'new' | null>(null)
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
          ? {}
          : { type: read('type'), rarity: read('rarity') }),
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
      {entryId !== undefined && <p><a href={'#' + kind}>{chronicle ? 'Все летописи' : 'Все предметы'}</a></p>}
      {draft === null && (
        <div className="timeline-controls">
          <button type="button" onClick={() => setDraft('new')}>{chronicle ? 'Создать летопись' : 'Добавить предмет'}</button>
          {entryId === undefined && entries.length > 0 && <label>Поиск <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>}
        </div>
      )}
      {draft !== null && (
        <form className={chronicle ? 'archive-form parchment' : 'archive-form'} onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать' : chronicle ? 'Новая летопись' : 'Новый предмет'}</h2>
          <label>Название<input name="title" defaultValue={original?.title} required /></label>
          {!chronicle && (
            <>
              <label>Тип<input name="type" defaultValue={original?.type} placeholder="Оружие, броня, артефакт" /></label>
              <label>Редкость<select name="rarity" defaultValue={original?.rarity ?? rarities[0]}>
                {rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}
              </select></label>
            </>
          )}
          <label>{chronicle ? 'Краткая справка' : 'Краткое описание'}<textarea name="summary" rows={3} defaultValue={original?.summary} /></label>
          <label>{chronicle ? 'Текст летописи' : 'Свойства и история'}<textarea name="body" rows={8} defaultValue={original?.body} /></label>
          {error && <p role="alert">{error}</p>}
          <div><button type="submit">Сохранить</button>{' '}
            <button type="button" onClick={() => { setDraft(null); setError('') }}>Отмена</button></div>
        </form>
      )}
      {draft === null && selected && (
        <article className={chronicle ? 'archive-card parchment' : 'archive-card item-card'}>
          <h2>{selected.title}</h2>
          {!chronicle && <p className="item-rarity">{[selected.type, selected.rarity].filter(Boolean).join(' · ')}</p>}
          {selected.summary && <p className="archive-copy">{selected.summary}</p>}
          {selected.body && (
            <section className="archive-body">
              <h3>{chronicle ? 'Хроника' : 'Свойства и история'}</h3>
              <p className="archive-copy">{selected.body}</p>
            </section>
          )}
          <button type="button" onClick={() => setDraft(selected)}>Редактировать</button>
        </article>
      )}
      {draft === null && entryId !== undefined && !selected && <p>Запись не найдена в выбранном таймлайне.</p>}
      {draft === null && entryId === undefined && (
        matches.length ? (
          <ul className="archive-grid">
            {matches.map((entry) => (
              <li className={chronicle ? 'archive-card parchment' : 'archive-card item-card'} key={entry.id}>
                <h2><a href={'#' + kind + '?entry=' + encodeURIComponent(entry.id)}>{entry.title}</a></h2>
                {!chronicle && <p className="item-rarity">{[entry.type, entry.rarity].filter(Boolean).join(' · ')}</p>}
                {entry.summary && <p className="archive-copy">{entry.summary}</p>}
              </li>
            ))}
          </ul>
        ) : <p>{entries.length ? 'По этому запросу ничего не найдено.' : chronicle ? 'Здесь пока нет летописей.' : 'Здесь пока нет предметов.'}</p>
      )}
    </main>
  )
}
