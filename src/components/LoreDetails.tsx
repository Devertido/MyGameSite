import { WikiText } from './WikiText'
import { t } from '../i18n.ts'
import { abilities } from '../domain/abilities'
import { AbilityFields } from './AbilityScores'
import { useState } from 'react'
import { parseRaceMeasure, spellComponents, spellTimeUnits, type SpellDuration, type RaceMeasure, type RaceDetails, type SpellDetails } from '../domain/lore'
import { ImageField } from './ImageField'

const raceMeasures = [
  ['lifespan', 'Срок жизни', 'лет'],
  ['height', 'Рост', 'см'],
] as const

const raceFields = [
  ['size', 'Размер'],
  ['bonuses', 'Бонусы'], ['debuffs', 'Дебафы'],
] as const

export function RaceFields({ race }: { race?: RaceDetails }) {
  return <>
    <ImageField name="lore-image" label={t("Изображение расы")} initial={race?.image} largeIllustration />
    {raceMeasures.map(([key, label, unit]) => {
      const previous = race?.[key] ?? ''
      const values = parseRaceMeasure(previous, key)
      return <fieldset key={key} className="race-measure">
        <legend>{t(label)} ({t(unit)})</legend>
        <label>{t('Значение или начало диапазона')} <input name={key} type="number" min={0} step={1}
          defaultValue={values?.[0]} /></label>
        <label>{t('Конец диапазона')} <input name={key + '-max'} type="number" min={0} step={1}
          defaultValue={values?.[1]} /></label>
        {values === null && <p>{previous}</p>}
      </fieldset>
    })}
    {raceFields.map(([key, label]) => <p key={key}><label>{t(label)}<br />
      {key === 'bonuses' || key === 'debuffs'
        ? <textarea name={key} rows={3} defaultValue={race?.[key]} />
        : <input name={key} defaultValue={race?.[key]} />}
    </label></p>)}
    <AbilityFields label={t("Бонусы к характеристикам")} prefix="race-bonus-" scores={race?.abilityBonuses} />
    <AbilityFields label={t("Штрафы к характеристикам")} prefix="race-penalty-" scores={race?.abilityPenalties} />
  </>
}

function SpellTimeFields({ name, label, duration }: { name: string; label: string; duration?: SpellDuration }) {
  return <fieldset className="spell-duration-fields">
    <legend>{t(label)}</legend>
    <label>{t('Число')} <input name={name} type="number" min={0} step="any" defaultValue={duration?.amount} /></label>
    <label>{t('Единица измерения')} <select name={name + '-unit'} defaultValue={duration?.unit ?? 'second'}>
      {spellTimeUnits.map(([unit, title]) => <option key={unit} value={unit}>{t(title)}</option>)}
    </select></label>
  </fieldset>
}

export function SpellFields({ spell, ability = false }: { spell?: SpellDetails; ability?: boolean }) {
  const [components, setComponents] = useState(spell?.components ?? [])
  return <>
    <ImageField name="lore-image" label={t(ability ? 'Изображение способности' : 'Изображение заклинания')} initial={spell?.image} />
    <p><label>{t('Школа магии')} <input name="spell-school" maxLength={120} defaultValue={spell?.school} /></label></p>
    <p><label>{t('Формула урона')} (1d8 + СИЛ + 5) <input name="spell-damage" maxLength={120} defaultValue={spell?.damageFormula} /></label></p>
    {ability && <>
      <p><label>{t('Бонус к защите')} <input type="number" name="power-armor-bonus" min={0} step={1} defaultValue={spell?.armorBonus} /></label></p>
      <AbilityFields label={t('Бонусы к характеристикам')} prefix="power-stat-" scores={spell?.statBonuses} />
    </>}
    <SpellTimeFields name="spell-casting" label="Время произнесения" duration={spell?.castingTime} />
    <SpellTimeFields name="spell-cooldown" label="Время восстановления" duration={spell?.cooldown} />
    <p><label className="spell-mana-field">{t("Цена в мане ")}<input name="mana" type="number" min={0} step={1} defaultValue={spell?.mana ?? ''} /></label></p>
    {ability && <p><label className="ability-stamina-field">{t('Цена в выносливости')}{' '}
      <input name="stamina" type="number" min={0} step={1} defaultValue={spell?.stamina} />
    </label></p>}
    <fieldset>
      <legend>{t(ability ? 'Компоненты способности' : 'Компоненты заклинания')}</legend>
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

function formatRaceMeasure(value: string, measure: RaceMeasure, unit: string) {
  const values = parseRaceMeasure(value, measure)
  return values?.length ? values.join('–') + ' ' + t(unit) : value
}

export function MagicDetails({ race }: { race?: RaceDetails }) {
  return <>
    {race?.image && <div className="item-image-frame race-image-frame"><img className="atlas-entry-image" src={race.image} alt="" /></div>}
    {race && raceMeasures.map(([key, label, unit]) => race[key] && (
      <section key={key} className={'lore-' + key}>
        <h3>{t(label)}</h3>
        <p>{formatRaceMeasure(race[key], key, unit)}</p>
      </section>
    ))}
    {race && raceFields.map(([key, label]) => {
      const adjustments = key === 'bonuses' ? race.abilityBonuses : key === 'debuffs' ? race.abilityPenalties : undefined
      const values = abilities.flatMap(([ability, name]) => {
        const score = adjustments?.[ability]
        return score ? [t(name) + ' ' + (key === 'bonuses' ? '+' : '−') + score] : []
      })
      return (race[key] || values.length > 0) && (
        <section key={key} className={'lore-' + key}>
          <h3>{t(label)}</h3>
          {race[key] && <p className="archive-copy"><WikiText text={race[key]} /></p>}
          {values.length > 0 && <p>{values.join(' · ')}</p>}
        </section>
      )
    })}
  </>
}
