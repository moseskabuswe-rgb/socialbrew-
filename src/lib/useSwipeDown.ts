import { useRef, useCallback } from 'react'

export function useSwipeDown(onDismiss: () => void, threshold = 120) {
  const startY = useRef<number | null>(null)
  const currentY = useRef<number | null>(null)
  const el = useRef<HTMLDivElement | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return
    currentY.current = e.touches[0].clientY
    const delta = currentY.current - startY.current
    if (delta > 0 && el.current) {
      el.current.style.transform = `translateY(${delta}px)`
      el.current.style.transition = 'none'
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (startY.current === null || currentY.current === null) return
    const delta = currentY.current - startY.current
    if (el.current) {
      if (delta > threshold) {
        el.current.style.transform = `translateY(100%)`
        el.current.style.transition = 'transform 0.25s ease'
        setTimeout(onDismiss, 240)
      } else {
        el.current.style.transform = 'translateY(0)'
        el.current.style.transition = 'transform 0.2s ease'
      }
    }
    startY.current = null
    currentY.current = null
  }, [onDismiss, threshold])

  return { ref: el, onTouchStart, onTouchMove, onTouchEnd }
}
