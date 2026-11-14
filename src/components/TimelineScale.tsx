import { useState } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar } from '../domain/timeline'

const zoomLevels = [1, 2, 4, 8]
const baseIntervals = 4

export function TimelineScale({ timeline, calendar }: { timeline: Timeline; calendar: TimelineCalendar }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = zoomLevels[zoomIndex]!
  const start = BigInt(timeline.startYear)
  const span = BigInt(timeline.endYear) - start
  const maxIntervals = baseIntervals * zoom
  const intervals = span < BigInt(maxIntervals) ? Number(span) : maxIntervals

  // Число отметок ограничено масштабом даже для очень длинного таймлайна.
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => {
    if (intervals === 0) return { year: start, position: 50 }

    const offset = (span * BigInt(index)) / BigInt(intervals)
    const position = Number((offset * 1_000_000n) / span) / 10_000
    return { year: start + offset, position }
  })

  return (
    <section className="timeline-view" aria-labelledby="timeline-title">
      <h1 id="timeline-title">{timeline.name}</h1>
      <p>
        Системные годы: {timeline.startYear} — {timeline.endYear}<br />
        Местные годы: {String(toCalendarYear(timeline.startYear, calendar.era))}
        {' — '}{String(toCalendarYear(timeline.endYear, calendar.era))}
      </p>

      <div className="timeline-controls" role="group" aria-label="Масштаб шкалы">
        <button type="button" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
          Уменьшить
        </button>
        <output aria-live="polite">{zoom}×</output>
        <button
          type="button"
          disabled={zoomIndex === zoomLevels.length - 1}
          onClick={() => setZoomIndex(zoomIndex + 1)}
        >
          Увеличить
        </button>
      </div>

      <div className="timeline-scroll" tabIndex={0} role="region" aria-label="Шкала системных лет">
        <div className="timeline-track" style={{ width: `${100 * zoom}%`, minWidth: `${36 * zoom}rem` }}>
          <ol className="timeline-axis">
            {ticks.map(({ year, position }) => (
              <li key={String(year)} style={{ left: `${position}%` }}>{String(year)}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
