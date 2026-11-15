import { sameHouse } from '../domain/houseTree'
import { EntryLink, WikiText } from './WikiText'
import { CharacterEditor } from './CharacterEditor'
import { t } from '../i18n.ts'
import { AppliedAbilities } from './AbilityPicker'
import { SpeedValue } from './MovementFields'
import { AbilityDetails } from './AbilityScores'
import { FamilyTree } from './FamilyTree'
import { LoreLinks } from './LoreLinks'
import { appliedAbilityEffects, glossaryDescription, raceDetailsFor, surnameTooltip } from '../domain/lore'
import { EntryGallery, EntryStatusLabel, useStatusMatch } from './EntryMedia'
import { EditIcon } from './EditIcon'
import { TrashIcon } from './TrashIcon'
import { EventSideLink } from './EventSideLink'
import { useState } from 'react'
import { calendarDay, type CharacterDate, type Timeline, type TimelineCharacter } from '../domain/timeline'

const columns = [
  { key: 'name', title: 'Имя' },
  { key: 'surname', title: 'Фамилия' },
  { key: 'race', title: 'Раса' },
  { key: 'sex', title: 'Пол' },
  { key: 'level', title: 'Уровень' },
] as const

const characterCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

export function CharactersPage({ timeline, save, characterId, familyOpen }: {
  characterId?: string
  familyOpen?: boolean
  timeline: Timeline
  save: (characters: TimelineCharacter[]) => void
}) {
  const characters = timeline.characters ?? []
  const matchesStatus = useStatusMatch()
  const [draft, setDraft] = useState<TimelineCharacter | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TimelineCharacter | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: typeof columns[number]['key']; descending: boolean }>({
    key: 'name', descending: false,
  })
  const sortedCharacters = characters.filter(matchesStatus).sort((left, right) => {
    const a = left[sort.key] ?? ''
    const b = right[sort.key] ?? ''
    if (!a || !b) return Number(!a) - Number(!b)
    return characterCollator.compare(String(a), String(b)) * (sort.descending ? -1 : 1)
  })
  const selected = characters.find(({ id }) => id === characterId) ??
    (characterId === undefined ? characters.find(matchesStatus) : undefined)
  const original = draft === 'new' ? null : draft
  const months = timeline.calendars[0].months
  const busy = draft !== null || deleting !== null

  function editCharacter(character: TimelineCharacter | 'new') {
    setDraft(character)
  }

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
      setError(error instanceof Error ? error.message : t('Не удалось сохранить персонажей.'))
    }
  }

  return (
    <main className="section-page">
      <h1>{t("Персонажи")}</h1>
      <p>{timeline.name}</p>
      {characterId !== undefined && !characters.some(({ id }) => id === characterId) && <p>{t("Персонаж не найден.")}</p>}
      {draft !== null && (
        <CharacterEditor timeline={timeline} original={original} save={save} cancel={cancel} />
      )}
      {deleting && (
        <section aria-labelledby="delete-character-title">
          <h2 id="delete-character-title">{t("Удалить персонажа «")}{deleting.name}»?</h2>
          <p>{t("Связи этого персонажа с событиями будут удалены.")}</p>
          <button type="button" autoFocus onClick={cancel}>{t("Отмена")}</button>{' '}
          <button type="button" onClick={() => persist(characters.filter(({ id }) => id !== deleting.id))}>{t("Удалить")}</button>
        </section>
      )}
      {draft === null && error && <p role="alert">{error}</p>}
      {characters.length === 0 && <p>{t("В этом таймлайне пока нет персонажей.")}</p>}
      <div className="directory-layout">
        <ul className="event-list">
          {(selected ? [selected] : []).map((character) => {
            const fullName = [character.name, character.surname].filter(Boolean).join(' ')
            const raceDetails = raceDetailsFor(timeline.lore, character.race)
            const effects = appliedAbilityEffects(timeline.lore, character.abilityNames, character.abilities, raceDetails)
            const lifespan = character.birth && character.death ? formatLifespan(character.birth, character.death) : null
            const items = (timeline.items ?? []).filter(({ ownerId }) => ownerId === character.id)
            const events = (timeline.events ?? []).filter(({ characterIds }) => characterIds?.includes(character.id))
            return (
              <li key={character.id} className="directory-card">
                <div className="character-overview">
                  {character.portrait && (
                    <img className="character-portrait" src={character.portrait} alt={fullName} loading="lazy" />
                  )}
                  <div className="character-summary">
                    <div className="character-heading">
                      {character.color && <span className="atlas-color" style={{ backgroundColor: character.color }} aria-hidden="true" />}
                      <button className="event-action" type="button" disabled={busy} onClick={() => editCharacter(character)} aria-label={t("Редактировать")} title={t("Редактировать")}><EditIcon /></button>
                      <button className="event-action" type="button" disabled={busy} onClick={() => setDeleting(character)} aria-label={t("Удалить персонажа")} title={t("Удалить персонажа")}><TrashIcon /></button>
                      <button className="family-tree-button" type="button" onClick={() => { window.location.hash = 'characters?character=' + encodeURIComponent(character.id) + '&family=1' }}>{t("Родословная")}</button>
                    </div>
                    <h2 className="character-name">{character.name}{character.surname && (
                      <> <span title={surnameTooltip(timeline, character.surname)}>{character.surname}</span></>
                    )}</h2>
                    <dl className="character-facts">
                      {character.sex && <div><dt>{t("Пол")}</dt><dd>{t(character.sex)}</dd></div>}
                      {character.level !== undefined && <div><dt>{t('Уровень')}</dt><dd>{character.level}</dd></div>}
                      {character.characterClass && <div><dt>{t("Класс")}</dt><dd title={glossaryDescription(timeline.lore, 'classes', character.characterClass)}>{character.characterClass}</dd></div>}
                      {character.race && <div><dt>{t("Раса")}</dt><dd title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race}</dd></div>}
                      {character.dynasty && <div><dt>{t('Род')}</dt><dd title={glossaryDescription(timeline.lore, 'dynasties', character.dynasty)}>
                        {timeline.lore?.dynasties.some((name) => sameHouse(character.dynasty, name))
                          ? <a href={'#lore?section=dynasties&entry=' + encodeURIComponent(character.dynasty)}>{character.dynasty}</a>
                          : character.dynasty}
                      </dd></div>}
                      {(character.birth || character.death) && (
                        <div><dt>{t("Годы жизни")}</dt><dd>{character.birth?.year ?? '?'} — {character.death?.year ?? '…'}
                          {lifespan && ' (' + lifespan + ')'}
                        </dd></div>
                      )}
                    </dl>
                    {character.description && <p><WikiText text={character.description} /></p>}
                  </div>
                </div>
                {items.length > 0 && (
                  <section className="character-items">
                    <h3>{t('Предметы')}</h3>
                    <ul>
                      {items.map(({ id, title, image, type, rarity }) => (
                        <li key={id}>
                          <EntryLink href={'#lore?section=items&entry=' + encodeURIComponent(id)}>
                            {image && <img src={image} alt="" loading="lazy" />}
                            <span>
                              <strong>{title}</strong>
                              {(type || rarity) && <small>{[type, rarity && t(rarity)].filter(Boolean).join(' · ')}</small>}
                            </span>
                          </EntryLink>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <AppliedAbilities effects={effects} />
                {raceDetails?.speedFeet !== undefined && <p><strong>{t('Скорость')}</strong> · <SpeedValue movement={raceDetails} /></p>}
                <AbilityDetails scores={effects.scores} />
                {character.birth && (
                  <p>{t("Дата рождения · ")}{calendarDay(months, character.birth.dayOfYear)} · {character.birth.year}{t(" г. системы")}</p>
                )}
                {character.death && (
                  <p>{t("Дата смерти · ")}{calendarDay(months, character.death.dayOfYear)} · {character.death.year}{t(" г. системы")}</p>
                )}
                {(
                  <>
                  <EntryStatusLabel entry={character} />
                  <EntryGallery key={character.id} entry={character} />
                  <LoreLinks timeline={timeline} kind="characters" id={character.id} />
                  <h3>{t("Биография")}</h3>
                    <p><WikiText text={character.biography || t('Биография пока не добавлена.')} /></p>
                  </>
                )}
                {(
                  <>
                    {[
                      { heading: t('Организации'), route: 'organizations?organization=', links: (timeline.organizations ?? [])
                        .filter(({ memberIds }) => memberIds.includes(character.id)).map(({ id, name }) => ({ id, title: name })) },
                      { heading: t('Летописи'), route: 'chronicles?entry=', links: (timeline.chronicles ?? [])
                        .filter(({ characterIds }) => characterIds?.includes(character.id)) },
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
                {events.length === 0 && <p>{t("Участие в событиях пока не указано.")}</p>}
                {events.length > 0 && (
                  <>
                    <h3>{t("Участие в событиях")}</h3>
                    <ol>{events.sort((a, b) => a.year - b.year || (a.date?.first ?? 1) - (b.date?.first ?? 1)).map((event) => {
                      const side = event.sides?.find((item) => item.characterIds.includes(character.id))
                      return (
                      <li key={event.id}>
                        <a href={`#events?event=${encodeURIComponent(event.id)}`}>
                          {event.year}{event.end && ` — ${event.end.year}`} · {event.title}
                        </a>
                        {' · '}{side ? <EventSideLink side={side} organizations={timeline.organizations} /> : t('Без стороны')}
                      </li>
                      )
                    })}</ol>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <section className="directory-table" aria-labelledby="character-directory-title">
          <div className="directory-actions">
          {!deleting && <button type="button" onClick={() => editCharacter('new')}>{t("Добавить персонажа")}</button>}
          </div>
          <h2 id="character-directory-title">{t("Все персонажи")}</h2>
          <div className="directory-table-scroll">
            <table>
              <thead>
                <tr>{columns.map(({ key, title }) => (
                  <th key={key} scope="col" aria-sort={sort.key === key
                    ? sort.descending ? 'descending' : 'ascending'
                    : undefined}>
                    <button type="button" onClick={() => setSort({
                      key, descending: sort.key === key && !sort.descending,
                    })}>
                      {t(title)}{sort.key === key && <span aria-hidden="true">{sort.descending ? ' ↓' : ' ↑'}</span>}
                    </button>
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {sortedCharacters.map((character) => (
                  <tr key={character.id} data-selected={character.id === selected?.id}>
                    <td>
                      <a href={'#characters?character=' + encodeURIComponent(character.id)}
                        aria-current={character.id === selected?.id ? 'true' : undefined} onClick={cancel}>
                        {character.name}
                      </a>
                    </td>
                    <td><span title={surnameTooltip(timeline, character.surname)}>{character.surname || '—'}</span></td>
                    <td><span title={glossaryDescription(timeline.lore, 'races', character.race)}>{character.race || '—'}</span></td>
                    <td>{character.sex ? t(character.sex) : '—'}</td>
                    <td>{character.level ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {familyOpen && selected && <FamilyTree character={selected} characters={characters} onClose={() => {
        window.location.hash = 'characters?character=' + encodeURIComponent(selected.id)
      }} />}
    </main>
  )
}

function formatLifespan(birth: CharacterDate, death: CharacterDate) {
  const years = BigInt(death.year) - BigInt(birth.year) - (death.dayOfYear < birth.dayOfYear ? 1n : 0n)
  const last = years % 10n
  const lastTwo = years % 100n
  const unit = lastTwo >= 11n && lastTwo <= 14n ? t('лет') : last === 1n ? t('год') : last >= 2n && last <= 4n ? t('года') : t('лет')
  return years.toString() + ' ' + unit
}
