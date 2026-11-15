import type { appliedAbilityEffects } from '../domain/lore'
import { AbilityBonuses, AbilityDetails } from './AbilityScores'
import { ItemDamage } from './ItemDamage'
import { useState } from 'react'
import { t } from '../i18n.ts'

export function AbilitySelection({ options, selected, onChange }: {
  options: string[]
  selected: string[]
  onChange: (names: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const available = options.filter((name) => !selected.includes(name))
  return <fieldset className="relative-picker">
    <legend>{t('Способности')}</legend>
    <button type="button" className="form-icon-button form-icon-add" aria-label={t('Добавить способность')}
      aria-expanded={open} title={t('Добавить способность')} onClick={() => setOpen(!open)}>+</button>
    {open && <label>{t('Добавить способность')} <select value="" disabled={!available.length} onChange={(event) => {
      if (!event.currentTarget.value) return
      onChange([...selected, event.currentTarget.value])
      setOpen(false)
    }}>
      <option value="">{t('Выберите способность')}</option>
      {available.map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>}
    {open && !available.length && <p>{t('Нет доступных способностей.')}</p>}
    {selected.length > 0 && <ul className="relative-picker-selected">{selected.map((name) =>
      <li key={name}>{name}{' '}<button type="button" className="form-icon-button form-icon-remove"
        aria-label={t('Убрать способность') + ' · ' + name}
        onClick={() => onChange(selected.filter((entry) => entry !== name))}>×</button></li>)}</ul>}
  </fieldset>
}

export function AbilityPicker({ initial, options }: { initial?: string[]; options: string[] }) {
  const [selected, setSelected] = useState(initial ?? [])
  return <>
    <AbilitySelection options={options} selected={selected} onChange={setSelected} />
    {selected.map((name) => <input key={name} type="hidden" name="ability-names" value={name} />)}
  </>
}

export function AppliedAbilities({ effects, showStats = false }: {
  effects: ReturnType<typeof appliedAbilityEffects>
  showStats?: boolean
}) {
  if (!effects.powers.length) return null
  return <section>
    <h3>{t('Способности')}</h3>
    {!!effects.armorBonus && <p>{t('Бонус к защите')} · +{effects.armorBonus}</p>}
    {showStats && effects.hasStatBonuses && <AbilityDetails scores={effects.scores} />}
    <ul>{effects.powers.map((power) => <li key={power.name}>
      <a href={'#lore?section=abilities&entry=' + encodeURIComponent(power.name)}>{power.name}</a>
      <AbilityBonuses scores={power.statBonuses} />
      {power.damageFormula && <ItemDamage formula={power.damageFormula} ownerStrength={effects.scores.strength} />}
    </li>)}</ul>
  </section>
}

export function AbilityLinks({ names, heading = true }: { names?: string[]; heading?: boolean }) {
  if (!names?.length) return null
  return <div>
    {heading && <h3>{t('Способности')}</h3>}
    <ul>{names.map((name) => <li key={name}>
      <a href={'#lore?section=abilities&entry=' + encodeURIComponent(name)}>{name}</a>
    </li>)}</ul>
  </div>
}
