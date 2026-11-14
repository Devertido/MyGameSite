import { useState } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar } from '../domain/timeline'

const daysPerPage = 31

export function TimelineDays({ timeline, calendar, initialYear, initialDay }: {
  timeline: Timeline
  calendar: TimelineCalendar
  initialYear: number
  initialDay: number
}) {
  const [year, setYear] = useState(initialYear)
  const [first, setFirst] = useState(Math.floor(initialDay / daysPerPage) * daysPerPage)
  let offset = 0
  const months = calendar.months.map((month) => {
    const start = offset
    offset += month.days
    return { ...month, start, end: offset }
  })
  const count = Math.min(daysPerPage, timeline.daysPerYear - first)
  const days = months.flatMap(({ name, start, end }, monthIndex) => {
    const begin = Math.max(first, start)
    const length = Math.max(0, Math.min(first + count, end) - begin)
    return Array.from({ length }, (_, index) => ({
      offset: begin + index, day: begin + index - start + 1, name, monthIndex,
    }))
  })

  return (
    <section className="timeline-day-detail" aria-label="Месяцы и дни на шкале">
      <div className="timeline-controls">
        <button type="button" disabled={year <= timeline.startYear}
          onClick={() => { setYear(year - 1); setFirst(0) }}>Предыдущий год</button>
        <span>Системный год {year} · местный {String(toCalendarYear(year, calendar.era))}</span>
        <button type="button" disabled={year >= timeline.endYear}
          onClick={() => { setYear(year + 1); setFirst(0) }}>Следующий год</button>
        <label>Месяц{' '}
          <select value={days[0]?.monthIndex ?? 0}
            onChange={(event) => setFirst(months[Number(event.currentTarget.value)]!.start)}>
            {months.map(({ name, start }, index) => <option key={start} value={index}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="timeline-scroll" tabIndex={0} role="region" aria-label="Деления календарных дней">
        <ol className="timeline-day-ticks">
          {days.map(({ offset, day, name }) => (
            <li key={offset}><span>{name}</span><strong>{day}</strong></li>
          ))}
        </ol>
      </div>
      {timeline.daysPerYear > daysPerPage && (
        <div className="timeline-controls">
          <button type="button" disabled={first === 0}
            onClick={() => setFirst(Math.max(0, first - daysPerPage))}>Предыдущие дни</button>
          <span>Дни года {first + 1}–{first + count}</span>
          <button type="button" disabled={first + count >= timeline.daysPerYear}
            onClick={() => setFirst(first + count)}>Следующие дни</button>
        </div>
      )}
    </section>
  )
}
