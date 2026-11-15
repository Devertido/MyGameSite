import { t } from '../i18n.ts'
import { abilities } from '../domain/abilities'
import { AbilityFields } from './AbilityScores'
import { useState } from 'react'
import { spellComponents, type RaceDetails, type SpellDetails } from '../domain/lore'
import { ImageField } from './ImageField'

const raceFields = [
  ['lifespan', 'Срок жизни'], ['height', 'Рост'], ['size', 'Размер'],
  ['bonuses', 'Бонусы'], ['debuffs', 'Дебафы'],
] as const

export function RaceFields({ race }: { race?: RaceDetails }) {
  return <>
    <ImageField name="lore-image" label={t("Изображение расы")} initial={race?.image} />
    {raceFields.map(([key, label]) => <p key={key}><label>{t(label)}<br />
      {key === 'bonuses' || key === 'debuffs'
        ? <textarea name={key} rows={3} defaultValue={race?.[key]} />
        : <input name={key} defaultValue={race?.[key]} />}
    </label></p>)}
    <AbilityFields label={t("Бонусы к характеристикам")} prefix="race-bonus-" scores={race?.abilityBonuses} />
    <AbilityFields label={t("Штрафы к характеристикам")} prefix="race-penalty-" scores={race?.abilityPenalties} />
  </>
}

export function SpellFields({ spell }: { spell?: SpellDetails }) {
  const [components, setComponents] = useState(spell?.components ?? [])
  return <>
    <ImageField name="lore-image" label={t("Изображение заклинания")} initial={spell?.image} />
    <p><label>{t("Цена в мане ")}<input name="mana" type="number" min={0} step={1} defaultValue={spell?.mana ?? ''} /></label></p>
    <fieldset>
      <legend>{t("Компоненты заклинания")}</legend>
      <div className="directory-actions">
        {spellComponents.map((component) => <button type="button" key={component} className="lore-toggle"
          aria-pressed={components.includes(component)} onClick={() => setComponents((current) =>
            current.includes(component) ? current.filter((item) => item !== component) : [...current, component])}>
          {t(component)}
        </button>)}
      </div>
      {components.map((component) => <input key={component} type="hidden" name="components" value={component} />)}
    </fieldset>
  </>
}

export function MagicDetails({ race, spell }: { race?: RaceDetails; spell?: SpellDetails }) {
  const image = race?.image || spell?.image
  return <>
    {image && <div className={race ? "item-image-frame race-image-frame" : "item-image-frame"}><img className="atlas-entry-image" src={image} alt="" /></div>}
    {spell?.mana != null && <p className="lore-mana">{t("Мана · ")}{spell.mana}</p>}
    {!!spell?.components.length && <p>{t("Компоненты · ")}{spell.components.map(t).join(' · ')}</p>}
    {race && raceFields.map(([key, label]) => {
      const adjustments = key === 'bonuses' ? race.abilityBonuses : key === 'debuffs' ? race.abilityPenalties : undefined
      const values = abilities.flatMap(([ability, name]) => {
        const score = adjustments?.[ability]
        return score ? [t(name) + ' ' + (key === 'bonuses' ? '+' : '−') + score] : []
      })
      return (race[key] || values.length > 0) && (
        <section key={key} className={'lore-' + key}>
          <h3>{t(label)}</h3>
          {race[key] && <p className="archive-copy">{race[key]}</p>}
          {values.length > 0 && <p>{values.join(' · ')}</p>}
        </section>
      )
    })}
  </>
}
