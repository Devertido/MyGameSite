export const abilities = [
  ['strength', 'Сила'], ['dexterity', 'Ловкость'], ['constitution', 'Телосложение'],
  ['intelligence', 'Интеллект'], ['wisdom', 'Мудрость'], ['charisma', 'Харизма'],
] as const

type Ability = typeof abilities[number][0]
export type AbilityScores = Partial<Record<Ability, number>>

export function validAbilityScores(value: unknown): value is AbilityScores {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.entries(value).every(([key, score]) =>
      abilities.some(([ability]) => ability === key) &&
      Number.isInteger(score) && score >= 0 && score <= 30)
}

export function readAbilityScores(fields: FormData, prefix = 'ability-'): AbilityScores {
  const scores: AbilityScores = {}
  for (const [key] of abilities) {
    const value = fields.get(prefix + key)
    if (typeof value === 'string' && value !== '') scores[key] = Number(value)
  }
  return scores
}

export function adjustedAbilities(base?: AbilityScores, bonuses?: AbilityScores, penalties?: AbilityScores): AbilityScores {
  const scores: AbilityScores = {}
  for (const [key] of abilities) {
    const bonus = bonuses?.[key] ?? 0
    const penalty = penalties?.[key] ?? 0
    const value = base?.[key] ?? (bonus || penalty ? 10 : undefined)
    if (value !== undefined) scores[key] = Math.min(30, Math.max(0, value + bonus - penalty))
  }
  return scores
}
