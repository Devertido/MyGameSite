import { Fragment, useId, useState, type CSSProperties } from 'react'
import { t } from '../i18n.ts'
import { addHouseRelationship, houseGenerations, removeHouseRelationship, type HouseRelationship } from '../domain/houseTree'
import { CreationDialog } from './CreationDialog'
import type { TimelineCharacter } from '../domain/timeline'

const cardWidth = 144
const cardHeight = 174
const columnGap = 44
const rowGap = 76
const padding = 46

const relationshipLabels = {
  parent: 'Добавить родителя',
  child: 'Добавить ребёнка',
  spouse: 'Добавить супруга или супругу',
  lover: 'Добавить любовную связь',
} as const

type Connection = {
  first: TimelineCharacter
  second: TimelineCharacter
  kind: 'child' | 'spouse' | 'lover'
  path: string
  x: number
  y: number
}

const removalLabels = {
  child: 'Удалить связь родитель — ребёнок',
  spouse: 'Удалить супружескую связь',
  lover: 'Удалить любовную связь',
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
  const [removal, setRemoval] = useState<Connection>()
  const [error, setError] = useState('')
  const person = selection ? characters.find(({ id }) => id === selection.id) : undefined
  const candidates = selection && person ? characters
    .filter((relative) => addHouseRelationship(characters, person, relative, selection.relation))
    .sort((left, right) => fullName(left).localeCompare(fullName(right))) : []
  function closePicker() {
    setSelection(null)
    setRemoval(undefined)
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
  const connections: Connection[] = nodes.flatMap(({ person, x, y }) => {
    const endX = x + cardWidth / 2
    const parents = (linkedParents.get(person.id) ?? []).map((id) => byId.get(id)!)
    const links: Connection[] = parents.map((parent) => {
      const startX = parent.x + cardWidth / 2
      const startY = parent.y + cardHeight
      const branch = Math.sign(startX - endX)
      const sameBranch = parents.filter(({ x }) => Math.sign(x + cardWidth / 2 - endX) === branch)
      const offset = sameBranch.length === 1 ? 0 : sameBranch.indexOf(parent) / (sameBranch.length - 1) - 0.5
      const joint = y - rowGap / 2 + rowGap * 0.36 * offset
      return {
        first: parent.person, second: person, kind: 'child',
        path: `M ${startX} ${startY} V ${joint} H ${endX} V ${y}`,
        x: (startX + endX) / 2, y: joint,
      }
    })
    const spouse = person.spouseId ? byId.get(person.spouseId) : undefined
    if (spouse && (spouse.y > y || (spouse.y === y && spouse.x > x))) {
      const start = x + cardWidth
      const middle = y + cardHeight / 2
      const end = spouse.y === y ? spouse.x : spouse.x + cardWidth
      const turn = spouse.y === y ? (start + end) / 2 : Math.max(start, end) + columnGap / 2
      const spouseMiddle = spouse.y + cardHeight / 2
      links.push({
        first: person, second: spouse.person, kind: 'spouse',
        path: `M ${start} ${middle} H ${turn} V ${spouseMiddle} H ${end}`,
        x: turn, y: spouse.y === y ? middle : (middle + spouseMiddle) / 2,
      })
    }
    for (const [index, loverId] of (person.loverIds ?? []).entries()) {
      const lover = byId.get(loverId)
      if (!lover || lover.y < y || (lover.y === y && lover.x <= x)) continue
      const startX = x + cardWidth * 0.75
      const endX = lover.x + cardWidth * 0.25
      const lane = y - 28 - (index % 2) * 6
      const turn = width - 14 - (index % 2) * 8
      const sameRow = lover.y === y
      links.push({
        first: person, second: lover.person, kind: 'lover',
        path: sameRow ? `M ${startX} ${y} V ${lane} H ${endX} V ${y}`
          : `M ${startX} ${y} V ${lane} H ${turn} V ${lover.y - 28} H ${endX} V ${lover.y}`,
        x: sameRow ? (startX + endX) / 2 : turn,
        y: sameRow ? lane : (lane + lover.y - 28) / 2,
      })
    }
    return links
  })

  return <section className="house-tree">
    <h3 id={titleId}>{t('Родословное дерево')}</h3>
    {membersById.size > 0 && <p className="house-tree-legend">{t('Фиолетовая линия — любовная связь. Фиолетовый «+» добавляет её.')}</p>}
    {membersById.size === 0 ? <p>{t('Выберите этот род в карточках персонажей, чтобы построить дерево.')}</p> :
      <div className="house-tree-scroll" role="region" tabIndex={0} aria-labelledby={titleId}>
        <div className="house-tree-chart" style={{ width, height }}>
          <svg className="house-tree-lines" width={width} height={height} aria-hidden="true">
            {connections.map(({ first, second, kind, path }) => <path key={JSON.stringify([kind, first.id, second.id])}
              className={kind === 'child' ? undefined : 'house-tree-' + kind + '-line'} d={path} />)}
          </svg>
          {connections.map((connection) => {
            const { first, second, kind, x, y } = connection
            const action = t(removalLabels[kind])
            const label = action + ' · ' + fullName(first) + ' → ' + fullName(second)
            return <button key={JSON.stringify([kind, first.id, second.id])} className="house-tree-add house-tree-remove"
              type="button" style={{ left: x, top: y }} aria-label={label} title={label} onClick={() => setRemoval(connection)}>−</button>
          })}
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
              {person.bornOutsideMarriage && <small className="house-tree-outside-marriage">{t('Рождение вне брака')}</small>}
              {outside && person.dynasty && <small>{person.dynasty}</small>}
            </a>
              {(Object.keys(relationshipLabels) as HouseRelationship[]).map((relation) => {
                if (relation === 'spouse' && person.spouseId) return null
                const label = t(relationshipLabels[relation]) + ' · ' + name
                const style = relation === 'spouse'
                  ? { left: x + cardWidth, top: y + cardHeight / 2 }
                  : relation === 'lover'
                    ? { left: x - 13, top: y + cardHeight / 2 + 34 }
                    : { left: x + cardWidth / 2, top: relation === 'parent' ? y : y + cardHeight }
                return <button key={relation} className="house-tree-add" data-relation={relation} style={style}
                  type="button" aria-label={label} title={label} onClick={() => setSelection({ id: person.id, relation })}>+</button>
              })}
            </Fragment>
          })}
        </div>
      </div>}
    {removal && <CreationDialog titleId={dialogTitleId} onCancel={closePicker}>
      <h2 id={dialogTitleId}>{t(removalLabels[removal.kind])}</h2>
      <p>{fullName(removal.first)} → {fullName(removal.second)}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => {
        try {
          save(removeHouseRelationship(characters, removal.first.id, removal.second.id, removal.kind))
          closePicker()
        } catch (issue) {
          setError(issue instanceof Error ? issue.message : t('Не удалось сохранить запись.'))
        }
      }}>{t('Удалить')}</button>{' '}
      <button type="button" onClick={closePicker}>{t('Отмена')}</button>
    </CreationDialog>}
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
