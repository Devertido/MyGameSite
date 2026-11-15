import { sameHouse } from '../domain/houseTree'
import { DirectoryImage } from './DirectoryImage'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { HouseTree } from './HouseTree'
import { t } from '../i18n.ts'
import { BestiaryCard, BeastCombatFields } from './BestiaryCard'
import { AbilityFields } from './AbilityScores'
import { readAbilityScores } from '../domain/abilities'
import { ImageField } from './ImageField'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { MagicDetails, RaceFields, SpellFields } from './LoreDetails'
import { CreationDialog } from './CreationDialog'
import { emptyLore, glossaryDescription, isGlossarySection, beastCombatFields, readRaceMeasure, surnameOrigins, spellComponents, loreTargets, validHouseYears, validLore, type HouseDetails, type LinkKind, type WorldLore } from '../domain/lore'
import type { Timeline } from '../domain/timeline'

const sections = [
  ['surnames', 'Фамилии'], ['races', 'Расы'], ['dynasties', 'Род'],
  ['classes', 'Классы'], ['spells', 'Заклинания'],
  ['cultures', 'Культуры'], ['faiths', 'Верования'], ['bestiary', 'Бестиарий'], ['items', 'Предметы'], ['locations', 'Локации'],
] as const

const fieldsByKind = {
  cultures: ['Языки', 'Обычаи', 'Праздники', 'Правила именования'],
  faiths: ['Божества', 'Культы', 'Обряды', 'Святыни'],
}

const linkParameters = { characters: 'character', locations: 'entry', organizations: 'organization', events: 'event' }

function houseYears(details?: HouseDetails) {
  if (details?.startYear === undefined && details?.endYear === undefined) return '—'
  return (details.startYear ?? '…') + ' — ' + (details.endYear ?? '…')
}

function entryId(entry: string | { id: string }) {
  return typeof entry === 'string' ? entry : entry.id
}

function entryName(entry: string | { name: string } | { title: string }) {
  return typeof entry === 'string' ? entry : 'title' in entry ? entry.title : entry.name
}

