export const itemTypes = ['Оружие', 'Прочее', 'Еда', 'Одежда', 'Доспех', 'Щит', 'Инструмент'] as const

export const itemMaterials = ['Медь', 'Бронза', 'Железо', 'Дерево', 'Кожа', 'Ткань'] as const
export type ItemMaterial = typeof itemMaterials[number]

type Roll = (strength?: number, random?: () => number) => number

export function parseDamageFormula(formula: string): Roll | undefined {
  if (!formula.trim() || formula.length > 120) return
  const tokens = formula.match(/\d+[dD]\d+|\d+(?:[.,]\d+)?|[А-Яа-яЁёA-Za-z]+|[^\s]/gu) ?? []
  let cursor = 0

  function atom(): Roll {
    const token = tokens[cursor++]
    if (token === '+' || token === '-') {
      const operand = atom()
      return (strength, random) => (token === '-' ? -1 : 1) * operand(strength, random)
    }
    if (token === '(') {
      const inner = expression()
      if (tokens[cursor++] !== ')') throw new Error()
      return inner
    }
    if (token && /^(сил(?:а)?|str)$/iu.test(token)) return (strength) => strength ?? NaN
    const dice = token?.match(/^(\d+)d(\d+)$/i)
    if (dice) {
      const count = Number(dice[1])
      const faces = Number(dice[2])
      if (count < 1 || count > 100 || faces < 2 || faces > 1000) throw new Error()
      return (_, random) => {
        if (!random) return count * (faces + 1) / 2
        let total = 0
        for (let i = 0; i < count; i++) total += 1 + Math.floor(random() * faces)
        return total
      }
    }
    if (token && /^\d+(?:[.,]\d+)?$/.test(token)) {
      const number = Number(token.replace(',', '.'))
      return () => number
    }
    throw new Error()
  }

  function term(): Roll {
    let left = atom()
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const op = tokens[cursor++]
      const first = left
      const second = atom()
      left = (strength, random) => {
        const a = first(strength, random)
        const b = second(strength, random)
        return op === '*' ? a * b : b === 0 ? NaN : a / b
      }
    }
    return left
  }

  function expression(): Roll {
    let left = term()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const op = tokens[cursor++]
      const first = left
      const second = term()
      left = (strength, random) => op === '+'
        ? first(strength, random) + second(strength, random)
        : first(strength, random) - second(strength, random)
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

export function averageDamage(formula: string, strength?: number): number | undefined {
  const result = parseDamageFormula(formula)?.(strength)
  return result !== undefined && Number.isFinite(result) ? Math.max(0, Math.floor(result)) : undefined
}

export function damageUsesStrength(formula: string) {
  return /(?:сил(?:а)?|str)/iu.test(formula)
}
