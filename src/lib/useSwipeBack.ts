import { useRef, useCallback } from 'react'

// Swipe from left edge of screen to go back (like iOS native back gesture)
export function useSwipeBack(onBack: () => void, edgeWidth = 30, threshold = 80) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const isEdgeSwipe = useRef(false)
  const el = useRef<HTMLDivElement | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    // Only trigger if touch starts within edgeWidth pixels of left edge
    if (x <= edgeWidth) {
      startX.current = x
      startY.current = y
      isEdgeSwipe.current = true
    } else {
      isEdgeSwipe.current = false
    }
  }, [edgeWidth])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isEdgeSwipe.current || startX.current === null || startY.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = Math.abs(e.touches[0].clientY - startY.current)
    // Only handle horizontal swipe (not vertical scroll)
    if (dy > dx) { isEdgeSwipe.current = false; return }
    if (dx > 0 && el.current) {
      el.current.style.transform = `translateX(${dx}px)`
      el.current.style.transition = 'none'
      el.current.style.boxShadow = `-${dx * 0.3}px 0 ${dx * 0.5}px rgba(0,0,0,${0.15 - dx * 0.001})`
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isEdgeSwipe.current || startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    if (el.current) {
      if (dx > threshold) {
        el.current.style.transform = `translateX(100%)`
        el.current.style.transition = 'transform 0.25s ease'
        setTimeout(onBack, 240)
      } else {
        el.current.style.transform = 'translateX(0)'
        el.current.style.transition = 'transform 0.2s ease'
        el.current.style.boxShadow = ''
      }
    }
    startX.current = null
    isEdgeSwipe.current = false
  }, [onBack, threshold])

  return { ref: el, onTouchStart, onTouchMove, onTouchEnd }
}
