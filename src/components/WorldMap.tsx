import { useEffect, useRef } from 'react'
import mapUrl from '../assets/world-map.jpg'

export function WorldMap() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const image = imageRef.current
    if (!viewport || !image) return

    let zoom = 1

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()

      const nextZoom = Math.min(8, Math.max(1, zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2)))
      if (nextZoom === zoom) return

      const bounds = viewport.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const ratio = nextZoom / zoom
      const left = (viewport.scrollLeft + x) * ratio - x
      const top = (viewport.scrollTop + y) * ratio - y

      zoom = nextZoom
      image.style.width = `${zoom * 100}%`
      viewport.scrollTo(left, top)
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div ref={viewportRef} className="world-map-viewport" tabIndex={0} role="region" aria-labelledby="world-map-title">
      <img ref={imageRef} src={mapUrl} alt="Карта мира Атласа Арены" width={4096} height={3072} draggable={false} />
    </div>
  )
}
