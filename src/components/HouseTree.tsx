import { Fragment, useId, useState, type CSSProperties } from 'react'
import { t } from '../i18n.ts'
import { addHouseRelationship, houseGenerations, type HouseRelationship } from '../domain/houseTree'
import { CreationDialog } from './CreationDialog'
import type { TimelineCharacter } from '../domain/timeline'

const cardWidth = 144
const cardHeight = 174
const columnGap = 44
const rowGap = 76
const padding = 34

const relationshipLabels = {
  parent: 'Добавить родителя',
  child: 'Добавить ребёнка',
  spouse: 'Добавить супруга или супругу',
} as const

function fullName(person: TimelineCharacter) {
  return [person.name, person.surname].filter(Boolean).join(' ')
}

export function HouseTree({ house, characters, save }: {
  house: string
  characters: TimelineCharacter[]
  save: (characters: TimelineCharacter[]) => void
}) {
  const titleId = useId()
  const dialogTitleId = useId()
  const [selection, setSelection] = useState<{ id: string; relation: HouseRelationship } | null>(null)
  const [error, setError] = useState('')
  const person = selection ? characters.find(({ id }) => id === selection.id) : undefined
  const candidates = selection && person ? characters
    .filter((relative) => addHouseRelationship(characters, person, relative, selection.relation))
    .sort((left, right) => fullName(left).localeCompare(fullName(right))) : []
  function closePicker() {
    setSelection(null)
    setError('')
  }
  const { generations, linkedParents, membersById } = houseGenerations(characters, house)
  const widestRow = Math.max(1, ...generations.map((row) => row.length))
  const width = widestRow * (cardWidth + columnGap) - columnGap + 2 * padding
  const height = generations.length * (cardHeight + rowGap) - rowGap + 2 * padding
  const nodes = generations.flatMap((row, generation) => row.map((person, column) => ({
    person,
    x: (width - (row.length * (cardWidth + columnGap) - columnGap)) / 2 + column * (cardWidth + columnGap),
    y: padding + generation * (cardHeight + rowGap),
  })))
  const byId = new Map(nodes.map((node) => [node.person.id, node]))

  return <section className="house-tree">
    <h3 id={titleId}>{t('Родословное дерево')}</h3>
    {membersById.size === 0 ? <p>{t('Выберите этот род в карточках персонажей, чтобы построить дерево.')}</p> :
      <div className="house-tree-scroll" role="region" tabIndex={0} aria-labelledby={titleId}>
        <div className="house-tree-chart" style={{ width, height }}>
          <svg className="house-tree-lines" width={width} height={height} aria-hidden="true">
            {nodes.flatMap(({ person, x, y }) => (linkedParents.get(person.id) ?? []).map((id) => {
              const parent = byId.get(id)!
              const startX = parent.x + cardWidth / 2
              const startY = parent.y + cardHeight
              const endX = x + cardWidth / 2
              const joint = y - rowGap / 2
              return <path key={id + ':' + person.id} d={'M ' + startX + ' ' + startY + ' V ' + joint + ' H ' + endX + ' V ' + y} />
            }))}
            {nodes.map(({ person, x, y }) => {
              const spouse = person.spouseId ? byId.get(person.spouseId) : undefined
              if (!spouse || spouse.x <= x || spouse.y !== y) return null
              const middle = y + cardHeight / 2
              return <path key={person.id} className="house-tree-spouse-line" d={'M ' + (x + cardWidth) + ' ' + middle + ' H ' + spouse.x} />
            })}
          </svg>
          {nodes.map(({ person, x, y }) => {
            const name = fullName(person)
            const outside = !membersById.has(person.id)
            return <Fragment key={person.id}><a className="house-tree-person"
              href={'#characters?character=' + encodeURIComponent(person.id)}
              style={{ left: x, top: y, width: cardWidth, height: cardHeight, '--house-person-color': person.color } as CSSProperties}
              data-outside-house={outside} title={outside && person.dynasty ? name + ' · ' + person.dynasty : name}>
              {person.portrait ? <img src={person.portrait} alt="" loading="lazy" /> :
                <span className="house-tree-initial" aria-hidden="true">{person.name.slice(0, 1)}</span>}
              <span className="house-tree-name">{name}</span>
              {outside && person.dynasty && <small>{person.dynasty}</small>}
            </a>
              {(Object.keys(relationshipLabels) as HouseRelationship[]).map((relation) => {
                if (relation === 'spouse' && person.spouseId) return null
                const label = t(relationshipLabels[relation]) + ' · ' + name
                const style = relation === 'spouse'
                  ? { left: x + cardWidth, top: y + cardHeight / 2 }
                  : { left: x + cardWidth / 2, top: relation === 'parent' ? y : y + cardHeight }
                return <button key={relation} className="house-tree-add" data-relation={relation} style={style}
                  type="button" aria-label={label} title={label} onClick={() => setSelection({ id: person.id, relation })}>+</button>
              })}
            </Fragment>
          })}
        </div>
      </div>}
    {selection && person && <CreationDialog titleId={dialogTitleId} onCancel={closePicker}>
      <h2 id={dialogTitleId}>{t(relationshipLabels[selection.relation])}</h2>
      <p>{fullName(person)}</p>
      {selection.relation === 'spouse' && <p>{t('У супругов должен быть указан разный пол: Муж и Жен.')}</p>}
      <form onSubmit={(event) => {
        event.preventDefault()
        const id = new FormData(event.currentTarget).get('relative')
        const relative = candidates.find((candidate) => candidate.id === id)
        const next = relative && addHouseRelationship(characters, person, relative, selection.relation)
        if (!next) {
          setError(t('Не удалось добавить родственную связь.'))
          return
        }
        try {
          save(next)
          closePicker()
        } catch (issue) {
          setError(issue instanceof Error ? issue.message : t('Не удалось сохранить запись.'))
        }
      }}>
        {candidates.length ? <p><label>{t('Выберите персонажа')}{' '}
          <select name="relative" defaultValue="" required>
            <option value="" disabled>{t('Выберите персонажа')}</option>
            {candidates.map((relative) => <option key={relative.id} value={relative.id}>{fullName(relative)}</option>)}
          </select>
        </label></p> : <p>{t('Нет подходящих персонажей.')}</p>}
        {error && <p role="alert">{error}</p>}
        {candidates.length > 0 && <button type="submit">{t('Сохранить')}</button>}{' '}
        <button type="button" onClick={closePicker}>{t('Отмена')}</button>
      </form>
    </CreationDialog>}
  </section>
}
