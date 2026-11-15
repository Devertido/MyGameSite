import { t } from '../i18n.ts'
import { useState } from 'react'
import { abilities, adjustedAbilities, type AbilityScores } from '../domain/abilities'
import type { RaceDetails } from '../domain/lore'

export function AbilityFields({ scores, race, prefix = 'ability-', label = t('Характеристики D&D') }: {
  scores?: AbilityScores
  race?: RaceDetails
  prefix?: string
  label?: string
}) {
  const [base, setBase] = useState(scores ?? {})
  const totals = adjustedAbilities(base, race?.abilityBonuses, race?.abilityPenalties)
  const hasAdjustments = abilities.some(([key]) => race?.abilityBonuses?.[key] || race?.abilityPenalties?.[key])
  return (
    <fieldset>
      <legend>{label}</legend>
      {hasAdjustments && <p>{t("Введите базовые значения. Для пустого поля с расовой поправкой берётся 10.")}</p>}
      <div className="ability-grid">
        {abilities.map(([key, name]) => {
          const bonus = race?.abilityBonuses?.[key] ?? 0
          const penalty = race?.abilityPenalties?.[key] ?? 0
          return <div key={key}>
            <label>{t(name)}<input name={prefix + key} type="number" min={0} max={30}
              defaultValue={scores?.[key]} placeholder={bonus || penalty ? "10" : undefined} onChange={(event) => {
                const value = event.currentTarget.valueAsNumber
                setBase((current) => ({ ...current, [key]: Number.isNaN(value) ? undefined : value }))
              }} /></label>
            {(bonus > 0 || penalty > 0) && <output>{t("Итого ")}{totals[key]} ({[bonus && '+' + bonus, penalty && '−' + penalty].filter(Boolean).join(' ')})</output>}
          </div>
        })}
      </div>
    </fieldset>
  )
}

export function AbilityBonuses({ scores }: { scores?: AbilityScores }) {
  const bonuses = abilities.flatMap(([key, label]) => scores?.[key] ? [t(label) + ' +' + scores[key]] : [])
  if (!bonuses.length) return null
  return <p>{t('Бонусы к характеристикам')} · {bonuses.join(' · ')}</p>
}

export function AbilityDetails({ scores }: { scores?: AbilityScores }) {
  if (!scores || !Object.keys(scores).length) return null
  return (
    <section>
      <h3>{t("Характеристики D&D")}</h3>
      <dl className="ability-grid">
        {abilities.map(([key, label]) => {
          const score = scores[key]
          if (score === undefined) return null
          const modifier = Math.floor((score - 10) / 2)
          return <div key={key}><dt>{t(label)}</dt><dd>{score} ({modifier >= 0 ? '+' : ''}{modifier})</dd></div>
        })}
      </dl>
    </section>
  )
}
