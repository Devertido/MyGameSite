import { t } from '../i18n.ts'
import { useId, useState } from 'react'
type Candidate = { id: string; name: string; surname?: string }

function fullName({ name, surname }: Candidate) {
  return [name, surname].filter(Boolean).join(' ')
}

export function RelativePicker({ name, label, candidates, initialIds, optionsLabel = 'Выбрать персонажей',
  searchLabel = 'Поиск по имени или фамилии', emptyLabel = 'Нет доступных персонажей.', lockedId }: {
  name: string
  label: string
  candidates: Candidate[]
  optionsLabel?: string
  searchLabel?: string
  emptyLabel?: string
  lockedId?: string
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
              {candidate.id !== lockedId && <button className="form-icon-button form-icon-remove" type="button" aria-label={t('Убрать из списка «') + label + '» — ' + fullName(candidate)}
                onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== candidate.id))}>×</button>}
            </li>
          ))}
        </ul>
      )}
      <details onToggle={(event) => {
        if (event.currentTarget.open) event.currentTarget.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
        else setQuery('')
      }}>
        <summary>{t(optionsLabel)}</summary>
        <label htmlFor={searchId}>{t(searchLabel)}</label>
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
        ) : <p>{normalizedQuery ? t('Совпадений нет.') : t(emptyLabel)}</p>}
      </details>
    </fieldset>
  )
}
