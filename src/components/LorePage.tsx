import { HouseTree } from './HouseTree'
import { t } from '../i18n.ts'
import { BestiaryCard, BeastCombatFields } from './BestiaryCard'
import { AbilityFields } from './AbilityScores'
import { readAbilityScores } from '../domain/abilities'
import { ImageField } from './ImageField'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { MagicDetails, RaceFields, SpellFields } from './LoreDetails'
import { CreationDialog } from './CreationDialog'
import { emptyLore, glossaryDescription, isGlossarySection, beastCombatFields, surnameOrigins, spellComponents, loreTargets, validLore, type LinkKind, type WorldLore } from '../domain/lore'
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

function entryId(entry: string | { id: string }) {
  return typeof entry === 'string' ? entry : entry.id
}

function entryName(entry: string | { name: string } | { title: string }) {
  return typeof entry === 'string' ? entry : 'title' in entry ? entry.title : entry.name
}

export function LorePage({ timeline, save, initialSection, archive }: { timeline: Timeline; save: (lore: WorldLore, rename?: { from: string; to: string }) => void; initialSection?: string; archive: ReactNode }) {
  const lore = { ...emptyLore, ...timeline.lore, bestiary: timeline.lore?.bestiary ?? [], classes: timeline.lore?.classes ?? [], spells: timeline.lore?.spells ?? [] }
  const section = sections.find(([key]) => key === initialSection)?.[0] ?? 'surnames'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const archiveSection = section === 'items' || section === 'locations'
  const entries = archiveSection ? [] : lore[section]
  const selected = entries.find((entry) => entryId(entry) === selectedId) ?? entries[0]
  const label = sections.find(([key]) => key === section)?.[1]
  const traditionKind = section === 'cultures' || section === 'faiths' ? section : null
  const tradition = traditionKind ? lore[traditionKind].find(({ id }) => id === editing) : undefined
  const surname = section === 'surnames' ? lore.surnameDetails?.find(({ name }) => name === editing) : undefined
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
        next.raceDetails = [...(lore.raceDetails ?? []).filter((entry) => entry.name !== editing), {
          name, image: read('lore-image'), lifespan: read('lifespan'), height: read('height'),
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
      ...(section === 'dynasties' ? { surnameDetails: lore.surnameDetails?.map((entry) =>
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
            <button type="button" onClick={() => { setError(''); setEditing(id) }}>{t("Редактировать")}</button>{' '}
            <button type="button" onClick={() => remove(id)}>{t("Удалить")}</button>
          </>
          if (typeof entry !== 'string' && 'abilities' in entry) {
            return <BestiaryCard key={id} beast={entry} controls={controls} />
          }
          const name = entryName(entry)
          const details = section === 'surnames' ? lore.surnameDetails?.find((item) => item.name === name) : undefined
          const location = timeline.locations?.find((item) => item.id === details?.locationId)
          const magic = section === 'races' || section === 'spells'
          return <article key={id} className={magic ? 'archive-card item-card item-tooltip lore-magic-card' : 'directory-card'}
            style={magic ? { '--item-accent': '#f4d28d' } as CSSProperties : undefined}>
            <h2>{name}</h2>
            {magic && <MagicDetails
              race={section === 'races' ? lore.raceDetails?.find((item) => item.name === name) : undefined}
              spell={section === 'spells' ? lore.spellDetails?.find((item) => item.name === name) : undefined} />}
            {isGlossarySection(section) && <p hidden={!glossaryDescription(lore, section, name)}>
              {glossaryDescription(lore, section, name)}
            </p>}
            {details?.origin && <p><strong>{t("Происхождение")}</strong> · {t(details.origin)}</p>}
            {location && <p><strong>{t("Локация")}</strong> · <a href={'#lore?section=locations&entry=' + encodeURIComponent(location.id)}>{location.title}</a></p>}
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
            <button type="button" onClick={() => { setError(''); setEditing('') }}>{t("Добавить запись")}</button>
          </div>
          {entries.length > 0 && (
            <div className="directory-table-scroll">
              <table>
                <thead><tr><th scope="col">{t("Название")}</th></tr></thead>
                <tbody>{entries.map((entry) => (
                  <tr key={entryId(entry)} data-selected={entry === selected}>
                    <td><button className="directory-select" type="button" aria-pressed={entry === selected}
                      onClick={() => setSelectedId(entryId(entry))}>{entryName(entry)}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {section === 'dynasties' && typeof selected === 'string' && <HouseTree house={selected} characters={timeline.characters ?? []} />}
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
                <ImageField name="beast-image" label={t("Изображение существа")} initial={beast?.image} />
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
