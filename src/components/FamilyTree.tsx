import { CreationDialog } from './CreationDialog'
import type { TimelineCharacter } from '../domain/timeline'

export function FamilyTree({ character, characters, onClose }: {
  character: TimelineCharacter
  characters: TimelineCharacter[]
  onClose: () => void
}) {
  const parentIds = character.parentIds ?? []
  const parents = characters.filter(({ id }) => parentIds.includes(id))
  const siblings = characters.filter(({ id, parentIds: otherParents }) =>
    id !== character.id && otherParents?.some((parent) => parentIds.includes(parent)))
  const children = characters.filter(({ parentIds }) => parentIds?.includes(character.id))
  const name = (entry: TimelineCharacter) => [entry.name, entry.surname].filter(Boolean).join(' ')
  function group(title: string, entries: TimelineCharacter[]) {
    return (
      <section className="family-generation">
        <h3>{title}</h3>
        {entries.length ? <ul>{entries.map((entry) => (
          <li key={entry.id}><a href={'#characters?character=' + encodeURIComponent(entry.id) + '&family=1'}>{name(entry)}</a></li>
        ))}</ul> : <p>Нет записей.</p>}
      </section>
    )
  }
  return (
    <CreationDialog onCancel={onClose}>
      <h2 id="creation-dialog-title">Родословная</h2>
      <div className="family-tree">
        {group('Родители', parents)}
        <p className="family-focus">{name(character)}</p>
        {group('Дети', children)}
      </div>
      {siblings.length > 0 && group('Братья и сёстры', siblings)}
      <button type="button" onClick={onClose}>Закрыть</button>
    </CreationDialog>
  )
}
