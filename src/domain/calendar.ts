import { t } from '../i18n.ts'
export type CalendarMonth = {
  name: string
  days: number
}

export function validateMonths(
  months: readonly CalendarMonth[],
  daysPerYear: number,
): string | null {
  if (!Number.isSafeInteger(daysPerYear) || daysPerYear < 1) {
    return t('Продолжительность года должна быть положительным целым числом.')
  }

  if (months.length === 0) {
    return t('Добавьте хотя бы один месяц.')
  }

  let remainingDays = daysPerYear

  for (const [index, month] of months.entries()) {
    const monthNumber = index + 1

    if (month.name.trim() === '') {
      return `${t("Введите название месяца ")}${monthNumber}.`
    }

    if (!Number.isSafeInteger(month.days) || month.days < 1) {
      return `${t("Введите положительное целое число дней для месяца ")}${monthNumber}.`
    }

    // Остаток позволяет проверить сумму без накопления слишком больших чисел.
    remainingDays -= month.days

    if (remainingDays < 0) {
      return t('Сумма дней в месяцах превышает продолжительность года.')
    }
  }

  if (remainingDays > 0) {
    return `${t("До продолжительности года не хватает дней: ")}${remainingDays}.`
  }

  return null
}

export function validateWeek(
  weekdayNames: readonly string[],
  firstWeekday: number,
  epochWeekday: number,
): string | null {
  if (weekdayNames.length === 0) {
    return t('Добавьте хотя бы один день недели.')
  }

  const emptyDay = weekdayNames.findIndex((name) => name.trim() === '')
  if (emptyDay !== -1) {
    return `${t("Введите название дня недели ")}${emptyDay + 1}.`
  }

  if (!Number.isInteger(firstWeekday) || firstWeekday < 0 || firstWeekday >= weekdayNames.length) {
    return t('Выберите первый день недели.')
  }

  if (!Number.isInteger(epochWeekday) || epochWeekday < 0 || epochWeekday >= weekdayNames.length) {
    return t('Выберите день недели для первого дня системного года 0.')
  }

  return null
}

export const standardYear = {
  daysPerYear: 365,
  months: [
    { name: 'Январь', days: 31 },
    { name: 'Февраль', days: 28 },
    { name: 'Март', days: 31 },
    { name: 'Апрель', days: 30 },
    { name: 'Май', days: 31 },
    { name: 'Июнь', days: 30 },
    { name: 'Июль', days: 31 },
    { name: 'Август', days: 31 },
    { name: 'Сентябрь', days: 30 },
    { name: 'Октябрь', days: 31 },
    { name: 'Ноябрь', days: 30 },
    { name: 'Декабрь', days: 31 },
  ],
  weekdayNames: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
  firstWeekday: 0,
  epochWeekday: 0,
}

export function displayCalendarName(name: string): string {
  return name === 'Основной календарь' ? t(name) : name
}

export function displayMonthName(name: string): string {
  return standardYear.months.some((month) => month.name === name) ? t(name) : name
}

export function displayWeekdayName(name: string): string {
  return standardYear.weekdayNames.some((weekday) => weekday === name) ? t(name) : name
}
