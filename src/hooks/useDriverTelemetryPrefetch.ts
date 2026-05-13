import { useEffect, useRef } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical } from '../utils/session'

const INITIAL_CHUNK_MS = 30 * 60 * 1000

/**
 * When the selected driver's buffer advances, prefetch the same time window
 * for every other driver. When user switches drivers, data is already cached.
 */
export function useDriverTelemetryPrefetch(
  sessionKey: number,
  driverNumbers: number[],
  selectedDriver: number | null,
  sessionDateEnd: string | null,
  bufferEnd: Date | null,
) {
  const prevBufferEndRef = useRef<Date | null>(null)

  useEffect(() => {
    if (!isHistorical(sessionDateEnd) || !driverNumbers.length) return

    // Buffer reset (driver changed) — clear our tracking too
    if (bufferEnd === null) {
      prevBufferEndRef.current = null
      return
    }
    // bufferEnd didn't move — nothing new to prefetch
    if (prevBufferEndRef.current?.getTime() === bufferEnd.getTime()) return

    const windowEnd   = bufferEnd
    const windowStart = prevBufferEndRef.current
      ?? new Date(bufferEnd.getTime() - INITIAL_CHUNK_MS)
    prevBufferEndRef.current = bufferEnd

    for (const dn of driverNumbers) {
      if (dn === selectedDriver) continue // already fetched by useCarData
      openF1.carData({
        session_key: sessionKey,
        driver_number: dn,
        'date>': windowStart.toISOString(),
        'date<': windowEnd.toISOString(),
      }).catch(() => {})
    }
  }, [bufferEnd, sessionKey, driverNumbers, selectedDriver, sessionDateEnd])
}
