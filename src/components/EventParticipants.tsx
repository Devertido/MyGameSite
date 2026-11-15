import { displayOrganizationType } from '../domain/timeline.ts'
import { t } from '../i18n.ts'
import { useState } from 'react'
import { TrashIcon } from './TrashIcon'
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

  const [picker, setPicker] = useState<string | null>(null)

  function assign(characterId: string, sideId: string) {
    setAssignments((current) => new Map(current).set(characterId, sideId))
  }

  function participantControls(sideId: string, label: string) {
    const assigned = characters.filter(({ id }) => assignments.get(id) === sideId)
    const available = characters.filter(({ id }) => {
      const current = assignments.get(id)
      return !current || (sideId !== 'unassigned' && current === 'unassigned')
    })
    return (
      <>
        <button type="button" disabled={available.length === 0} aria-expanded={picker === sideId}
          aria-label={`${t("Добавить участника · ")}${label}`}
          onClick={() => setPicker((current) => current === sideId ? null : sideId)}>{t("Добавить участника")}</button>
        {picker === sideId && available.length > 0 && (
          <select aria-label={`${t("Выбрать участника · ")}${label}`} value="" autoFocus onChange={(event) => {
            assign(event.currentTarget.value, sideId)
            setPicker(null)
          }}>
            <option value="" disabled>{t("Выберите персонажа")}</option>
            {available.map((character) => (
              <option key={character.id} value={character.id}>{fullName(character)}</option>
            ))}
          </select>
        )}
        {assigned.length > 0 && (
          <ul className="event-side-members">
            {assigned.map((character) => {
              const name = fullName(character)
              return (
                <li key={character.id}>
                  {name}
                  {sideId !== 'unassigned' && (
                    <button type="button" className="event-action" onClick={() => assign(character.id, 'unassigned')}
                      aria-label={`${t("Убрать со стороны · ")}${name}`} title={t("Убрать со стороны")}>{t("Убрать со стороны")}</button>
                  )}
                  <button type="button" className="event-action" onClick={() => assign(character.id, '')}
                    aria-label={`${t("Удалить из события · ")}${name}`} title={t("Удалить из события")}><TrashIcon /></button>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  function removeSide(id: string) {
    if (picker === id) setPicker(null)
    setSides((current) => current.filter((side) => side.id !== id))
    setAssignments((current) => new Map(
      [...current].map(([characterId, sideId]) => [characterId, sideId === id ? 'unassigned' : sideId]),
    ))
  }

  return (
    <fieldset>
      <legend>{t("Стороны и участники")}</legend>
      {sides.map((side, index) => (
        <div className="event-side-row" key={side.id}>
          <input type="hidden" name="sideId" value={side.id} />
          {organizations.length > 0 && (
            <label>{t("Организация стороны ")}{index + 1}{' '}
              <select name={'side-organization-' + side.id} value={side.organizationId ?? ''}
                onChange={(event) => {
                  const organization = organizations.find(({ id }) => id === event.currentTarget.value)
                  setSides((current) => current.map((item) => item.id === side.id
                    ? { ...item, organizationId: organization?.id, name: organization?.name ?? item.name }
                    : item))
                }}>
                <option value="">{t("Своя сторона")}</option>
                {organizations.map(({ id, name, type }) => <option key={id} value={id}>{name} · {displayOrganizationType(type)}</option>)}
              </select>
            </label>
          )}{' '}
          <label>{t("Название стороны ")}{index + 1}{' '}
            <input name={'side-name-' + side.id} value={organizations.find(({ id }) => id === side.organizationId)?.name ?? side.name} readOnly={Boolean(side.organizationId)} required onChange={(event) => {
              const name = event.currentTarget.value
              setSides((current) => current.map((item) => item.id === side.id ? { ...item, name } : item))
            }} />
          </label>{' '}
          <button type="button" className="event-action" onClick={() => removeSide(side.id)}
            aria-label={`${t("Убрать сторону ")}${index + 1}`} title={`${t("Убрать сторону ")}${index + 1}`}><TrashIcon /></button>
          {participantControls(side.id, side.name.trim() || `${t("Сторона ")}${index + 1}`)}
        </div>
      ))}
      <button type="button" onClick={() => setSides((current) => [
        ...current, { id: crypto.randomUUID(), name: '', characterIds: [] },
      ])}>{t("Добавить сторону")}</button>
      {characters.length === 0 && <p>{t("Создайте персонажей во вкладке «Персонажи», чтобы добавить их в событие.")}</p>}
      {characters.length > 0 && (
        <div className="event-side-row">
          <span>{t("Участники без стороны")}</span>
          {participantControls('unassigned', t('без стороны'))}
        </div>
      )}
      {characters.map(({ id }) => (
        <input key={id} type="hidden" name={'participant-' + id} value={assignments.get(id) ?? ''} />
      ))}
    </fieldset>
  )
}

function fullName(character: TimelineCharacter) {
  return [character.name, character.surname].filter(Boolean).join(' ')
}
