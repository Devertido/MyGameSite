import { useState, type FormEvent } from 'react'
import { CreationDialog } from './CreationDialog'
import { emptyLore, glossaryDescription, isGlossarySection, linkKinds, loreTargets, validLore, type LinkKind, type WorldLore } from '../domain/lore'
import type { Timeline } from '../domain/timeline'

const sections = [
  ['surnames', 'Фамилии'], ['races', 'Расы'], ['dynasties', 'Династии'],
  ['classes', 'Классы'], ['spells', 'Заклинания'],
  ['cultures', 'Народы и культуры'], ['faiths', 'Религии и верования'], ['reigns', 'Титулы и наследование'],
] as const

const fieldsByKind = {
  cultures: ['Языки', 'Обычаи', 'Праздники', 'Правила именования'],
  faiths: ['Божества', 'Культы', 'Обряды', 'Святыни'],
}

const linkLabels = { characters: 'Персонажи', locations: 'Локации', organizations: 'Фракции и ордены', events: 'События' }
const linkParameters = { characters: 'character', locations: 'entry', organizations: 'organization', events: 'event' }

export function LorePage({ timeline, save, initialSection }: { timeline: Timeline; save: (lore: WorldLore) => void; initialSection?: string }) {
  const lore = { ...emptyLore, ...timeline.lore, classes: timeline.lore?.classes ?? [], spells: timeline.lore?.spells ?? [] }
  const [section, setSection] = useState<typeof sections[number][0]>(() => sections.find(([key]) => key === initialSection)?.[0] ?? 'surnames')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const label = sections.find(([key]) => key === section)?.[1]
  const traditionKind = section === 'cultures' || section === 'faiths' ? section : null
  const tradition = traditionKind ? lore[traditionKind].find(({ id }) => id === editing) : undefined
  const reign = section === 'reigns' ? lore.reigns.find(({ id }) => id === editing) : undefined

  function persist(next: WorldLore) {
    try {
      if (!validLore(next, timeline)) throw new Error('Проверьте поля записи и годы в пределах таймлайна.')
      save(next)
      setEditing(null)
      setError('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Не удалось сохранить запись.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    const name = read('name')
    if (!name) {
      setError('Введите название.')
      return
    }
    const id = editing || crypto.randomUUID()
    if (traditionKind) {
      const entry = {
        id, name, fields: fieldsByKind[traditionKind].map((_, index) => read('field-' + index)),
        links: linkKinds.flatMap((kind) => data.getAll(kind).map((id) => ({ kind, id: String(id) }))),
      }
      persist({ ...lore, [traditionKind]: tradition
        ? lore[traditionKind].map((item) => item.id === id ? entry : item) : [...lore[traditionKind], entry] })
    } else if (section === 'reigns') {
      const entry = { id, title: name, characterId: read('character'), organizationId: read('organization'),
        start: Number(read('start')), end: read('end') ? Number(read('end')) : null, accession: read('accession') }
      persist({ ...lore, reigns: reign ? lore.reigns.map((item) => item.id === id ? entry : item) : [...lore.reigns, entry] })
    } else if (isGlossarySection(section)) {
      if (lore[section].some((item) => item !== editing && item.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
        setError('Такое значение уже есть в справочнике.')
        return
      }
      const text = read('description')
      const descriptions = (lore.descriptions ?? []).filter((entry) => entry.section !== section || entry.name !== editing)
      if (text) descriptions.push({ section, name, text })
      persist({ ...lore, descriptions, [section]: [...lore[section].filter((item) => item !== editing), name] })
    }
  }

  function remove(id: string) {
    if (!window.confirm('Удалить запись из справочника?')) return
    const entries = lore[section]
    persist({
      ...lore,
      descriptions: lore.descriptions?.filter((entry) => entry.section !== section || entry.name !== id),
      [section]: entries.filter((entry) => typeof entry === 'string' ? entry !== id : entry.id !== id),
    })
  }

  function linkedName(kind: LinkKind, id: string) {
    return loreTargets(timeline, kind).find((entry) => entry.id === id)?.name
  }

  return (
    <main className="section-page">
      <h1>Справочник мира</h1>
      <label>Раздел{' '}
        <select value={section} onChange={(event) => {
          const next = sections.find(([key]) => key === event.currentTarget.value)
          if (next) setSection(next[0])
          setError('')
        }}>
          {sections.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
        </select>
      </label>{' '}
      <button type="button" onClick={() => { setError(''); setEditing('') }}>Добавить запись</button>
      {error && editing === null && <p role="alert">{error}</p>}
      <ul className="event-list">
        {lore[section].map((entry) => {
          const id = typeof entry === 'string' ? entry : entry.id
          const name = typeof entry === 'string' ? entry : 'title' in entry ? entry.title : entry.name
          return <li key={id}>
            <h2>{name}</h2>
            {isGlossarySection(section) && <p hidden={!glossaryDescription(lore, section, name)}>
              {glossaryDescription(lore, section, name)}
            </p>}
            {typeof entry !== 'string' && 'title' in entry && (
              <p>{linkedName('characters', entry.characterId)} · {linkedName('organizations', entry.organizationId)} · {entry.start} — {entry.end ?? '…'}{entry.accession && ' · ' + entry.accession}</p>
            )}
            {typeof entry !== 'string' && 'fields' in entry && traditionKind && (
              <>
                {entry.fields.map((value, index) => value && <p key={index}><strong>{fieldsByKind[traditionKind][index]}</strong> · {value}</p>)}
                {entry.links.map(({ kind, id }) => <p key={kind + id}>
                  <a href={'#' + kind + '?' + linkParameters[kind] + '=' + encodeURIComponent(id)}>{linkedName(kind, id)}</a>
                </p>)}
              </>
            )}
            <button type="button" onClick={() => { setError(''); setEditing(id) }}>Редактировать</button>{' '}
            <button type="button" onClick={() => remove(id)}>Удалить</button>
          </li>
        })}
      </ul>
      {editing !== null && (
        <CreationDialog onCancel={() => { setEditing(null); setError('') }}>
          <h2 id="creation-dialog-title">{label}</h2>
          <form onSubmit={submit}>
            <p><label>Название <input name="name" required defaultValue={tradition?.name ?? reign?.title ?? editing} /></label></p>
            {isGlossarySection(section) && (
              <p><label>Описание<br /><textarea name="description" rows={4}
                defaultValue={glossaryDescription(lore, section, editing)} /></label></p>
            )}
            {traditionKind && (
              <>
                {fieldsByKind[traditionKind].map((field, index) => (
                  <p key={field}><label>{field}<br /><textarea name={'field-' + index} defaultValue={tradition?.fields[index]} /></label></p>
                ))}
                {linkKinds.map((kind) => (
                  <fieldset key={kind}><legend>{linkLabels[kind]}</legend>
                    {loreTargets(timeline, kind).map(({ id, name }) => <label key={id} className="event-participant">
                      <input type="checkbox" name={kind} value={id}
                        defaultChecked={tradition?.links.some((link) => link.kind === kind && link.id === id)} /> {name}
                    </label>)}
                  </fieldset>
                ))}
              </>
            )}
            {section === 'reigns' && (
              <>
                <p><label>Правитель <select name="character" required defaultValue={reign?.characterId ?? ''}>
                  <option value="">Выберите персонажа</option>
                  {loreTargets(timeline, 'characters').map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select></label></p>
                <p><label>Государство <select name="organization" required defaultValue={reign?.organizationId ?? ''}>
                  <option value="">Выберите организацию</option>
                  {loreTargets(timeline, 'organizations').map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select></label></p>
                <p><label>Год вступления <input name="start" type="number" required min={timeline.startYear} max={timeline.endYear} defaultValue={reign?.start} /></label></p>
                <p><label>Год окончания <input name="end" type="number" min={timeline.startYear} max={timeline.endYear} defaultValue={reign?.end ?? ''} /></label></p>
                <p><label>Как получил титул <input name="accession" defaultValue={reign?.accession} /></label></p>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <button type="submit">Сохранить</button>{' '}
            <button type="button" onClick={() => { setEditing(null); setError('') }}>Отмена</button>
          </form>
        </CreationDialog>
      )}
    </main>
  )
}
