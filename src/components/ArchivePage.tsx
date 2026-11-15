import { shortWikiDescription } from '../domain/wikiLinks'
import { WikiText } from './WikiText'
import { itemMaterials, itemTypes, parseDamageFormula } from '../domain/itemDamage'
import { appliedAbilityEffects, raceDetailsFor } from '../domain/lore'
import { ItemDamage } from './ItemDamage'
import { LocationMapZoom } from './LocationMapZoom'
import { validLocationMapPlan } from '../domain/locationMapPlan'
import { t } from '../i18n.ts'
import { ObsidianImport } from './ObsidianImport'
import { LoreLinks } from './LoreLinks'
import { EntryFields, EntryGallery, EntryStatusLabel, readEntryMetadata, useStatusMatch } from './EntryMedia'
import { CreationDialog } from './CreationDialog'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { DirectoryImage } from './DirectoryImage'
import { RelativePicker } from './RelativePicker'
import { ImageField } from './ImageField'
import { useState, type CSSProperties, type FormEvent } from 'react'
import type { ArchiveEntry, Timeline } from '../domain/timeline'

const locationTypes = [
  'Ферма', 'Деревня', 'Город', 'Метрополия', 'Мегаполис', 'Пещера',
  'Лес', 'Луг', 'Холм', 'Переправа', 'Фактория',
] as const

const rarities = ['Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный']

