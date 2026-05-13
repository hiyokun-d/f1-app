import { useEffect, useRef } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical } from '../utils/session'

const INITIAL_CHUNK_MS = 30 * 60 * 1000

/**
 * Eagerly prefetches car data for every driver in the session so switching
 * drivers is instant.
 *
 * Two modes:
 *  - Live: fires once when driverNumbers load — fetches last 30s for all drivers
 *  - Historical: fires immediately (using replayTime window) + re-fires each
 *    time the selected driver's buffer advances (buffer-sync)
 */
export function useDriverTelemetryPrefetch(
  sessionKey: number,
  driverNumbers: number[],
  selectedDriver: number | null,
  sessionDateEnd: string | null,
  replayTime: Date | null,
  bufferEnd: Date | null,
) {
  const prevBufferEndRef  = useRef<Date | null>(null)
  const initialFiredRef   = useRef(false)

  // ── Upfront prefetch: fires once when driverNumbers first loads ────────────
  useEffect(() => {
    if (!driverNumbers.length || initialFiredRef.current) return
    initialFiredRef.current = true

    const historical = isHistorical(sessionDateEnd)

    for (const dn of driverNumbers) {
      if (dn === selectedDriver) continue // useCarData owns the selected driver

      const params: Parameters<typeof openF1.carData>[0] = { session_key: sessionKey, driver_number: dn }

      if (historical && replayTime) {
        params['date>'] = new Date(replayTime.getTime() - 30_000).toISOString()
        params['date<'] = new Date(replayTime.getTime() + INITIAL_CHUNK_MS).toISOString()
      } else if (historical && sessionDateEnd) {
        const end = new Date(sessionDateEnd)
        params['date>'] = new Date(end.getTime() - 60_000).toISOString()
        params['date<'] = end.toISOString()
      } else {
        // Live — last 30 s
        params['date>'] = new Date(Date.now() - 30_000).toISOString()
      }

      openF1.carData(params).catch(() => {})
    }
  // Re-run if driverNumbers or replayTime arrive late (null → value transition)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverNumbers.length > 0, !!replayTime, sessionKey, sessionDateEnd])

  // ── Buffer-sync prefetch: historical only — fires per chunk ───────────────
  useEffect(() => {
    if (!isHistorical(sessionDateEnd) || !driverNumbers.length) return

    if (bufferEnd === null) {
      prevBufferEndRef.current = null
      return
    }
    if (prevBufferEndRef.current?.getTime() === bufferEnd.getTime()) return

    const windowEnd   = bufferEnd
    const windowStart = prevBufferEndRef.current
      ?? new Date(bufferEnd.getTime() - INITIAL_CHUNK_MS)
    prevBufferEndRef.current = bufferEnd

    for (const dn of driverNumbers) {
      if (dn === selectedDriver) continue
      openF1.carData({
        session_key: sessionKey,
        driver_number: dn,
        'date>': windowStart.toISOString(),
        'date<': windowEnd.toISOString(),
      }).catch(() => {})
    }
  }, [bufferEnd, sessionKey, driverNumbers, selectedDriver, sessionDateEnd])
}
