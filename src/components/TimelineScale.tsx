import { calendarDay } from '../domain/timeline'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import type { Timeline, TimelineCalendar } from '../domain/timeline'

const zoomLevels = [1, 2, 4, 8, 16, 32, 64]
const baseIntervals = 4

export function TimelineScale({ timeline, calendar }: { timeline: Timeline; calendar: TimelineCalendar }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const axisRef = useRef<HTMLOListElement>(null)
  const [target, setTarget] = useState<{ year: number; day?: number } | null>(null)
  const zoom = zoomLevels[zoomIndex]!
  const detailed = zoom === 64
  const firstYear = BigInt(timeline.startYear)
  const daysPerYear = BigInt(timeline.daysPerYear)
  const detailYear = target?.year ?? timeline.startYear
  const windowSize = 366
  const windowStart = detailed ? Math.floor((target?.day ?? 0) / windowSize) * windowSize : 0
  const windowDays = Math.min(windowSize, timeline.daysPerYear - windowStart)
  const start = detailed ? BigInt(detailYear) : firstYear
  const span = BigInt(timeline.endYear) - firstYear
  const totalDays = detailed ? BigInt(windowDays) : (span + 1n) * daysPerYear
  const origin = BigInt(windowStart)
  function positionOf(year: bigint, elapsedDays = 0) {
    const offset = (year - start) * daysPerYear + BigInt(elapsedDays) - origin
    return Number(offset) / Number(totalDays) * 100
  }

  function zoomIn() {
    if (zoom === 32 && axisRef.current && scrollRef.current) {
      const axis = axisRef.current.getBoundingClientRect()
      const viewport = scrollRef.current.getBoundingClientRect()
      const fraction = Math.max(0, Math.min(1, (viewport.left + viewport.width / 2 - axis.left) / axis.width))
      const yearCount = span + 1n
      const approximate = BigInt(Math.floor(fraction * Number(yearCount)))
      const offset = approximate < yearCount ? approximate : span
      setTarget((current) => current ?? { year: Number(firstYear + offset) })
    }
    setZoomIndex(zoomIndex + 1)
  }

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const axis = axisRef.current
    if (!target || !scroll || !axis) return

    const offset = (BigInt(target.year) - start) * daysPerYear + BigInt(target.day ?? 0) - origin
    const fraction = Number(offset) / Number(totalDays)
    const axisBox = axis.getBoundingClientRect()
    const viewportBox = scroll.getBoundingClientRect()
    scroll.scrollLeft += axisBox.left - viewportBox.left + axisBox.width * fraction - scroll.clientWidth / 2
  }, [target, zoom, start, daysPerYear, totalDays, origin])

  function jumpToYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const year = Number(new FormData(event.currentTarget).get('year'))
    if (Number.isSafeInteger(year) && year >= timeline.startYear && year <= timeline.endYear) {
      setTarget({ year })
    }
  }

  const maxIntervals = zoom === 32 ? 20 * zoom : baseIntervals * zoom
  const intervals = span < BigInt(maxIntervals) ? Number(span) : maxIntervals

  // Число отметок ограничено масштабом даже для очень длинного таймлайна.
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => {
    if (intervals === 0) return { year: start, position: 0 }

    const offset = (span * BigInt(index)) / BigInt(intervals)
    const position = positionOf(start + offset)
    return { year: start + offset, position }
  })

  const visibleEvents = (timeline.events ?? []).filter((event) => event.onTimeline !== false)
  // Минимальная ширина оси учитывает внутренние отступы шкалы.
  const axisMinWidth = detailed ? windowDays * 6 : 36 * zoom - 11
  const rowEnds: number[] = []
  const markers = [...visibleEvents].sort((left, right) =>
    left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1)
  ).flatMap((event) => {
    const position = positionOf(BigInt(event.year), (event.date?.first ?? 1) - 1)
    const endPosition = event.end
      ? positionOf(BigInt(event.end.year), event.end.date?.last ?? timeline.daysPerYear)
      : position
    if (detailed && (position >= 100 || (event.end ? endPosition <= 0 : position < 0))) return []
    const leftPosition = Math.max(0, position)
    const width = Math.min(100, endPosition) - leftPosition
    const offset = leftPosition * axisMinWidth / 100
    const left = offset - (event.end ? 0 : 4.5)
    const right = offset + (event.end ? Math.max(width * axisMinWidth / 100, 2) : 4.5)
    const freeRow = rowEnds.findIndex((end) => left - end >= 0.5)
    const row = freeRow === -1 ? rowEnds.length : freeRow
    rowEnds[row] = right
    return [{ ...event, position: leftPosition, width, row }]
  })
  const highlightedYear = target?.year

  return (
    <section className="timeline-view" aria-labelledby="timeline-title">
      <h1 id="timeline-title">{timeline.name}</h1>
      <div className="timeline-controls timeline-navigation">
        <p className="timeline-years">
          Системные годы: {timeline.startYear} — {timeline.endYear}<br />
          Местные годы: {String(toCalendarYear(timeline.startYear, calendar.era))}
          {' — '}{String(toCalendarYear(timeline.endYear, calendar.era))}
        </p>
        <div className="timeline-zoom" role="group" aria-label="Масштаб шкалы">
          <button className="timeline-zoom-icon" type="button" aria-label="Уменьшить" title="Уменьшить" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
            <ZoomIcon />
          </button>
          <output aria-live="polite">{zoom}×</output>
          <button
            type="button"
            className="timeline-zoom-icon"
            aria-label="Увеличить"
            title="Увеличить"
            disabled={zoomIndex === zoomLevels.length - 1}
            onClick={zoomIn}
          >
            <ZoomIcon plus />
          </button>
        </div>
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
              if (selected) setTarget({ year: selected.year, day: (selected.date?.first ?? 1) - 1 })
            }}>
              <option value="" disabled>Выберите событие</option>
              {[...visibleEvents].sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                <option key={id} value={id}>{year} · {title}</option>
              ))}
            </select>
          </label>
        )}
        {detailed && (
          <>
            <button type="button" disabled={detailYear <= timeline.startYear}
              onClick={() => setTarget({ year: detailYear - 1 })}>Предыдущий год</button>
            <button type="button" disabled={detailYear >= timeline.endYear}
              onClick={() => setTarget({ year: detailYear + 1 })}>Следующий год</button>
            {timeline.daysPerYear > windowSize && (
              <>
                <button type="button" disabled={windowStart === 0}
                  onClick={() => setTarget({ year: detailYear, day: windowStart - windowSize })}>Предыдущие дни</button>
                <button type="button" disabled={windowStart + windowDays >= timeline.daysPerYear}
                  onClick={() => setTarget({ year: detailYear, day: windowStart + windowDays })}>Следующие дни</button>
              </>
            )}
          </>
        )}
        {highlightedYear !== undefined && <output aria-live="polite">Год {highlightedYear}</output>}
      </div>

      <div ref={scrollRef} className="timeline-scroll" tabIndex={0} role="region" aria-label="Шкала системных лет">
        <div className="timeline-track" style={detailed ? { width: `${axisMinWidth + 11}rem`, minWidth: "100%" } : { width: `${100 * zoom}%`, minWidth: `${36 * zoom}rem` }}>
          {markers.length > 0 && (
            <ul className="timeline-markers" style={{ height: `${rowEnds.length * 2.5}rem` }} aria-label="События на шкале">
              {markers.map(({ id, year, title, position, width, row, end, color }) => (
                <li key={id} className={end ? "timeline-period" : undefined} style={{ width: end ? `${width}%` : undefined, left: `${position}%`, bottom: `${row * 2.5 + 0.4}rem` }}>
                  <a href={`#events?event=${encodeURIComponent(id)}`} data-highlighted={year === highlightedYear}
                    style={color ? { backgroundColor: color, color: markerTextColor(color) } : undefined}
                    aria-label={`${title}, системный год ${year}`} title={`${title} · ${year}`}>
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <ol ref={axisRef} className="timeline-axis">
            {detailed ? Array.from({ length: windowDays }, (_, index) => {
              const day = windowStart + index + 1
              return (
                <li className="timeline-calendar-tick" key={day} title={calendarDay(calendar.months, day)} style={{ left: `${index / windowDays * 100}%` }}>
                  {calendarDay(calendar.months, day)}
                </li>
              )
            }) : ticks.map(({ year, position }) => (
              <li key={String(year)} style={{ left: `${position}%` }}>{String(year)}</li>
            ))}
          </ol>
          {highlightedYear !== undefined && (
            <div className="timeline-position" aria-hidden="true">
              <span style={{ left: `${positionOf(BigInt(highlightedYear), target?.day)}%` }} />
            </div>
          )}

        </div>
      </div>
    </section>
  )
}

function markerTextColor(color: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  return luminance > 0.179 ? '#000' : '#fff'
}

function ZoomIcon({ plus = false }: { plus?: boolean }) {
  return <span className="zoom-lens" aria-hidden="true">{plus ? '+' : '−'}</span>
}
