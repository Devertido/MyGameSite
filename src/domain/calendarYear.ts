import { t } from '../i18n.ts'
export type CalendarEra = {
  systemAnchorYear: number
  calendarAnchorYear: number
  hasYearZero: boolean
}

export function validateCalendarEra(era: CalendarEra): string | null {
  if (!Number.isSafeInteger(era.systemAnchorYear) || !Number.isSafeInteger(era.calendarAnchorYear)) {
    return t('Годы точки отсчёта должны быть целыми числами от −9 007 199 254 740 991 до 9 007 199 254 740 991.')
  }

  if (!era.hasYearZero && era.calendarAnchorYear === 0) {
    return t('В этом календаре нет года 0. Укажите другой местный год.')
  }

  return null
}

export function toCalendarYear(systemYear: number, era: CalendarEra): bigint {
  if (!Number.isSafeInteger(systemYear)) {
    throw new RangeError(t('Системный год должен быть безопасным целым числом.'))
  }

  const error = validateCalendarEra(era)
  if (error) {
    throw new RangeError(error)
  }

  const offset = BigInt(systemYear) - BigInt(era.systemAnchorYear)
  const anchor = BigInt(era.calendarAnchorYear)

  if (era.hasYearZero) {
    return anchor + offset
  }

  // В непрерывной шкале местному году 1 соответствует порядковый номер 0.
  const anchorIndex = anchor > 0n ? anchor - 1n : anchor
  const yearIndex = anchorIndex + offset

  return yearIndex >= 0n ? yearIndex + 1n : yearIndex
}
