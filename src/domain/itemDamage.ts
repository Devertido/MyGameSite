export const itemTypes = ['Оружие', 'Прочее', 'Еда', 'Одежда', 'Доспех', 'Щит', 'Инструмент'] as const

export const itemMaterials = ['Медь', 'Бронза', 'Железо', 'Дерево', 'Кожа', 'Ткань'] as const
export type ItemMaterial = typeof itemMaterials[number]

type DamageRange = readonly [min: number, max: number]
type EvaluateDamage = (strength?: number) => DamageRange
const invalidRange: DamageRange = [NaN, NaN]

export function parseDamageFormula(formula: string): EvaluateDamage | undefined {
  if (!formula.trim() || formula.length > 120) return
  const tokens = formula.match(/\d+[dD]\d+|\d+(?:[.,]\d+)?|[А-Яа-яЁёA-Za-z]+|[^\s]/gu) ?? []
  let cursor = 0

  function atom(): EvaluateDamage {
    const token = tokens[cursor++]
    if (token === '+' || token === '-') {
      const operand = atom()
      if (token === '+') return operand
      return (strength) => {
        const [min, max] = operand(strength)
        return [-max, -min]
      }
    }
    if (token === '(') {
      const inner = expression()
      if (tokens[cursor++] !== ')') throw new Error()
      return inner
    }
    if (token && /^(сил(?:а)?|str)$/iu.test(token)) return (strength) => strength === undefined ? invalidRange : [strength, strength]
    const dice = token?.match(/^(\d+)d(\d+)$/i)
    if (dice) {
      const count = Number(dice[1])
      const faces = Number(dice[2])
      if (count < 1 || count > 100 || faces < 2 || faces > 1000) throw new Error()
      return () => [count, count * faces]
    }
    if (token && /^\d+(?:[.,]\d+)?$/.test(token)) {
      const number = Number(token.replace(',', '.'))
      return () => [number, number]
    }
    throw new Error()
  }

  function term(): EvaluateDamage {
    let left = atom()
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const op = tokens[cursor++]
      const first = left
      const second = atom()
      left = (strength) => {
        const [a, b] = first(strength)
        const [c, d] = second(strength)
        if (op === '/' && c <= 0 && d >= 0) return invalidRange
        const bounds = op === '*' ? [a * c, a * d, b * c, b * d] : [a / c, a / d, b / c, b / d]
        return [Math.min(...bounds), Math.max(...bounds)]
      }
    }
    return left
  }

  function expression(): EvaluateDamage {
    let left = term()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const op = tokens[cursor++]
      const first = left
      const second = term()
      left = (strength) => {
        const [a, b] = first(strength)
        const [c, d] = second(strength)
        return op === '+' ? [a + c, b + d] : [a - d, b - c]
      }
    }
    return left
  }

  try {
    const roll = expression()
    return cursor === tokens.length ? roll : undefined
  } catch {
    return undefined
  }
}

export function damageRange(formula: string, strength?: number): DamageRange | undefined {
  const range = parseDamageFormula(formula)?.(strength)
  if (!range || !range.every(Number.isFinite)) return
  const [min, max] = range
  return [Math.max(0, Math.floor(min)), Math.max(0, Math.floor(max))]
}

export function damageUsesStrength(formula: string) {
  return /(?:сил(?:а)?|str)/iu.test(formula)
}