export function LorePage({ timeline, save, initialSection, initialEntry, archive, saveCharacters }: { timeline: Timeline; save: (lore: WorldLore, rename?: { from: string; to: string }) => void; initialSection?: string; initialEntry?: string; archive: ReactNode; saveCharacters: (characters: NonNullable<Timeline['characters']>) => void }) {
  const lore = { ...emptyLore, ...timeline.lore, bestiary: timeline.lore?.bestiary ?? [], classes: timeline.lore?.classes ?? [], spells: timeline.lore?.spells ?? [] }
  const section = sections.find(([key]) => key === initialSection)?.[0] ?? 'surnames'
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    section === 'dynasties' ? lore.dynasties.find((name) => sameHouse(initialEntry, name)) ?? null : null)
  const [spellQuery, setSpellQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const archiveSection = section === 'items' || section === 'locations'
  const entries = archiveSection ? [] : lore[section]
  const spellSection = section === 'spells'
  const spellDetails = new Map(lore.spellDetails?.map((spell) => [spell.name, spell]))
  const tableEntries = spellSection
    ? entries.filter((entry) => entryName(entry).toLocaleLowerCase('ru').includes(spellQuery.trim().toLocaleLowerCase('ru')))
    : entries
  const selected = entries.find((entry) => entryId(entry) === selectedId) ?? entries[0]
  const label = sections.find(([key]) => key === section)?.[1]
  const traditionKind = section === 'cultures' || section === 'faiths' ? section : null
  const tradition = traditionKind ? lore[traditionKind].find(({ id }) => id === editing) : undefined
  const surname = section === 'surnames' ? lore.surnameDetails?.find(({ name }) => name === editing) : undefined
  const house = section === 'dynasties' ? lore.houseDetails?.find(({ name }) => name === editing) : undefined
  const houseByName = new Map(lore.houseDetails?.map((details) => [details.name, details]))
  function houseLocations(name: string) {
    const ids = houseByName.get(name)?.locationIds ?? []
    return (timeline.locations ?? []).filter(({ id }) => ids.includes(id))
  }
  const beast = section === 'bestiary' ? lore.bestiary.find(({ id }) => id === editing) : undefined

  function persist(next: WorldLore, rename?: { from: string; to: string }) {
    try {
      if (!validLore(next, timeline)) throw new Error(t('Проверьте поля записи и годы в пределах таймлайна.'))
      save(next, rename)
      setEditing(null)
      setError('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t('Не удалось сохранить запись.'))
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    const name = read('name')
    if (!name) {
      setError(t('Введите название.'))
      return
    }
    const id = editing || crypto.randomUUID()
    if (traditionKind) {
      const entry = {
        id, name, fields: fieldsByKind[traditionKind].map((_, index) => read('field-' + index)),
        links: tradition?.links ?? [],
      }
      persist({ ...lore, [traditionKind]: tradition
        ? lore[traditionKind].map((item) => item.id === id ? entry : item) : [...lore[traditionKind], entry] })
    } else if (section === 'bestiary') {
      const entry = { id, name, type: read('beast-type'), description: read('description'),
        image: read('beast-image'), abilities: readAbilityScores(data),
        combat: Object.fromEntries(beastCombatFields.flatMap(([key]) => {
          const value = read('beast-' + key)
          return value ? [[key, value]] : []
        })),
      }
      persist({ ...lore, bestiary: beast
        ? lore.bestiary.map((item) => item.id === id ? entry : item) : [...lore.bestiary, entry] })
      setSelectedId(id)
    } else if (isGlossarySection(section)) {
      if (lore[section].some((item) => item !== editing && item.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
        setError(t('Такое значение уже есть в справочнике.'))
        return
      }
      const text = read('description')
      const descriptions = (lore.descriptions ?? []).filter((entry) => entry.section !== section || entry.name !== editing)
      if (text) descriptions.push({ section, name, text })
      const next = { ...lore, descriptions, [section]: [...lore[section].filter((item) => item !== editing), name] }
      if (section === 'surnames') {
        const origin = surnameOrigins.find((item) => item === read('surname-origin')) ?? ''
        const locationId = read('surname-location')
        const dynasty = read('surname-dynasty')
        next.surnameDetails = [...(lore.surnameDetails ?? []).filter((entry) => entry.name !== editing), {
          name, origin, usage: read('surname-usage'),
          ...(locationId ? { locationId } : {}),
          ...(dynasty ? { dynasty } : {}),
        }]
      }
      if (section === 'dynasties') {
        const start = read('house-start')
        const end = read('house-end')
        const startYear = start ? Number(start) : undefined
        const endYear = end ? Number(end) : undefined
        if (!validHouseYears(startYear, endYear)) {
          setError(t('Проверьте порядок годов существования рода.'))
          return
        }
        next.houseDetails = [...(lore.houseDetails ?? []).filter((entry) => entry.name !== editing), {
          name, startYear, endYear, locationIds: [...new Set(data.getAll('house-location').map(String))],
        }]
      }
      if (section === 'dynasties' && editing && name !== editing && lore.surnameDetails) {
        next.surnameDetails = lore.surnameDetails.map((entry) =>
          entry.dynasty === editing ? { ...entry, dynasty: name } : entry)
      }
      if (section === 'spells') {
        next.spellDetails = [...(lore.spellDetails ?? []).filter((entry) => entry.name !== editing), {
          name, image: read('lore-image'), mana: read('mana') ? Number(read('mana')) : null,
          components: spellComponents.filter((component) => data.getAll('components').includes(component)),
        }]
      }
      if (section === 'races') {
        const prior = lore.raceDetails?.find((entry) => entry.name === editing)
        const lifespan = readRaceMeasure(data, 'lifespan', prior?.lifespan)
        const height = readRaceMeasure(data, 'height', prior?.height)
        if (lifespan === null || height === null) {
          setError(t('Укажите целые числа. Конец диапазона должен быть не меньше начала.'))
          return
        }
        next.raceDetails = [...(lore.raceDetails ?? []).filter((entry) => entry.name !== editing), {
          name, image: read('lore-image'), lifespan, height,
          size: read('size'), bonuses: read('bonuses'), debuffs: read('debuffs'),
          abilityBonuses: readAbilityScores(data, 'race-bonus-'),
          abilityPenalties: readAbilityScores(data, 'race-penalty-'),
        }]
      }
      setSelectedId(name)
      persist(next, section === 'dynasties' && editing && name !== editing ? { from: editing, to: name } : undefined)
    }
  }

  function remove(id: string) {
    if (!window.confirm(t('Удалить запись из справочника?'))) return
    persist({
      ...lore,
      ...(section === 'surnames' ? { surnameDetails: lore.surnameDetails?.filter((entry) => entry.name !== id) } : {}),
      ...(section === 'dynasties' ? { houseDetails: lore.houseDetails?.filter((entry) => entry.name !== id),
        surnameDetails: lore.surnameDetails?.map((entry) =>
        entry.dynasty === id ? { ...entry, dynasty: undefined } : entry) } : {}),
      ...(section === 'races' ? { raceDetails: lore.raceDetails?.filter((entry) => entry.name !== id) } : {}),
      ...(section === 'spells' ? { spellDetails: lore.spellDetails?.filter((entry) => entry.name !== id) } : {}),
      descriptions: lore.descriptions?.filter((entry) => entry.section !== section || entry.name !== id),
      [section]: entries.filter((entry) => typeof entry === 'string' ? entry !== id : entry.id !== id),
    })
  }

  function linkedName(kind: LinkKind, id: string) {
    return loreTargets(timeline, kind).find((entry) => entry.id === id)?.name
  }

  return (
    <main className="section-page lore-page">
      <h1>{t("Справочник мира")}</h1>
      <nav className="directory-actions lore-sections" aria-label={t("Разделы справочника")}>
        {sections.map(([key, title]) => (
          <button type="button" className="lore-toggle" key={key} aria-pressed={section === key} onClick={() => {
            window.location.hash = 'lore?section=' + key
          }}>{t(title)}</button>
        ))}
      </nav>
      {archiveSection ? archive : <>
      {error && editing === null && <p role="alert">{error}</p>}
      <div className={section === 'bestiary' ? "directory-layout bestiary-layout" : "directory-layout"}>
        <div>
        {selected === undefined ? <p>{t("В разделе пока нет записей.")}</p> : [selected].map((entry) => {
          const id = entryId(entry)
          const controls = <>
            <button type="button" aria-label={t('Редактировать')} title={t('Редактировать')}
              onClick={() => { setError(''); setEditing(id) }}>{spellSection ? <EditIcon /> : t('Редактировать')}</button>{' '}
            <button type="button" aria-label={t('Удалить')} title={t('Удалить')}
              onClick={() => remove(id)}>{spellSection ? <TrashIcon /> : t('Удалить')}</button>
          </>
          if (typeof entry !== 'string' && 'abilities' in entry) {
            return <BestiaryCard key={id} beast={entry} controls={controls} />
          }
          const name = entryName(entry)
          const details = section === 'surnames' ? lore.surnameDetails?.find((item) => item.name === name) : undefined
          const location = timeline.locations?.find((item) => item.id === details?.locationId)
          const spell = spellSection ? spellDetails.get(name) : undefined
          const magic = section === 'races' || section === 'spells'
          return <article key={id} className={magic ? 'archive-card item-card item-tooltip lore-magic-card' : 'directory-card'}
            style={magic ? { '--item-accent': '#f4d28d' } as CSSProperties : undefined}>
            {spellSection && <div className="item-image-frame">
              {spell?.image && <img className="atlas-entry-image" src={spell?.image} alt="" />}
            </div>}
            <h2>{name}</h2>
            {spellSection && spell?.mana != null && <p className="item-rarity">
              {t('Мана · ')}{spell?.mana}
            </p>}
            {spellSection && Boolean(spell?.components.length) && <p className="spell-components">
              {t('Компоненты · ')}{spell?.components.map(t).join(' · ')}
            </p>}
            {section === 'races' && <MagicDetails race={lore.raceDetails?.find((item) => item.name === name)} />}
            {isGlossarySection(section) && <p className={spellSection ? 'archive-copy' : undefined} hidden={!glossaryDescription(lore, section, name)}>
              {glossaryDescription(lore, section, name)}
            </p>}
            {details?.origin && <p><strong>{t("Происхождение")}</strong> · {t(details.origin)}</p>}
            {location && <p><strong>{t("Локация")}</strong> · <a href={'#lore?section=locations&entry=' + encodeURIComponent(location.id)}>{location.title}</a></p>}
            {section === 'dynasties' && <>
              <p><strong>{t('Количество персонажей')}</strong> · {timeline.characters?.filter(({ dynasty }) => sameHouse(dynasty, name)).length ?? 0}</p>
              <p><strong>{t('Годы существования')}</strong> · {houseYears(houseByName.get(name))}</p>
              {houseLocations(name).length > 0 && <section>
                <h3>{t('Владения')}</h3>
                <ul>{houseLocations(name).map(({ id, title, type }) => <li key={id}>
                  <a href={'#lore?section=locations&entry=' + encodeURIComponent(id)}>{title}</a>{type && ' · ' + type}
                </li>)}</ul>
              </section>}
            </>}
            {details?.dynasty && <p><strong>{t("Род")}</strong> · {details.dynasty}</p>}
            {details?.usage && <p className="archive-copy"><strong>{t("Значение и правила ношения")}</strong><br />{details.usage}</p>}
            {typeof entry !== 'string' && 'fields' in entry && traditionKind && (
              <>
                {entry.fields.map((value, index) => value && <p key={index}><strong>{t(fieldsByKind[traditionKind][index]!)}</strong> · {value}</p>)}
                {entry.links.map(({ kind, id }) => <p key={kind + id}>
                  <a href={(kind === 'locations' ? '#lore?section=locations&' : '#' + kind + '?') + linkParameters[kind] + '=' + encodeURIComponent(id)}>{linkedName(kind, id)}</a>
                </p>)}
              </>
            )}
            {controls}
          </article>
        })}
        </div>
        <section className="directory-table" aria-label={label && t(label)}>
          <div className="directory-actions">
            <button type="button" onClick={() => { setError(''); setEditing('') }}>{t(spellSection ? 'Добавить заклинание' : 'Добавить запись')}</button>
          </div>
          {spellSection && entries.length > 0 && <label>{t('Поиск ')}<input type="search" value={spellQuery}
            onChange={(event) => setSpellQuery(event.currentTarget.value)} /></label>}
          {tableEntries.length > 0 ? (
            <div className="directory-table-scroll">
              <table>
                <thead><tr>
                  {spellSection && <th className="directory-image-cell" scope="col">{t('Изображение')}</th>}
                  <th scope="col">{t("Название")}</th>
                  {spellSection && <>
                    <th scope="col">{t('Мана')}</th>
                    <th scope="col">{t('Компоненты')}</th>
                    <th scope="col">{t('Краткое описание')}</th>
                  </>}
                  {section === 'dynasties' && <>
                    <th scope="col">{t('Количество персонажей')}</th>
                    <th scope="col">{t('Годы существования')}</th>
                    <th scope="col">{t('Владения')}</th>
                  </>}
                  {section === 'bestiary' && <>
                    <th scope="col">{t("Вид существа")}</th>
                    <th scope="col">{t("Опасность")}</th>
                    <th scope="col">{t("Уровень")}</th>
                  </>}
                </tr></thead>
                <tbody>{tableEntries.map((entry) => {
                  const name = entryName(entry)
                  const spell = spellSection ? spellDetails.get(name) : undefined
                  return <tr key={entryId(entry)} data-selected={entry === selected}>
                    {spellSection && <DirectoryImage src={spell?.image} />}
                    <td><button className={spellSection ? 'directory-select directory-select-link' : 'directory-select'} type="button" aria-pressed={entry === selected}
                      onClick={() => setSelectedId(entryId(entry))}>{name}</button></td>
                    {spellSection && <>
                      <td>{spell?.mana ?? '—'}</td>
                      <td>{spell?.components.map(t).join(' · ') || '—'}</td>
                      <td>{glossaryDescription(lore, 'spells', name) || '—'}</td>
                    </>}
                    {section === 'dynasties' && typeof entry === 'string' && <>
                      <td>{timeline.characters?.filter(({ dynasty }) => sameHouse(dynasty, entry)).length ?? 0}</td>
                      <td>{houseYears(houseByName.get(entry))}</td>
                      <td>{houseLocations(entry).map(({ title }) => title).join(', ') || '—'}</td>
                    </>}
                    {typeof entry !== 'string' && 'abilities' in entry && <>
                      <td>{entry.type || '—'}</td>
                      <td>{entry.combat?.challenge || '—'}</td>
                      <td>{entry.combat?.level || '—'}</td>
                    </>}
                  </tr>
                })}</tbody>
              </table>
            </div>
          ) : entries.length > 0 && <p>{t('По этому запросу ничего не найдено.')}</p>}
        </section>
      </div>
      {section === 'dynasties' && typeof selected === 'string' && <HouseTree key={selected} house={selected} characters={timeline.characters ?? []} save={saveCharacters} />}
      {editing !== null && (
        <CreationDialog onCancel={() => { setEditing(null); setError('') }}>
          <h2 id="creation-dialog-title">{label && t(label)}</h2>
          <form onSubmit={submit}>
            <p><label>{t("Название ")}<input name="name" required defaultValue={tradition?.name ?? beast?.name ?? editing} /></label></p>
            {isGlossarySection(section) && (
              <p><label>{t("Описание")}<br /><textarea name="description" rows={4}
                defaultValue={glossaryDescription(lore, section, editing)} /></label></p>
            )}
            {section === 'surnames' && (
              <fieldset>
                <legend>{t("Происхождение фамилии")}</legend>
                <p><label>{t("Тип происхождения ")}<select name="surname-origin" defaultValue={surname?.origin ?? ''}>
                  <option value="">{t("Не указан")}</option>
                  {surnameOrigins.filter(Boolean).map((origin) => <option key={origin} value={origin}>{t(origin)}</option>)}
                </select></label></p>
                <p><label>{t("Связанная локация ")}<select name="surname-location" defaultValue={surname?.locationId ?? ''}>
                  <option value="">{t("Не указана")}</option>
                  {(timeline.locations ?? []).map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
                </select></label></p>
                <p><label>{t("Связанный род ")}<select name="surname-dynasty" defaultValue={surname?.dynasty ?? ''}>
                  <option value="">{t("Не указана")}</option>
                  {lore.dynasties.map((dynasty) => <option key={dynasty}>{dynasty}</option>)}
                </select></label></p>
                <p><label>{t("Значение и кто вправе носить фамилию")}<br />
                  <textarea name="surname-usage" rows={3} defaultValue={surname?.usage} />
                </label></p>
              </fieldset>
            )}
            {section === 'dynasties' && <>
              <p><label>{t('Системный год основания')} <input type="number" step={1} name="house-start" defaultValue={house?.startYear} /></label></p>
              <p><label>{t('Системный год окончания')} <input type="number" step={1} name="house-end" defaultValue={house?.endYear} /></label></p>
              <fieldset>
                <legend>{t('Владения (локации и провинции)')}</legend>
                {timeline.locations?.length ? timeline.locations.map(({ id, title, type }) => <div key={id}>
                  <label><input type="checkbox" name="house-location" value={id} defaultChecked={house?.locationIds.includes(id)} />{' '}
                    {title}{type && ' · ' + type}</label>
                </div>) : <p>{t('В разделе пока нет записей.')}</p>}
              </fieldset>
            </>}
            {section === 'races' && <RaceFields race={lore.raceDetails?.find(({ name }) => name === editing)} />}
            {section === 'spells' && <SpellFields spell={lore.spellDetails?.find(({ name }) => name === editing)} />}
            {traditionKind && (
              <>
                {fieldsByKind[traditionKind].map((field, index) => (
                  <p key={field}><label>{t(field)}<br /><textarea name={'field-' + index} defaultValue={tradition?.fields[index]} /></label></p>
                ))}
              </>
            )}
            {section === 'bestiary' && (
              <>
                <ImageField name="beast-image" label={t("Изображение существа")} initial={beast?.image} largeIllustration />
                <p><label>{t("Вид существа ")}<input name="beast-type" defaultValue={beast?.type} /></label></p>
                <p><label>{t("Описание")}<br /><textarea name="description" rows={4} defaultValue={beast?.description} /></label></p>
                <AbilityFields scores={beast?.abilities} />
                <BeastCombatFields combat={beast?.combat} />
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <button type="submit">{t("Сохранить")}</button>{' '}
            <button type="button" onClick={() => { setEditing(null); setError('') }}>{t("Отмена")}</button>
          </form>
        </CreationDialog>
      )}
      </>}
    </main>
  )
}