export function ArchivePage({ kind, entries, entryId, timeline, save, embedded = false }: {
  kind: 'chronicles' | 'items' | 'locations'
  entries: ArchiveEntry[]
  timeline: Timeline
  entryId?: string
  save: (entries: ArchiveEntry[]) => void
  embedded?: boolean
}) {
  const chronicle = kind === 'chronicles'
  const location = kind === 'locations'
  const route = chronicle ? kind : 'lore?section=' + kind
  const entryRoute = route + (chronicle ? '?entry=' : '&entry=')
  const Wrapper = embedded ? 'section' : 'main'
  const title = location ? t('Локации') : chronicle ? t('Летописи') : t('Предметы')
  const matchesStatus = useStatusMatch()
  const [importing, setImporting] = useState(false)
  const [draft, setDraft] = useState<ArchiveEntry | 'new' | null>(null)
  const [itemType, setItemType] = useState<string>('Прочее')
  const [deleting, setDeleting] = useState<ArchiveEntry | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const original = draft === 'new' ? null : draft
  const selected = entryId === undefined ? entries.find(matchesStatus) : entries.find(({ id }) => id === entryId)
  const owner = selected?.ownerId ? timeline.characters?.find(({ id }) => id === selected.ownerId) : undefined
  const ownerRace = raceDetailsFor(timeline.lore, owner?.race)
  const ownerStrength = appliedAbilityEffects(timeline.lore, owner?.abilityNames, owner?.abilities, ownerRace).scores.strength
  const matches = entries.filter(matchesStatus).filter(({ title }) => title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const read = (name: string) => String(fields.get(name) ?? '').trim()
    const title = read('title')
    if (!title) {
      setError(t('Введите название.'))
      return
    }

    try {
      const damageFormula = kind === 'items' && read('type') === 'Оружие' ? read('damageFormula') : ''
      if (damageFormula && !parseDamageFormula(damageFormula)) {
        throw new Error(t('Проверьте формулу урона. Пример: 1d8 + СИЛ + 5'))
      }
      const mapImage = location ? read('mapImage') : ''
      const planText = location ? read('mapPlan') : ''
      const mapPlan: unknown = planText ? JSON.parse(planText) : undefined
      if (mapPlan !== undefined && !validLocationMapPlan(mapPlan)) throw new Error(t('Не удалось сохранить запись.'))
      const entry = {
        ...readEntryMetadata(fields),
        id: original?.id ?? crypto.randomUUID(),
        title,
        summary: read('summary'),
        body: read('body'),
        ...(chronicle
          ? { chronicleIds: original?.chronicleIds, eventIds: fields.getAll('events').map(String), characterIds: fields.getAll('characters').map(String) }
          : location ? { type: read('type'), image: read('image') || undefined, mapImage: mapImage || undefined, mapPlan: mapImage ? mapPlan : undefined }
          : { type: read('type'), rarity: read('rarity'), ownerId: read('ownerId') || undefined, image: read('image') || undefined,
            material: itemMaterials.find((material) => material === read('material')),
            massKg: read('massKg') ? Number(read('massKg').replace(',', '.')) : undefined,
            requiredSkill: read('requiredSkill') || undefined, damageFormula: damageFormula || undefined }),
      }
      save(original ? entries.map((item) => item.id === original.id ? entry : item) : [...entries, entry])
      setDraft(null)
      setError('')
      window.location.hash = entryRoute + encodeURIComponent(entry.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('Не удалось сохранить запись.'))
    }
  }

  return (
    <Wrapper className={embedded ? undefined : "section-page"}>
      {embedded ? <h2>{title}</h2> : <h1>{title}</h1>}
      {entryId !== undefined && <p><a href={'#' + route}>{!location && <span aria-hidden="true">← </span>}
        {location ? t('Все локации') : chronicle ? t('Назад к летописям') : t('Назад к предметам')}
      </a></p>}
      {importing && <ObsidianImport onClose={() => setImporting(false)}
        onImport={(imported) => {
          save([...entries, ...imported])
          if (imported[0]) window.location.hash = 'chronicles?entry=' + encodeURIComponent(imported[0].id)
        }} />}
      {draft !== null && (
        <CreationDialog wide={location} onCancel={() => { setDraft(null); setError('') }}>
          <form className={chronicle ? 'archive-form parchment' : 'archive-form'} onSubmit={submit} onInput={() => setError('')}>
            <h2 id="creation-dialog-title">{original ? t('Редактировать') : location ? t('Новая локация') : chronicle ? t('Новая летопись') : t('Новый предмет')}</h2>
            <label>{t("Название")}<input name="title" defaultValue={original?.title} required /></label>
            {location && <label>{t('Тип')}<select name="type" defaultValue={original?.type ?? ''} required>
              <option value="" disabled>{t('Выберите тип локации')}</option>
              {locationTypes.map((type) => <option key={type} value={type}>{t(type)}</option>)}
              {original?.type && !locationTypes.some((type) => type === original.type) && <option value={original.type}>{original.type}</option>}
            </select></label>}
            {!chronicle && (
              <>
                <ImageField name="image" label={location ? t("Изображение локации") : t("Изображение предмета")} initial={original?.image} />
                {location && <ImageField name="mapImage" label={t("Карта локации")} initial={original?.mapImage} initialMapPlan={original?.mapPlan} mapLocations={entries.filter(({ id }) => id !== original?.id)} generateMap />}
                {!location &&
                  <>
                    <label>{t('Тип')}<select name="type" value={itemType} onChange={(event) => setItemType(event.currentTarget.value)}>
                      {itemTypes.map((type) => <option key={type} value={type}>{t(type)}</option>)}
                      {original?.type && !itemTypes.some((type) => type === original.type) && <option value={original.type}>{original.type}</option>}
                    </select></label>
                    <label>{t('Материал')}<select name="material" defaultValue={original?.material ?? ''}>
                      <option value="">{t('Не указан')}</option>
                      {itemMaterials.map((material) => <option key={material} value={material}>{t(material)}</option>)}
                    </select></label>
                    <label>{t('Масса (кг)')}<input name="massKg" type="number" min={0} step="any" required defaultValue={original?.massKg} /></label>
                    <label>{t('Требуемый навык')}<input name="requiredSkill" maxLength={120} placeholder={t('Не требуется')} defaultValue={original?.requiredSkill} /></label>
                    {itemType === 'Оружие' && <label>{t('Формула урона')} <span>(1d8 + СИЛ + 5)</span>
                      <input name="damageFormula" maxLength={120} required defaultValue={original?.damageFormula} />
                    </label>}
                  </>}
                {!location && <label>{t("Редкость")}<select name="rarity" defaultValue={original?.rarity ?? rarities[0]}>
                  {rarities.map((rarity) => <option key={rarity} value={rarity}>{t(rarity)}</option>)}
                </select></label>}
              </>
            )}
            <label>{chronicle ? t('Краткая справка') : t('Краткое описание')}<textarea name="summary" rows={3} defaultValue={original?.summary} /></label>
            <label>{location ? t('История локации') : chronicle ? t('Текст летописи') : t('Свойства и история')}<textarea name="body" rows={8} defaultValue={original?.body} /></label>
            {chronicle ? (
              <>
                <RelativePicker name="events" label={t('Связанные события')} optionsLabel="Выбрать события"
                  searchLabel="Поиск по названию или году" emptyLabel="В таймлайне пока нет событий."
                  candidates={(timeline.events ?? []).map(({ id, title, year }) => ({ id, name: year + ' · ' + title }))}
                  initialIds={original?.eventIds ?? []} />
                <RelativePicker name="characters" label={t('Связанные персонажи')}
                  candidates={timeline.characters ?? []} initialIds={original?.characterIds ?? []} />
              </>
            ) : !location && (
              <label>{t("Владелец")}<select name="ownerId" defaultValue={original?.ownerId ?? ''}>
                <option value="">{t("Не указан")}</option>
                {(timeline.characters ?? []).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select></label>
            )}
            <EntryFields entry={original} />
            {error && <p role="alert">{error}</p>}
            <div><button type="submit">{t("Сохранить")}</button>{' '}
              <button type="button" onClick={() => { setDraft(null); setError('') }}>{t("Отмена")}</button></div>
          </form>
        </CreationDialog>
      )}
      <div className="directory-layout archive-directory">
        <section aria-label={t("Карточка записи")}>
          {selected && (
            <article className={chronicle ? 'archive-card parchment' : 'archive-card item-card item-tooltip' + (kind === 'items' ? ' item-wow-card' : '')} style={chronicle ? undefined : itemAccent(selected)}>
              {!chronicle && <ItemImage entry={selected} />}
              <h2 title={kind === 'items' ? shortWikiDescription(selected.summary || selected.body) : undefined}>{selected.title}</h2>
              {location && <p className="item-rarity">{[selected.type && t(selected.type), selected.rarity && t(selected.rarity)].filter(Boolean).join(' · ')}</p>}
              {kind === 'items' && (selected.type || selected.rarity) && <div className="item-wow-meta">
                {selected.rarity && <p>{t(selected.rarity)}</p>}
                {selected.type && <p>{t(selected.type)}</p>}
              </div>}
              {kind === 'items' && <section className="item-mechanics">
                <p>{t('Материал')} · {selected.material ? t(selected.material) : '—'}</p>
                <p><em>{t('Масса (кг)')} · {selected.massKg === undefined ? '—' : new Intl.NumberFormat().format(selected.massKg)}</em></p>
                <p><em>{t('Требуемый навык')} · {selected.requiredSkill || t('Не требуется')}</em></p>
              </section>}
              {kind === 'items' && selected.damageFormula && <ItemDamage key={JSON.stringify([selected.id, selected.damageFormula, ownerStrength])}
                formula={selected.damageFormula} ownerStrength={ownerStrength} />}
              {selected.summary && <p className="archive-copy"><WikiText text={selected.summary} /></p>}
              {location && <LoreLinks timeline={timeline} kind="locations" id={selected.id} />}
              {location && selected.mapImage && <section>
                <h3>{t('Карта локации')}</h3>
                <img className="location-map-image" src={selected.mapImage} alt={t('Карта локации') + ' · ' + selected.title} />
                <LocationMapZoom image={selected.mapImage} name={selected.title} markers={selected.mapPlan?.markers} />
              </section>}
              <EntryStatusLabel entry={selected} />
              <EntryGallery key={selected.id} entry={selected} />
              {!!selected.chronicleIds?.length && (
                <section>
                  <h3>{t("Связанные летописи")}</h3>
                  <ul>{entries.filter(({ id }) => selected.chronicleIds?.includes(id)).map(({ id, title }) => (
                    <li key={id}><a href={'#chronicles?entry=' + encodeURIComponent(id)}>{title}</a></li>
                  ))}</ul>
                </section>
              )}
              {selected.body && (
                <section className="archive-body">
                  <h3>{location ? t('История локации') : chronicle ? t('Хроника') : t('Свойства и история')}</h3>
                  <p className="archive-copy"><WikiText text={selected.body} /></p>
                </section>
              )}
              {selected.eventIds?.length ? (
                <section>
                  <h3>{t("Связанные события")}</h3>
                  <ul>{timeline.events?.filter(({ id }) => selected.eventIds?.includes(id)).map(({ id, title, year }) => (
                    <li key={id}><a href={'#events?event=' + encodeURIComponent(id)}>{year} · {title}</a></li>
                  ))}</ul>
                </section>
              ) : null}
              {selected.characterIds?.length || selected.ownerId ? (
                <section>
                  <h3>{chronicle ? t('Связанные персонажи') : t('Владелец')}</h3>
                  <ul>{timeline.characters?.filter(({ id }) => chronicle
                    ? selected.characterIds?.includes(id) : selected.ownerId === id).map(({ id, name }) => (
                    <li key={id}><a href={'#characters?character=' + encodeURIComponent(id)}>{name}</a></li>
                  ))}</ul>
                </section>
              ) : null}
              <button type="button" onClick={() => { setItemType(selected.type || 'Прочее'); setDraft(selected) }} aria-label={t("Редактировать")} title={t("Редактировать")}><EditIcon /></button>{' '}
              <button type="button" aria-label={t("Удалить запись")} title={t("Удалить запись")}
                onClick={() => { setError(''); setDeleting(selected) }}><TrashIcon /></button>
            </article>
          )}
          {entryId !== undefined && !selected && <p>{t("Запись не найдена в выбранном таймлайне.")}</p>}
          {entries.length === 0 && <p>{location ? t('Здесь пока нет локаций.') : chronicle ? t('Здесь пока нет летописей.') : t('Здесь пока нет предметов.')}</p>}
        </section>
        <section className="directory-table" aria-label={title}>
          <div className="directory-actions">
            <button type="button" onClick={() => { setItemType('Прочее'); setDraft('new') }}>{location ? t('Добавить локацию') : chronicle ? t('Создать летопись') : t('Добавить предмет')}</button>
            {chronicle && <button type="button" onClick={() => setImporting(true)}>{t("Импорт из Obsidian")}</button>}
          </div>
          {entries.length > 0 && <label>{t("Поиск ")}<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>}
          {matches.length ? (
            <div className="directory-table-scroll">
              <table>
                <thead>
                  <tr>
                    {kind === 'items' && <th className="directory-image-cell" scope="col">{t('Изображение')}</th>}
                    <th scope="col">{t("Название")}</th>
                    {!chronicle && <th scope="col">{t("Тип")}</th>}
                    {kind === 'items' && <th scope="col">{t("Редкость")}</th>}
                    <th scope="col">{t("Краткое описание")}</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((entry) => (
                    <tr key={entry.id} data-selected={entry.id === selected?.id}>
                      {kind === 'items' && <DirectoryImage src={entry.image} />}
                      <td><a href={'#' + entryRoute + encodeURIComponent(entry.id)}
                        title={kind === 'items' ? shortWikiDescription(entry.summary || entry.body) : undefined}
                        aria-current={entry.id === selected?.id ? 'true' : undefined}
                        onClick={() => { setDeleting(null); setError('') }}>{entry.title}</a></td>
                      {!chronicle && <td>{entry.type ? t(entry.type) : '—'}</td>}
                      {kind === 'items' && <td>{entry.rarity ? t(entry.rarity) : '—'}</td>}
                      <td><WikiText text={entry.summary || '—'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : entries.length > 0 && <p>{t("По этому запросу ничего не найдено.")}</p>}
        </section>
      </div>
      {deleting && (
        <dialog open className="card-delete-dialog" aria-labelledby="card-delete-title">
          <h2 id="card-delete-title">{t("Удалить запись «")}{deleting.title}»?</h2>
          <p>{t("Запись будет удалена из текущего таймлайна.")}</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>{t("Отмена")}</button>{' '}
          <button type="button" onClick={() => {
            try {
              save(entries.filter(({ id }) => id !== deleting.id))
              setDeleting(null)
              window.location.hash = kind
            } catch (error) {
              setError(error instanceof Error ? error.message : t('Не удалось удалить запись.'))
            }
          }}>{t("Удалить")}</button>
        </dialog>
      )}
    </Wrapper>
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
