import { WikiText } from './WikiText'
import type { ReactNode } from 'react'
import { t } from '../i18n.ts'
import { SpeedValue } from './MovementFields'
import { AppliedAbilities } from './AbilityPicker'
import { appliedAbilityEffects, beastCombatFields, type Beast, type WorldLore } from '../domain/lore'
import { AbilityDetails } from './AbilityScores'

const summaryFields = beastCombatFields.filter(([key]) => key !== 'traits' && key !== 'actions')
const narrativeFields = beastCombatFields.filter(([key]) => key === 'traits' || key === 'actions')

export function BestiaryCard({ beast, controls, lore }: { beast: Beast; controls: ReactNode; lore: WorldLore }) {
  const effects = appliedAbilityEffects(lore, beast.abilityNames, beast.abilities)
  const armor = beast.combat?.armor
  const baseArmor = armor?.match(/^\s*(\d+)(.*)$/u)
  const armorWithBonus = effects.armorBonus && baseArmor
    ? String(Number(baseArmor[1]) + effects.armorBonus) + baseArmor[2] : armor
  const stats = summaryFields.filter(([key]) => beast.combat?.[key] || (key === 'speed' && beast.speedFeet !== undefined))
  const showStatBlock = stats.length > 0 || Object.keys(effects.scores).length > 0 || effects.powers.length > 0 ||
    Boolean(beast.combat?.traits || beast.combat?.actions)
  return (
    <article className="bestiary-page">
      <div className="bestiary-intro" data-illustrated={Boolean(beast.image)}>
        {beast.image && <img className="bestiary-art" src={beast.image} alt={beast.name} />}
        <div className="bestiary-lore">
          <h2>{beast.name}</h2>
          {beast.type && <p className="bestiary-type">{beast.type}</p>}
          {beast.description && <p className="archive-copy"><WikiText text={beast.description} /></p>}
        </div>
      </div>
      {showStatBlock && (
        <section className="bestiary-stat-block" aria-label={t('Боевые характеристики')}>
          <div>
            <h3 className="bestiary-stat-name">{beast.name}</h3>
            {beast.type && <p className="bestiary-type">{beast.type}</p>}
            {stats.length > 0 && <dl className="bestiary-stat-summary">
              {stats.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{key === 'armor' ? armorWithBonus : key === 'speed'
                ? <SpeedValue movement={beast} legacySpeed={beast.combat?.speed} /> : beast.combat?.[key]}</dd></div>)}
            </dl>}
            <AbilityDetails scores={effects.scores} />
            <AppliedAbilities effects={effects} />
          </div>
          {(beast.combat?.traits || beast.combat?.actions) && (
            <div className="bestiary-actions">
              {beast.combat.traits && <section><h3>{t('Особенности')}</h3><p className="archive-copy"><WikiText text={beast.combat.traits} /></p></section>}
              {beast.combat.actions && <section><h3>{t('Действия')}</h3><p className="archive-copy"><WikiText text={beast.combat.actions} /></p></section>}
            </div>
          )}
        </section>
      )}
      <div className="bestiary-controls">{controls}</div>
    </article>
  )
}

export function BeastCombatFields({ combat }: { combat?: Beast['combat'] }) {
  return <fieldset className="bestiary-combat-fields">
    <legend>{t('Боевые характеристики')}</legend>
    <div className="bestiary-combat-summary">
      {summaryFields.filter(([key]) => key !== 'speed').map(([key, label]) => (
        <label key={key}>{t(label)}<input name={'beast-' + key} defaultValue={combat?.[key]} /></label>
      ))}
    </div>
    {narrativeFields.map(([key, label]) => (
      <p key={key}><label>{t(label)}<br /><textarea name={'beast-' + key} rows={4} defaultValue={combat?.[key]} /></label></p>
    ))}
  </fieldset>
}
