import { useId, useState } from 'react'
import type { TimelineCharacter } from '../domain/timeline'

function fullName({ name, surname }: TimelineCharacter) {
  return [name, surname].filter(Boolean).join(' ')
}

export function RelativePicker({ name, label, candidates, initialIds }: {
  name: string
  label: string
  candidates: TimelineCharacter[]
  initialIds: string[]
}) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(initialIds)
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const matches = candidates.filter((candidate) =>
    !selectedIds.includes(candidate.id) && fullName(candidate).toLocaleLowerCase('ru').includes(normalizedQuery),
  )

  return (
    <fieldset className="relative-picker">
      <legend>{label}</legend>
      {selectedIds.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      {selectedIds.length > 0 && (
        <ul className="relative-picker-selected">
          {candidates.filter(({ id }) => selectedIds.includes(id)).map((candidate) => (
            <li key={candidate.id}>
              {fullName(candidate)}{' '}
              <button type="button" aria-label={'Убрать из списка «' + label + '» — ' + fullName(candidate)}
                onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== candidate.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <details onToggle={(event) => {
        if (event.currentTarget.open) event.currentTarget.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
        else setQuery('')
      }}>
        <summary>Выбрать персонажей</summary>
        <label htmlFor={searchId}>Поиск по имени или фамилии</label>
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
        {matches.length > 0 ? (
          <ul className="relative-picker-options">
            {matches.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onClick={() => {
                  setSelectedIds((ids) => [...ids, candidate.id])
                  setQuery('')
                  document.getElementById(searchId)?.focus()
                }}>{fullName(candidate)}</button>
              </li>
            ))}
          </ul>
        ) : <p>{normalizedQuery ? 'Совпадений нет.' : 'Нет доступных персонажей.'}</p>}
      </details>
    </fieldset>
  )
}
