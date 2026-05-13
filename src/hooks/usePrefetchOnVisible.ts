import { useEffect, useRef } from 'react'
import { prefetchRaceData } from '../utils/prefetch'

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element is ≥40% visible for 150ms (guards against fast scroll-past),
 * prefetchRaceData fires once and never again for this sessionKey.
 */
export function usePrefetchOnVisible<T extends HTMLElement>(
  sessionKey: number,
  threshold = 0.4,
) {
  const ref = useRef<T>(null)
  const firedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          // Debounce: only prefetch if card stays visible for 150ms
          timerRef.current = setTimeout(() => {
            if (!firedRef.current) {
              firedRef.current = true
              prefetchRaceData(sessionKey)
            }
          }, 150)
        } else {
          // Left viewport before delay fired — cancel
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sessionKey, threshold])

  return ref
}
