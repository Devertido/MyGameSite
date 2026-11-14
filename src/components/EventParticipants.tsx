import { useState } from 'react'
import type { Organization, TimelineCharacter, TimelineEvent } from '../domain/timeline'

export function EventParticipants({ characters, organizations, original }: {
  characters: TimelineCharacter[]
  organizations: Organization[]
  original: TimelineEvent | null
}) {
  const [sides, setSides] = useState(original?.sides ?? [])
  const [assignments, setAssignments] = useState(() => new Map(
    (original?.characterIds ?? []).map((id) => [
      id, original?.sides?.find((side) => side.characterIds.includes(id))?.id ?? 'unassigned',
    ]),
  ))

  function removeSide(id: string) {
    setSides((current) => current.filter((side) => side.id !== id))
    setAssignments((current) => new Map(
      [...current].map(([characterId, sideId]) => [characterId, sideId === id ? 'unassigned' : sideId]),
    ))
  }

  return (
    <fieldset>
      <legend>Стороны и участники</legend>
      {sides.map((side, index) => (
        <p key={side.id}>
          <input type="hidden" name="sideId" value={side.id} />
          {organizations.length > 0 && (
            <label>Организация стороны {index + 1}{' '}
              <select name={'side-organization-' + side.id} value={side.organizationId ?? ''}
                onChange={(event) => {
                  const organization = organizations.find(({ id }) => id === event.currentTarget.value)
                  setSides((current) => current.map((item) => item.id === side.id
                    ? { ...item, organizationId: organization?.id, name: organization?.name ?? item.name }
                    : item))
                }}>
                <option value="">Своя сторона</option>
                {organizations.map(({ id, name, type }) => <option key={id} value={id}>{name} · {type}</option>)}
              </select>
            </label>
          )}{' '}
          <label>Название стороны {index + 1}{' '}
            <input name={'side-name-' + side.id} value={organizations.find(({ id }) => id === side.organizationId)?.name ?? side.name} readOnly={Boolean(side.organizationId)} required onChange={(event) => {
              const name = event.currentTarget.value
              setSides((current) => current.map((item) => item.id === side.id ? { ...item, name } : item))
            }} />
          </label>{' '}
          <button type="button" onClick={() => removeSide(side.id)}>Убрать сторону {index + 1}</button>
        </p>
      ))}
      <button type="button" onClick={() => setSides((current) => [
        ...current, { id: crypto.randomUUID(), name: '', characterIds: [] },
      ])}>Добавить сторону</button>
      {characters.length === 0 && <p>Создайте персонажей во вкладке «Персонажи», чтобы добавить их в событие.</p>}
      {characters.map((character) => (
        <p key={character.id}>
          <label>{character.name}{' '}
            <select name={'participant-' + character.id} value={assignments.get(character.id) ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value
                setAssignments((current) => new Map(current).set(character.id, value))
              }}>
              <option value="">Не участвует</option>
              <option value="unassigned">Участвует без стороны</option>
              {sides.map((side, index) => <option key={side.id} value={side.id}>{organizations.find(({ id }) => id === side.organizationId)?.name || side.name.trim() || 'Сторона ' + (index + 1)}</option>)}
            </select>
          </label>
        </p>
      ))}
    </fieldset>
  )
}
