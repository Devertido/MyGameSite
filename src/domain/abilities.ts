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
      Number.isInteger(score) && score >= 1 && score <= 30)
}

export function readAbilityScores(fields: FormData): AbilityScores {
  const scores: AbilityScores = {}
  for (const [key] of abilities) {
    const value = fields.get('ability-' + key)
    if (typeof value === 'string' && value !== '') scores[key] = Number(value)
  }
  return scores
}
