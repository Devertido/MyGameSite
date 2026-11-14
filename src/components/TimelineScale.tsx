import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar } from '../domain/timeline'

const zoomLevels = [1, 2, 4, 8, 16, 32]
const baseIntervals = 4

export function TimelineScale({ timeline, calendar }: { timeline: Timeline; calendar: TimelineCalendar }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const axisRef = useRef<HTMLOListElement>(null)
  const [target, setTarget] = useState<{ year: number } | null>(null)
  const zoom = zoomLevels[zoomIndex]!
  const start = BigInt(timeline.startYear)
  const span = BigInt(timeline.endYear) - start
  function positionOf(year: bigint) {
    return span === 0n ? 50 : Number(((year - start) * 1_000_000n) / span) / 10_000
  }

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const axis = axisRef.current
    if (!target || !scroll || !axis) return

    const fraction = span === 0n ? 0.5 : Number(BigInt(target.year) - start) / Number(span)
    const axisBox = axis.getBoundingClientRect()
    const viewportBox = scroll.getBoundingClientRect()
    scroll.scrollLeft += axisBox.left - viewportBox.left + axisBox.width * fraction - scroll.clientWidth / 2
  }, [target, zoom, start, span])

  function jumpToYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const year = Number(new FormData(event.currentTarget).get('year'))
    if (Number.isSafeInteger(year) && year >= timeline.startYear && year <= timeline.endYear) {
      setTarget({ year })
    }
  }

  const maxIntervals = baseIntervals * zoom
  const intervals = span < BigInt(maxIntervals) ? Number(span) : maxIntervals

  // Число отметок ограничено масштабом даже для очень длинного таймлайна.
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => {
    if (intervals === 0) return { year: start, position: 50 }

    const offset = (span * BigInt(index)) / BigInt(intervals)
    const position = Number((offset * 1_000_000n) / span) / 10_000
    return { year: start + offset, position }
  })

  const visibleEvents = (timeline.events ?? []).filter((event) => event.onTimeline !== false)
  // Минимальная ширина оси учитывает внутренние отступы шкалы.
  const axisMinWidth = 36 * zoom - 11
  const rowEnds: number[] = []
  const markers = [...visibleEvents].sort((left, right) =>
    left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1)
  ).map((event) => {
    const position = positionOf(BigInt(event.year))
    const offset = position * axisMinWidth / 100
    const freeRow = rowEnds.findIndex((end) => offset - end >= 9.5)
    const row = freeRow === -1 ? rowEnds.length : freeRow
    rowEnds[row] = offset
    return { ...event, position, row }
  })
  const highlightedYear = target?.year

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

      <div className="timeline-controls">
        <form onSubmit={jumpToYear}>
          <label>Системный год{' '}
            <input name="year" type="number" step={1} min={timeline.startYear} max={timeline.endYear} required />
          </label>{' '}
          <button type="submit">Перейти к году</button>
        </form>
        {visibleEvents.length > 0 && (
          <label>
            Перейти к событию{' '}
            <select value="" onChange={(event) => {
              const selected = visibleEvents.find(({ id }) => id === event.currentTarget.value)
              if (selected) setTarget({ year: selected.year })
            }}>
              <option value="" disabled>Выберите событие</option>
              {[...visibleEvents].sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                <option key={id} value={id}>{year} · {title}</option>
              ))}
            </select>
          </label>
        )}
        {highlightedYear !== undefined && <output aria-live="polite">Год {highlightedYear}</output>}
      </div>

      <div ref={scrollRef} className="timeline-scroll" tabIndex={0} role="region" aria-label="Шкала системных лет">
        <div className="timeline-track" style={{ width: `${100 * zoom}%`, minWidth: `${36 * zoom}rem` }}>
          {markers.length > 0 && (
            <ul className="timeline-markers" style={{ height: `${rowEnds.length * 2.5}rem` }} aria-label="События на шкале">
              {markers.map(({ id, year, title, position, row }) => (
                <li key={id} style={{ left: `${position}%`, bottom: `${row * 2.5 + 0.4}rem` }}>
                  <a href={`#events?year=${year}`} data-highlighted={year === highlightedYear}
                    aria-label={`${title}, системный год ${year}`} title={`${title} · ${year}`}>
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <ol ref={axisRef} className="timeline-axis">
            {ticks.map(({ year, position }) => (
              <li key={String(year)} style={{ left: `${position}%` }}>{String(year)}</li>
            ))}
          </ol>
          {highlightedYear !== undefined && (
            <div className="timeline-position" aria-hidden="true">
              <span style={{ left: `${positionOf(BigInt(highlightedYear))}%` }} />
            </div>
          )}

        </div>
      </div>
    </section>
  )
}
