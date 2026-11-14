import { useState, type FormEvent } from 'react'
import type { Timeline, TimelineCharacter } from '../domain/timeline'

export function CharactersPage({ timeline, save }: {
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
    const entry = { id: original?.id ?? crypto.randomUUID(), name, description }
    persist(original ? characters.map((item) => item.id === original.id ? entry : item) : [...characters, entry])
  }

  return (
    <main className="section-page">
      <h1>Персонажи</h1>
      <p>{timeline.name}</p>
      {!busy && <button type="button" onClick={() => setDraft('new')}>Добавить персонажа</button>}
      {draft !== null && (
        <form onSubmit={submit} onInput={() => setError('')}>
          <h2>{original ? 'Редактировать персонажа' : 'Новый персонаж'}</h2>
          <p><label>Имя<br /><input name="name" defaultValue={original?.name} required /></label></p>
          <p><label>Описание<br /><textarea name="description" rows={4} defaultValue={original?.description} /></label></p>
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
        {characters.map((character) => {
          const events = (timeline.events ?? []).filter(({ characterIds }) => characterIds?.includes(character.id))
          return (
            <li key={character.id}>
              <h2>{character.name}</h2>
              {character.description && <p>{character.description}</p>}
              {events.length > 0 && (
                <>
                  <h3>Участие в событиях</h3>
                  <ul>{events.map((event) => (
                    <li key={event.id}><a href={`#events?year=${event.year}`}>{event.year} · {event.title}</a></li>
                  ))}</ul>
                </>
              )}
              <button type="button" disabled={busy} onClick={() => setDraft(character)}>Редактировать</button>{' '}
              <button type="button" disabled={busy} onClick={() => setDeleting(character)}>Удалить персонажа</button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
