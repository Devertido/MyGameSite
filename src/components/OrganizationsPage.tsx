import { t } from '../i18n.ts'
import { LoreLinks } from './LoreLinks'
import { EntryFields, EntryGallery, EntryStatusLabel, readEntryMetadata, useStatusMatch } from './EntryMedia'
import { CreationDialog } from './CreationDialog'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { ImageField } from './ImageField'
import { useState, type FormEvent } from 'react'
import { displayOrganizationType, organizationTypes as types, defaultOrganizationColor, validateOrganization, type Organization, type Timeline } from '../domain/timeline'


export function OrganizationsPage({ timeline, save, organizationId }: {
  timeline: Timeline
  organizationId?: string
  save: (organizations: Organization[]) => void
}) {
  const organizations = timeline.organizations ?? []
  const matchesStatus = useStatusMatch()
  const selected = organizationId === undefined ? organizations.find(matchesStatus) : organizations.find(({ id }) => id === organizationId)
  const [draft, setDraft] = useState<Organization | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Organization | null>(null)
  const [error, setError] = useState('')
  const original = draft === 'new' ? null : draft

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const end = String(fields.get('endYear') ?? '')
    const type = String(fields.get('type') ?? '').trim()
    const organization = {
      ...readEntryMetadata(fields),
      id: original?.id ?? crypto.randomUUID(),
      name: String(fields.get('name') ?? '').trim(),
      type: types.find((preset) => t(preset) === type) ?? type,
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
      setError(error instanceof Error ? error.message : t('Не удалось сохранить организацию.'))
    }
  }

  return (
    <main className="section-page">
      <h1>{t("Фракции и организации")}</h1>
      <p>{timeline.name}</p>
      {organizationId !== undefined && !selected && <p>{t("Организация не найдена.")}</p>}
      {draft !== null && (
        <CreationDialog onCancel={() => { setDraft(null); setError('') }}>
          <form onSubmit={submit} onInput={() => setError('')}>
            <h2 id="creation-dialog-title">{original ? t('Редактировать организацию') : t('Новая организация')}</h2>
            <ImageField name="emblem" label={t("Эмблема")} initial={original?.emblem} />
            <p><label>{t("Название ")}<input name="name" defaultValue={original?.name} required /></label></p>
            <p>
              <label>{t("Тип организации ")}<input name="type" list="organization-types" defaultValue={original ? displayOrganizationType(original.type) : undefined} required /></label>
              <datalist id="organization-types">{types.map((type) => <option key={type} value={t(type)} />)}</datalist>
            </p>
            <p><label>{t("Описание")}<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
            <p><label>{t("Системный год основания ")}<input name="startYear" type="number" step="1" defaultValue={original?.startYear} required /></label></p>
            <p><label>{t("Системный год окончания ")}<input name="endYear" type="number" step="1" defaultValue={original?.endYear} /></label></p>
            <p>{t("Оставьте год окончания пустым, если организация существует или дата её окончания неизвестна.")}</p>
            <p><label>{t("Цвет фракции на таймлайне ")}<input type="color" name="color"
              defaultValue={original?.color ?? defaultOrganizationColor} /></label></p>
            <p><label><input type="checkbox" name="onTimeline" defaultChecked={original?.onTimeline} />{t(" Показать годы существования под таймлайном")}</label></p>
            <fieldset>
              <legend>{t("Локации фракции")}</legend>
              {timeline.locations?.length ? timeline.locations.map(({ id, title }) => (
                <label className="event-participant" key={id}>
                  <input type="checkbox" name="locations" value={id} defaultChecked={original?.locationIds?.includes(id)} /> {title}
                </label>
              )) : <p>{t("Добавьте записи во вкладке «Локации».")}</p>}
            </fieldset>
            <fieldset>
              <legend>{t("Члены организации")}</legend>
              {timeline.characters?.length ? timeline.characters.map(({ id, name }) => (
                <label className="event-participant" key={id}>
                  <input type="checkbox" name="members" value={id} defaultChecked={original?.memberIds.includes(id)} /> {name}
                </label>
              )) : <p>{t("Добавьте персонажей во вкладке «Персонажи».")}</p>}
            </fieldset>
            <EntryFields entry={original} />
            {error && <p role="alert">{error}</p>}
            <button type="submit">{t("Сохранить")}</button>{' '}
            <button type="button" onClick={() => { setDraft(null); setError('') }}>{t("Отмена")}</button>
          </form>
        </CreationDialog>
      )}
      {organizations.length === 0 && draft === null && <p>{t("В этом таймлайне пока нет организаций.")}</p>}
      <div className="directory-layout">
        <section aria-label={t("Выбранная организация")}>
          {selected && (
            <article className="directory-card">
              {selected.emblem && <img className="atlas-entry-image organization-emblem" src={selected.emblem} alt={t('Эмблема · ') + selected.name} />}
              <h2><span className="atlas-color" style={{ backgroundColor: selected.color ?? defaultOrganizationColor }} aria-hidden="true" />{selected.name}</h2>
              <p>{displayOrganizationType(selected.type)} · {selected.startYear} — {selected.endYear ?? t('год окончания не указан')}</p>
              {selected.description && <p>{selected.description}</p>}
              <EntryStatusLabel entry={selected} />
              <EntryGallery key={selected.id} entry={selected} />
              <LoreLinks timeline={timeline} kind="organizations" id={selected.id} />
              {!!selected.locationIds?.length && (
                <section>
                  <h3>{t("Локации фракции")}</h3>
                  <ul>{timeline.locations?.filter(({ id }) => selected.locationIds?.includes(id)).map(({ id, title }) => (
                    <li key={id}><a href={'#lore?section=locations&entry=' + encodeURIComponent(id)}>{title}</a></li>
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
                  <h3>{t("Участие в событиях")}</h3>
                  <ul>{(timeline.events ?? []).filter((event) =>
                    event.sides?.some((side) => side.organizationId === selected.id)
                  ).sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                    <li key={id}><a href={'#events?event=' + encodeURIComponent(id)}>{year} · {title}</a></li>
                  ))}</ul>
                </section>
              )}
              <button type="button" disabled={draft !== null} onClick={() => setDraft(selected)} aria-label={t("Редактировать")} title={t("Редактировать")}><EditIcon /></button>{' '}
              <button type="button" disabled={draft !== null} aria-label={t("Удалить организацию")} title={t("Удалить организацию")}
                onClick={() => { setError(''); setDeleting(selected) }}><TrashIcon /></button>
            </article>
          )}
        </section>
        <section className="directory-table" aria-labelledby="organization-directory-title">
          <div className="directory-actions">
          {!deleting && <button type="button" onClick={() => setDraft('new')}>{t("Создать организацию")}</button>}
          </div>
          <h2 id="organization-directory-title">{t("Все организации")}</h2>
          <div className="directory-table-scroll">
            <table>
              <thead>
                <tr><th scope="col">{t("Название")}</th><th scope="col">{t("Тип")}</th><th scope="col">{t("Годы существования")}</th></tr>
              </thead>
              <tbody>
                {organizations.filter(matchesStatus).map(({ id, name, type, startYear, endYear, color }) => (
                  <tr key={id} data-selected={id === selected?.id}>
                    <td>
                      <span className="atlas-color" style={{ backgroundColor: color ?? defaultOrganizationColor }} aria-hidden="true" />
                      <a href={'#organizations?organization=' + encodeURIComponent(id)}
                        aria-current={id === selected?.id ? 'true' : undefined}>{name}</a>
                    </td>
                    <td>{displayOrganizationType(type)}</td>
                    <td>{startYear} — {endYear ?? '…'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {deleting && (
        <dialog open className="card-delete-dialog" aria-labelledby="card-delete-title">
          <h2 id="card-delete-title">{t("Удалить организацию «")}{deleting.name}»?</h2>
          <p>{t("Запись будет удалена из текущего таймлайна.")}</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" autoFocus onClick={() => { setDeleting(null); setError('') }}>{t("Отмена")}</button>{' '}
          <button type="button" onClick={() => {
            try {
              save(organizations.filter(({ id }) => id !== deleting.id))
              setDeleting(null)
              window.location.hash = 'organizations'
            } catch (error) {
              setError(error instanceof Error ? error.message : t('Не удалось удалить запись.'))
            }
          }}>{t("Удалить")}</button>
        </dialog>
      )}
    </main>
  )
}
