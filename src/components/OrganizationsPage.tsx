import { EditIcon } from './EditIcon'
import { ImageField } from './ImageField'
import { useState, type FormEvent } from 'react'
import { validateOrganization, type Organization, type Timeline } from '../domain/timeline'

const types = ['Государство', 'Банда', 'Орден', 'Клан', 'Гильдия', 'Союз', 'Фракция']

export function OrganizationsPage({ timeline, save, organizationId }: {
  timeline: Timeline
  organizationId?: string
  save: (organizations: Organization[]) => void
}) {
  const organizations = timeline.organizations ?? []
  const [draft, setDraft] = useState<Organization | 'new' | null>(null)
  const [error, setError] = useState('')
  const original = draft === 'new' ? null : draft

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const end = String(fields.get('endYear') ?? '')
    const organization = {
      id: original?.id ?? crypto.randomUUID(),
      name: String(fields.get('name') ?? '').trim(),
      type: String(fields.get('type') ?? '').trim(),
      startYear: Number(fields.get('startYear')),
      ...(end ? { endYear: Number(end) } : {}),
      emblem: String(fields.get('emblem') ?? '') || undefined,
      memberIds: fields.getAll('members').map(String),
    }
    const issue = validateOrganization(organization, timeline)
    if (issue) {
      setError(issue)
      return
    }

    try {
      save(original ? organizations.map((item) => item.id === original.id ? organization : item)
        : [...organizations, organization])
      setDraft(null)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить организацию.')
    }
  }

  return (
    <main className="section-page">
      <h1>Фракции и организации</h1>
      <p>{timeline.name}</p>
      {organizationId !== undefined && <p><a href="#organizations">Все организации</a></p>}
      {organizationId !== undefined && !organizations.some(({ id }) => id === organizationId) && <p>Организация не найдена.</p>}
      {organizationId === undefined && draft === null && <button type="button" onClick={() => setDraft('new')}>Создать организацию</button>}
      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать организацию' : 'Новая организация'}</h2>
          <ImageField name="emblem" label="Эмблема" initial={original?.emblem} />
          <p><label>Название <input name="name" defaultValue={original?.name} required /></label></p>
          <p>
            <label>Тип организации <input name="type" list="organization-types" defaultValue={original?.type} required /></label>
            <datalist id="organization-types">{types.map((type) => <option key={type} value={type} />)}</datalist>
          </p>
          <p><label>Системный год основания <input name="startYear" type="number" step="1" defaultValue={original?.startYear} required /></label></p>
          <p><label>Системный год окончания <input name="endYear" type="number" step="1" defaultValue={original?.endYear} /></label></p>
          <p>Оставьте год окончания пустым, если организация существует или дата её окончания неизвестна.</p>
          <fieldset>
            <legend>Члены организации</legend>
            {timeline.characters?.length ? timeline.characters.map(({ id, name }) => (
              <label className="event-participant" key={id}>
                <input type="checkbox" name="members" value={id} defaultChecked={original?.memberIds.includes(id)} /> {name}
              </label>
            )) : <p>Добавьте персонажей во вкладке «Персонажи».</p>}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <button type="submit">Сохранить</button>{' '}
          <button type="button" onClick={() => { setDraft(null); setError('') }}>Отмена</button>
        </form>
      )}
      {organizations.length === 0 && draft === null && <p>В этом таймлайне пока нет организаций.</p>}
      <ul className="event-list">
        {organizations.filter(({ id }) => organizationId === undefined || id === organizationId).map((organization) => (
          <li key={organization.id}>
            {organization.emblem && <img className="atlas-entry-image organization-emblem" src={organization.emblem} alt={'Эмблема · ' + organization.name} />}
            <h2>{organizationId === undefined
              ? <a href={`#organizations?organization=${encodeURIComponent(organization.id)}`}>{organization.name}</a>
              : organization.name}</h2>
            <p>{organization.type} · {organization.startYear} — {organization.endYear ?? 'год окончания не указан'}</p>
            {organization.memberIds.length > 0 && (
              <ul>
                {timeline.characters?.filter(({ id }) => organization.memberIds.includes(id)).map(({ id, name }) => (
                  <li key={id}><a href={`#characters?character=${encodeURIComponent(id)}`}>{name}</a></li>
                ))}
              </ul>
            )}
            {organizationId !== undefined && (
              <section>
                <h3>Участие в событиях</h3>
                <ul>{(timeline.events ?? []).filter((event) =>
                  event.sides?.some((side) => side.organizationId === organization.id)
                ).sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                  <li key={id}><a href={'#events?event=' + encodeURIComponent(id)}>{year} · {title}</a></li>
                ))}</ul>
              </section>
            )}
            <button type="button" disabled={draft !== null} onClick={() => setDraft(organization)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>
          </li>
        ))}
      </ul>
    </main>
  )
}
