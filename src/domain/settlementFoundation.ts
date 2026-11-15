export const settlementSizes = ['village', 'town', 'city'] as const
export const waterTypes = ['inland', 'river', 'coast'] as const

export type SettlementSize = typeof settlementSizes[number]
export type WaterType = typeof waterTypes[number]
export type SettlementSettings = { seed: number; size: SettlementSize; water: WaterType }

const scales: Record<SettlementSize, number> = { village: 0.68, town: 1, city: 1.18 }
export const maxSettlementSeed = 0xffffffff

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

export function settlementFoundation({ seed, size, water }: SettlementSettings) {
  const random = seededRandom(seed)
  const phase = random() * Math.PI * 2
  const waterCenter = 535 + random() * 25
  const waterline = (y: number) => waterCenter + 30 * Math.sin(y / 89 + phase) + 12 * Math.cos(y / 57)
  const centerX = 260 + random() * (water === 'inland' ? 205 : 55)
  const centerY = 200 + random() * 100
  return { centerX, centerY, waterline, scale: scales[size], water }
}
