import { AbilityLinks, AbilitySelection } from './AbilityPicker'
import { useState } from 'react'
import { t } from '../i18n.ts'
import { maxClassLevel, type ClassLevel } from '../domain/lore'

const levelNumbers = Array.from({ length: maxClassLevel }, (_, index) => index + 1)

export function ClassProgressionFields({ initial, spells, abilities }: { initial?: ClassLevel[]; spells: string[]; abilities: string[] }) {
  const [level, setLevel] = useState(1)
  const [levels, setLevels] = useState<ClassLevel[]>(initial ?? [])
  const current = levels.find((entry) => entry.level === level) ?? { level, skills: '', abilities: '', spells: [] }
  const available = spells.filter((name) => !current.spells.includes(name))

  function edit(changes: Partial<Omit<ClassLevel, 'level'>>) {
    setLevels(levels.filter((entry) => entry.level !== level).concat({ ...current, ...changes }))
  }

  return <fieldset className="class-progression">
    <legend>{t('Развитие класса')}</legend>
    <input type="hidden" name="class-levels" value={JSON.stringify(levels.filter(
      (entry) => entry.skills.trim() || entry.abilities.trim() || entry.spells.length || entry.abilityNames?.length,
    ).map((entry) => ({ ...entry, skills: entry.skills.trim(), abilities: entry.abilities.trim() })).sort((a, b) => a.level - b.level))} />
    <label>{t('Уровень')} <select value={level} onChange={(event) => setLevel(Number(event.currentTarget.value))}>
      {levelNumbers.map((number) => <option key={number} value={number}>{number}</option>)}
    </select></label>
    <label>{t('Навыки')}<textarea rows={3} maxLength={4000} value={current.skills}
      onChange={(event) => edit({ skills: event.currentTarget.value })} /></label>
    <label>{t('Способности')}<textarea rows={3} maxLength={4000} value={current.abilities}
      onChange={(event) => edit({ abilities: event.currentTarget.value })} /></label>
    <AbilitySelection options={abilities} selected={current.abilityNames ?? []} onChange={(abilityNames) => edit({ abilityNames })} />
    <label>{t('Добавить заклинание')} <select value="" disabled={!available.length} onChange={(event) => {
      if (event.currentTarget.value) edit({ spells: [...current.spells, event.currentTarget.value] })
    }}>
      <option value="">{t('Выберите заклинание')}</option>
      {available.map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>
    {current.spells.length > 0 && <ul className="relative-picker-selected">{current.spells.map((name) =>
      <li key={name}>{name}{' '}<button type="button" className="form-icon-button form-icon-remove"
        aria-label={t('Удалить заклинание с уровня') + ' · ' + name}
        onClick={() => edit({ spells: current.spells.filter((spell) => spell !== name) })}>×</button></li>)}</ul>}
  </fieldset>
}

export function ClassProgressionDetails({ levels }: { levels: ClassLevel[] }) {
  if (!levels.length) return null
  return <section>
    <h3>{t('Развитие класса')}</h3>
    <div className="directory-table-scroll"><table className="class-progression-table">
      <thead><tr>
        {['Уровень', 'Навыки', 'Способности', 'Заклинания'].map((label) => <th key={label} scope="col">{t(label)}</th>)}
      </tr></thead>
      <tbody>{levels.map(({ level, skills, abilities, spells, abilityNames }) => <tr key={level}>
        <th scope="row">{level}</th><td>{skills || '—'}</td><td>{abilities || (!abilityNames?.length && '—')}<AbilityLinks names={abilityNames} heading={false} /></td><td>{spells.join(', ') || '—'}</td>
      </tr>)}</tbody>
    </table></div>
  </section>
}
