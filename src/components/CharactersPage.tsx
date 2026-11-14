import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { EventSideLink } from './EventSideLink'
import { useState, type FormEvent } from 'react'
import type { Timeline, TimelineCharacter } from '../domain/timeline'

export function CharactersPage({ timeline, save, characterId }: {
  characterId?: string
  timeline: Timeline
  save: (characters: TimelineCharacter[]) => void
}) {
  const characters = timeline.characters ?? []
  const [draft, setDraft] = useState<TimelineCharacter | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineCharacter | null>(null)
  const [error, setError] = useState('')
  const original = draft === 'new' ? null : draft
  const busy = draft !== null || deleting !== null

  function cancel() {
    setDraft(null)
    setDeleting(null)
    setError('')
  }

  function persist(next: TimelineCharacter[]) {
    try {
      save(next)
      cancel()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить персонажей.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get('name') ?? '').trim()
    if (!name) {
      setError('Введите имя персонажа.')
      return
    }

    const description = String(fields.get('description') ?? '').trim()
    const biography = String(fields.get('biography') ?? '').trim()
    const entry = { id: original?.id ?? crypto.randomUUID(), name, description, biography, color: String(fields.get('color')) }
    persist(original ? characters.map((item) => item.id === original.id ? entry : item) : [...characters, entry])
  }

  return (
    <main className="section-page">
      <h1>Персонажи</h1>
      <p>{timeline.name}</p>
      {characterId !== undefined && <p><a href="#characters">Все персонажи</a></p>}
      {characterId !== undefined && !characters.some(({ id }) => id === characterId) && <p>Персонаж не найден.</p>}
      {characterId === undefined && !busy && <button type="button" onClick={() => setDraft('new')}>Добавить персонажа</button>}
      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать персонажа' : 'Новый персонаж'}</h2>
          <p><label>Имя<br /><input name="name" defaultValue={original?.name} required /></label></p>
          <p><label>Описание<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
          <p><label>Биография<br /><textarea name="biography" rows={8} defaultValue={original?.biography} /></label></p>
          <p><label>Цвет персонажа <input name="color" type="color" defaultValue={original?.color ?? '#174b43'} /></label></p>
          <button type="submit">Сохранить</button>{' '}
          <button type="button" onClick={cancel}>Отмена</button>
        </form>
      )}
      {deleting && (
        <section aria-labelledby="delete-character-title">
          <h2 id="delete-character-title">Удалить персонажа «{deleting.name}»?</h2>
          <p>Связи этого персонажа с событиями будут удалены.</p>
          <button type="button" autoFocus onClick={cancel}>Отмена</button>{' '}
          <button type="button" onClick={() => persist(characters.filter(({ id }) => id !== deleting.id))}>
            Удалить
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {characters.length === 0 && <p>В этом таймлайне пока нет персонажей.</p>}
      <ul className="event-list">
        {characters.filter(({ id }) => characterId === undefined || id === characterId).map((character) => {
          const events = (timeline.events ?? []).filter(({ characterIds }) => characterIds?.includes(character.id))
          return (
            <li key={character.id}>
              <h2>{character.color && <span className="atlas-color" style={{ backgroundColor: character.color }} aria-hidden="true" />}{characterId === undefined
                ? <a href={`#characters?character=${encodeURIComponent(character.id)}`}>{character.name}</a>
                : character.name}</h2>
              {character.description && <p>{character.description}</p>}
              {characterId !== undefined && (
                <>
                  <h3>Биография</h3>
                  <p>{character.biography || 'Биография пока не добавлена.'}</p>
                </>
              )}
              {characterId !== undefined && (
                <>
                  {[
                    { heading: 'Организации', route: 'organizations?organization=', links: (timeline.organizations ?? [])
                      .filter(({ memberIds }) => memberIds.includes(character.id)).map(({ id, name }) => ({ id, title: name })) },
                    { heading: 'Летописи', route: 'chronicles?entry=', links: (timeline.chronicles ?? [])
                      .filter(({ characterIds }) => characterIds?.includes(character.id)) },
                    { heading: 'Предметы', route: 'items?entry=', links: (timeline.items ?? [])
                      .filter(({ ownerId }) => ownerId === character.id) },
                  ].filter(({ links }) => links.length > 0).map(({ heading, route, links }) => (
                    <section key={route}>
                      <h3>{heading}</h3>
                      <ul>{links.map(({ id, title }) => (
                        <li key={id}><a href={'#' + route + encodeURIComponent(id)}>{title}</a></li>
                      ))}</ul>
                    </section>
                  ))}
                </>
              )}
              {characterId !== undefined && events.length === 0 && <p>Участие в событиях пока не указано.</p>}
              {characterId !== undefined && events.length > 0 && (
                <>
                  <h3>Участие в событиях</h3>
                  <ol>{events.sort((a, b) => a.year - b.year || (a.date?.first ?? 1) - (b.date?.first ?? 1)).map((event) => {
                    const side = event.sides?.find((item) => item.characterIds.includes(character.id))
                    return (
                    <li key={event.id}>
                      <a href={`#events?event=${encodeURIComponent(event.id)}`}>
                        {event.year}{event.end && ` — ${event.end.year}`} · {event.title}
                      </a>
                      {' · '}{side ? <EventSideLink side={side} organizations={timeline.organizations} /> : 'Без стороны'}
                    </li>
                    )
                  })}</ol>
                </>
              )}
              <button type="button" disabled={busy} onClick={() => setDraft(character)} aria-label="Редактировать" title="Редактировать"><EditIcon /></button>{' '}
              <button type="button" disabled={busy} onClick={() => setDeleting(character)} aria-label="Удалить персонажа" title="Удалить персонажа"><TrashIcon /></button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
