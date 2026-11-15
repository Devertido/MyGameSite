import { abilities, type AbilityScores } from '../domain/abilities'

export function AbilityFields({ scores }: { scores?: AbilityScores }) {
  return (
    <fieldset>
      <legend>Характеристики D&D</legend>
      <div className="ability-grid">
        {abilities.map(([key, label]) => (
          <label key={key}>{label}<input name={'ability-' + key} type="number" min={1} max={30}
            defaultValue={scores?.[key]} /></label>
        ))}
      </div>
    </fieldset>
  )
}

export function AbilityDetails({ scores }: { scores?: AbilityScores }) {
  if (!scores || !Object.keys(scores).length) return null
  return (
    <section>
      <h3>Характеристики D&D</h3>
      <dl className="ability-grid">
        {abilities.map(([key, label]) => {
          const score = scores[key]
          if (score === undefined) return null
          const modifier = Math.floor((score - 10) / 2)
          return <div key={key}><dt>{label}</dt><dd>{score} ({modifier >= 0 ? '+' : ''}{modifier})</dd></div>
        })}
      </dl>
    </section>
  )
}
