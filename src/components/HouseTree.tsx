import { useId, type CSSProperties } from 'react'
import { t } from '../i18n.ts'
import { houseGenerations, houseRoles } from '../domain/houseTree'
import type { TimelineCharacter } from '../domain/timeline'

const cardWidth = 144
const cardHeight = 174
const columnGap = 24
const rowGap = 60
const padding = 16

export function HouseTree({ house, characters }: { house: string; characters: TimelineCharacter[] }) {
  const titleId = useId()
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
          </svg>
          {nodes.map(({ person, x, y }) => {
            const name = [person.name, person.surname].filter(Boolean).join(' ')
            const outside = !membersById.has(person.id)
            return <a className="house-tree-person" key={person.id}
              href={'#characters?character=' + encodeURIComponent(person.id)}
              style={{ left: x, top: y, width: cardWidth, height: cardHeight, '--house-person-color': person.color } as CSSProperties}
              data-outside-house={outside} title={outside && person.dynasty ? name + ' · ' + person.dynasty : name}>
              {person.portrait ? <img src={person.portrait} alt="" loading="lazy" /> :
                <span className="house-tree-initial" aria-hidden="true">{person.name.slice(0, 1)}</span>}
              <span className="house-tree-name">{name}</span>
              {!!person.houseRoles?.length && <small>{person.houseRoles.map((role) => t(houseRoles[role])).join(', ')}</small>}
              {outside && person.dynasty && <small>{person.dynasty}</small>}
            </a>
          })}
        </div>
      </div>}
  </section>
}
