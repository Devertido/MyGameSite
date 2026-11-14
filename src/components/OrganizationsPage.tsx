import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { ImageField } from './ImageField'
import { useState, type FormEvent } from 'react'
import { defaultOrganizationColor, validateOrganization, type Organization, type Timeline } from '../domain/timeline'

const types = ['Государство', 'Банда', 'Орден', 'Клан', 'Гильдия', 'Союз', 'Фракция']

export function OrganizationsPage({ timeline, save, organizationId }: {
  timeline: Timeline
  organizationId?: string
  save: (organizations: Organization[]) => void
}) {
  const organizations = timeline.organizations ?? []
  const selected = organizationId === undefined ? organizations[0] : organizations.find(({ id }) => id === organizationId)
  const [draft, setDraft] = useState<Organization | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Organization | null>(null)
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
      ...(fields.get('emblem') ? { emblem: String(fields.get('emblem')) } : {}),
      description: String(fields.get('description') ?? '').trim(),
      locationIds: fields.getAll('locations').map(String),
      onTimeline: fields.has('onTimeline'),
      color: String(fields.get('color') ?? defaultOrganizationColor),
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
      {organizationId !== undefined && !selected && <p>Организация не найдена.</p>}
      {draft === null && !deleting && <button type="button" onClick={() => setDraft('new')}>Создать организацию</button>}
      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать организацию' : 'Новая организация'}</h2>
          <ImageField name="emblem" label="Эмблема" initial={original?.emblem} />
          <p><label>Название <input name="name" defaultValue={original?.name} required /></label></p>
          <p>
            <label>Тип организации <input name="type" list="organization-types" defaultValue={original?.type} required /></label>
            <datalist id="organization-types">{types.map((type) => <option key={type} value={type} />)}</datalist>
          </p>
          <p><label>Описание<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
          <p><label>Системный год основания <input name="startYear" type="number" step="1" defaultValue={original?.startYear} required /></label></p>
          <p><label>Системный год окончания <input name="endYear" type="number" step="1" defaultValue={original?.endYear} /></label></p>
          <p>Оставьте год окончания пустым, если организация существует или дата её окончания неизвестна.</p>
          <p><label>Цвет фракции на таймлайне <input type="color" name="color"
            defaultValue={original?.color ?? defaultOrganizationColor} /></label></p>
          <p><label><input type="checkbox" name="onTimeline" defaultChecked={original?.onTimeline} /> Показать годы существования под таймлайном</label></p>
          <fieldset>
            <legend>Локации фракции</legend>
            {timeline.locations?.length ? timeline.locations.map(({ id, title }) => (
              <label className="event-participant" key={id}>
                <input type="checkbox" name="locations" value={id} defaultChecked={original?.locationIds?.includes(id)} /> {title}
              </label>
            )) : <p>Добавьте записи во вкладке «Локации».</p>}
          </fieldset>
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
      <div className="directory-layout">
        <section aria-label="Выбранная организация">
          {selected && (
            <article>
              {selected.emblem && <img className="atlas-entry-image organization-emblem" src={selected.emblem} alt={'Эмблема · ' + selected.name} />}
              <h2><span className="atlas-color" style={{ backgroundColor: selected.color ?? defaultOrganizationColor }} aria-hidden="true" />{selected.name}</h2>
              <p>{selected.type} · {selected.startYear} — {selected.endYear ?? 'год окончания не указан'}</p>
              {selected.description && <p>{selected.description}</p>}
              {!!selected.locationIds?.length && (
                <section>
                  <h3>Локации фракции</h3>
                  <ul>{timeline.locations?.filter(({ id }) => selected.locationIds?.includes(id)).map(({ id, title }) => (
                    <li key={id}><a href={'#locations?entry=' + encodeURIComponent(id)}>{title}</a></li>
                  ))}</ul>
                </section>
              )}
              {selected.memberIds.length > 0 && (
                <ul>
                  {timeline.characters?.filter(({ id }) => selected.memberIds.includes(id)).map(({ id, name }) => (
                    <li key={id}><a href={`#characters?character=${encodeURIComponent(id)}`}>{name}</a></li>
                  ))}
                </ul>
              )}
              {timeline.events?.some(({ sides }) => sides?.some((side) => side.organizationId === selected.id)) && (
                <section>
                  <h3>Участие в событиях</h3>
                  <ul>{(timeline.events ?? []).filter((event) =>
                    event.sides?.some((side) => side.organizationId === selected.id)
                  ).sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                    <li key={id}><a href={'#events?event=' + encodeURIComponent(id)}>{year} · {title}</a></li>
                  ))}</ul>
                </section>
              )}
              <button type="button" disabled={draft !== null} onClick={() => setDraft(selected)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>{' '}
              <button type="button" disabled={draft !== null} aria-label="Удалить организацию" title="Удалить организацию"
                onClick={() => { setError(''); setDeleting(selected) }}><TrashIcon /></button>
            </article>
          )}
        </section>
        {organizations.length > 0 && (
          <section className="directory-table" aria-labelledby="organization-directory-title">
            <h2 id="organization-directory-title">Все организации</h2>
            <div className="directory-table-scroll">
              <table>
                <thead>
                  <tr><th scope="col">Название</th><th scope="col">Тип</th><th scope="col">Годы существования</th></tr>
                </thead>
                <tbody>
                  {organizations.map(({ id, name, type, startYear, endYear, color }) => (
                    <tr key={id} data-selected={id === selected?.id}>
                      <td>
                        <span className="atlas-color" style={{ backgroundColor: color ?? defaultOrganizationColor }} aria-hidden="true" />
                        <a href={'#organizations?organization=' + encodeURIComponent(id)}
                          aria-current={id === selected?.id ? 'true' : undefined}>{name}</a>
                      </td>
                      <td>{type}</td>
                      <td>{startYear} — {endYear ?? '…'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {deleting && (
        <dialog open className="card-delete-dialog" aria-labelledby="card-delete-title">
          <h2 id="card-delete-title">Удалить организацию «{deleting.name}»?</h2>
          <p>Запись будет удалена из текущего таймлайна.</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>Отмена</button>{' '}
          <button type="button" onClick={() => {
            try {
              save(organizations.filter(({ id }) => id !== deleting.id))
              setDeleting(null)
              window.location.hash = 'organizations'
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Не удалось удалить запись.')
            }
          }}>Удалить</button>
        </dialog>
      )}
    </main>
  )
}
