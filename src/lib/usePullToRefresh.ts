import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 80  // px of pull needed to trigger refresh
const MIN_PULL = 24   // px moved before we decide intent
const AXIS_RATIO = 2.5 // vertical must be this much more than horizontal

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullProgress, setPullProgress] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const pullRef = useRef(0)
  const activeRef = useRef(false)  // touch candidate (at top of page)
  const lockedRef = useRef(false)  // confirmed vertical pull — safe to preventDefault
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    function reset() {
      activeRef.current = false
      lockedRef.current = false
      pullRef.current = 0
      setPullProgress(0)
    }

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) return
      startYRef.current = e.touches[0].clientY
      startXRef.current = e.touches[0].clientX
      activeRef.current = true
      lockedRef.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeRef.current) return

      // Abort if page has scrolled away from top
      if (window.scrollY > 0) { reset(); return }

      const dy = e.touches[0].clientY - startYRef.current
      const dx = e.touches[0].clientX - startXRef.current

      // Moving up — cancel any progress
      if (dy <= 0) {
        if (lockedRef.current) reset()
        return
      }

      if (!lockedRef.current) {
        // Wait for enough movement to determine intent
        if (dy < MIN_PULL) return
        // If gesture is more horizontal than vertical it's a swipe, not a pull
        if (Math.abs(dx) * AXIS_RATIO > dy) { activeRef.current = false; return }
        lockedRef.current = true
      }

      // Confirmed downward pull — block native scroll and show indicator
      e.preventDefault()
      const p = Math.min(dy / THRESHOLD, 1)
      pullRef.current = p
      setPullProgress(p)
    }

    async function onTouchEnd() {
      if (!activeRef.current) return
      const p = pullRef.current
      reset()
      if (p >= 1 && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        try {
          await onRefreshRef.current()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
        }
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', reset)
    }
  }, [])

  return { pullProgress, refreshing }
}
