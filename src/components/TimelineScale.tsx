import { t } from '../i18n.ts'
import { useStatusMatch } from './EntryMedia'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { toCalendarYear } from '../domain/calendarYear'
import { defaultOrganizationColor, type Timeline, type TimelineCalendar } from '../domain/timeline'

const zoomLevels = [1, 2, 4, 8, 16, 32, 64, 128]
const baseIntervals = 4

export function TimelineScale({ timeline, calendar }: { timeline: Timeline; calendar: TimelineCalendar }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const axisRef = useRef<HTMLOListElement>(null)
  const [target, setTarget] = useState<{ year: number; day?: number } | null>(null)
  const zoom = zoomLevels[zoomIndex]!
  const start = BigInt(timeline.startYear)
  const scaleEnd = timeline.startYear < 0 ? Math.max(timeline.endYear, 0) : timeline.endYear
  const span = BigInt(scaleEnd) - start
  const daysPerYear = BigInt(timeline.daysPerYear)
  const totalDays = (span + 1n) * daysPerYear

  function positionOf(year: bigint, elapsedDays = 0) {
    const offset = (year - start) * daysPerYear + BigInt(elapsedDays)
    return Number(offset) / Number(totalDays) * 100
  }

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    function scrollWithWheel(event: WheelEvent) {
      if (!scroll || event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      if (scroll.scrollWidth <= scroll.clientWidth) return

      event.preventDefault()
      const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientWidth : 1
      scroll.scrollLeft += event.deltaY * step
    }

    scroll.addEventListener('wheel', scrollWithWheel, { passive: false })
    return () => scroll.removeEventListener('wheel', scrollWithWheel)
  }, [])

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const axis = axisRef.current
    if (!target || !scroll || !axis) return

    const offset = (BigInt(target.year) - start) * daysPerYear + BigInt(target.day ?? 0)
    const fraction = Number(offset) / Number(totalDays)
    const axisBox = axis.getBoundingClientRect()
    const viewportBox = scroll.getBoundingClientRect()
    scroll.scrollLeft += axisBox.left - viewportBox.left + axisBox.width * fraction - scroll.clientWidth / 2
  }, [target, zoom, start, daysPerYear, totalDays])

  function jumpToYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const year = Number(new FormData(event.currentTarget).get('year'))
    if (Number.isSafeInteger(year) && year >= timeline.startYear && year <= timeline.endYear) {
      setTarget({ year })
    }
  }

  const maxIntervals = BigInt(zoom >= 32 ? 20 * zoom : baseIntervals * zoom)
  // Округляем шаг вверх один раз, чтобы соседние деления всегда были равноудалены.
  const yearStep = span === 0n ? 1n : (span + maxIntervals - 1n) / maxIntervals
  const ticks = Array.from({ length: Number(span / yearStep) + 1 }, (_, index) => {
    const year = start + BigInt(index) * yearStep
    return { year, position: positionOf(year) }
  })

  if (start < 0n && !ticks.some(({ year }) => year === 0n)) {
    const afterZero = ticks.findIndex(({ year }) => year > 0n)
    ticks.splice(afterZero < 0 ? ticks.length : afterZero, 0, { year: 0n, position: positionOf(0n) })
  }

  const matchesStatus = useStatusMatch()
  const visibleEvents = (timeline.events ?? []).filter((event) => event.onTimeline !== false && matchesStatus(event))
  // Минимальная ширина оси учитывает внутренние отступы шкалы.
  const axisMinWidth = 36 * zoom - 11
  const rowEnds: number[] = []
  const markers = [...visibleEvents].sort((left, right) =>
    left.year - right.year || (left.date?.first ?? 1) - (right.date?.first ?? 1)
  ).map((event) => {
    const position = positionOf(BigInt(event.year), (event.date?.first ?? 1) - 1)
    const endPosition = event.end
      ? positionOf(BigInt(event.end.year), event.end.date?.last ?? timeline.daysPerYear)
      : position
    const leftPosition = Math.max(0, position)
    const width = Math.min(100, endPosition) - leftPosition
    const offset = leftPosition * axisMinWidth / 100
    const left = offset - (event.end ? 0 : 4.5)
    const right = offset + (event.end ? Math.max(width * axisMinWidth / 100, 2) : 4.5)
    const freeRow = rowEnds.findIndex((end) => left - end >= 0.5)
    const row = freeRow === -1 ? rowEnds.length : freeRow
    rowEnds[row] = right
    return { ...event, position: leftPosition, width, row }
  })
  const organizationPeriods = (timeline.organizations ?? []).filter((organization) => organization.onTimeline && matchesStatus(organization))
  const highlightedYear = target?.year

  return (
    <section className="timeline-view" aria-labelledby="timeline-title">
      <h1 id="timeline-title">{timeline.name}</h1>
      <div className="timeline-controls timeline-navigation">
        <p className="timeline-years">{t("Системные годы: ")}{timeline.startYear} — {timeline.endYear}<br />{t("Местные годы: ")}{String(toCalendarYear(timeline.startYear, calendar.era))}
          {' — '}{String(toCalendarYear(timeline.endYear, calendar.era))}
        </p>
        <div className="timeline-zoom" role="group" aria-label={t("Масштаб шкалы")}>
          <button className="timeline-zoom-icon" type="button" aria-label={t("Уменьшить")} title={t("Уменьшить")} disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
            <ZoomIcon />
          </button>
          <output aria-live="polite">{zoom}×</output>
          <button
            type="button"
            className="timeline-zoom-icon"
            aria-label={t("Увеличить")}
            title={t("Увеличить")}
            disabled={zoomIndex === zoomLevels.length - 1}
            onClick={() => setZoomIndex(zoomIndex + 1)}
          >
            <ZoomIcon plus />
          </button>
        </div>
        <form onSubmit={jumpToYear}>
          <label>{t("Системный год")}{' '}
            <input name="year" type="number" step={1} min={timeline.startYear} max={timeline.endYear} required />
          </label>{' '}
          <button type="submit">{t("Перейти к году")}</button>
        </form>
        {visibleEvents.length > 0 && (
          <label>{t("Перейти к событию")}{' '}
            <select value="" onChange={(event) => {
              const selected = visibleEvents.find(({ id }) => id === event.currentTarget.value)
              if (selected) setTarget({ year: selected.year, day: (selected.date?.first ?? 1) - 1 })
            }}>
              <option value="" disabled>{t("Выберите событие")}</option>
              {[...visibleEvents].sort((left, right) => left.year - right.year).map(({ id, year, title }) => (
                <option key={id} value={id}>{year} · {title}</option>
              ))}
            </select>
          </label>
        )}
        {highlightedYear !== undefined && <output aria-live="polite">{t("Год ")}{highlightedYear}</output>}
      </div>

      <div ref={scrollRef} className="timeline-scroll" tabIndex={0} role="region" aria-label={t("Шкала системных лет")}>
        <div className="timeline-track" style={{ width: `${100 * zoom}%`, minWidth: `${36 * zoom}rem` }}>
          {markers.length > 0 && (
            <ul className="timeline-markers" style={{ height: `${rowEnds.length * 2.5}rem` }} aria-label={t("События на шкале")}>
              {markers.map(({ id, year, title, position, width, row, end, color }) => (
                <li key={id} className={end ? "timeline-period" : undefined} style={{ width: end ? `${width}%` : undefined, left: `${position}%`, bottom: `${row * 2.5 + 0.4}rem` }}>
                  <a href={`#events?event=${encodeURIComponent(id)}`} data-highlighted={year === highlightedYear}
                    style={color ? { backgroundColor: color, color: markerTextColor(color) } : undefined}
                    aria-label={`${title}${t(", системный год ")}${year}`} title={`${title} · ${year}`}>
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <ol ref={axisRef} className="timeline-axis">
            {ticks.map(({ year, position }) => (
              <li key={String(year)} className={year === 0n ? "timeline-zero" : undefined} style={{ left: `${position}%` }}>{String(year)}</li>
            ))}
          </ol>
          {highlightedYear !== undefined && (
            <div className="timeline-position" aria-hidden="true">
              <span style={{ left: `${positionOf(BigInt(highlightedYear), target?.day)}%` }} />
            </div>
          )}
          {organizationPeriods.length > 0 && (
            <ul className="timeline-organizations" aria-label={t("Периоды существования организаций")}>
              {organizationPeriods.map(({ id, name, startYear, endYear, color = defaultOrganizationColor }) => {
                const left = positionOf(BigInt(startYear))
                const right = positionOf(BigInt(endYear ?? timeline.endYear) + 1n)
                const label = `${name} · ${startYear} — ${endYear ?? '…'}`
                return (
                  <li key={id}>
                    <a href={'#organizations?organization=' + encodeURIComponent(id)}
                      style={{ left: `${left}%`, width: `${right - left}%`, backgroundColor: color, color: markerTextColor(color) }}
                      aria-label={label} title={label}>{label}</a>
                  </li>
                )
              })}
            </ul>
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
