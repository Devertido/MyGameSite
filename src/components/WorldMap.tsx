import { useEffect, useRef } from 'react'
import mapUrl from '../assets/world-map-glacier.png'

export function WorldMap() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const image = imageRef.current
    if (!viewport || !image) return

    let zoom = 1
    let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null

    const startDrag = (event: PointerEvent) => {
      if (event.button !== 2 || zoom <= 1) return
      event.preventDefault()
      drag = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        left: viewport.scrollLeft, top: viewport.scrollTop,
      }
      viewport.setPointerCapture(event.pointerId)
      viewport.style.cursor = 'grabbing'
    }

    const stopDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      drag = null
      viewport.style.cursor = ''
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    }

    const moveDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return
      if ((event.buttons & 2) === 0) {
        stopDrag(event)
        return
      }
      viewport.scrollTo(drag.left + drag.x - event.clientX, drag.top + drag.y - event.clientY)
    }

    const suppressMenu = (event: MouseEvent) => {
      if (zoom > 1) event.preventDefault()
    }

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
    viewport.addEventListener('pointerdown', startDrag)
    viewport.addEventListener('pointermove', moveDrag)
    viewport.addEventListener('pointerup', stopDrag)
    viewport.addEventListener('pointercancel', stopDrag)
    viewport.addEventListener('lostpointercapture', stopDrag)
    viewport.addEventListener('contextmenu', suppressMenu)
    return () => {
      viewport.removeEventListener('wheel', handleWheel)
      viewport.removeEventListener('pointerdown', startDrag)
      viewport.removeEventListener('pointermove', moveDrag)
      viewport.removeEventListener('pointerup', stopDrag)
      viewport.removeEventListener('pointercancel', stopDrag)
      viewport.removeEventListener('lostpointercapture', stopDrag)
      viewport.removeEventListener('contextmenu', suppressMenu)
    }
  }, [])

  return (
    <div ref={viewportRef} className="world-map-viewport" tabIndex={0} role="region" aria-labelledby="world-map-title">
      <img ref={imageRef} src={mapUrl} alt="Карта мира Атласа Арены" width={1448} height={1086} draggable={false} />
    </div>
  )
}
