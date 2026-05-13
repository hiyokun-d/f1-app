import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical } from '../utils/session'
import type { CarData } from '../types'

export interface CarDataState {
  latest: CarData | null
  history: CarData[]
  bufferEnd: Date | null
}

const INITIAL_CHUNK_MS = 30 * 60 * 1000   // 30 min starting window
const MIN_CHUNK_MS     =  5 * 60 * 1000   // 5 min floor
const MAX_CHUNK_MS     = 90 * 60 * 1000   // 90 min ceiling
const TARGET_FETCH_MS  = 2_000            // aim for 2 s per fetch → adapts chunk up/down
const TRIGGER_AHEAD_MS =  5 * 60 * 1000  // safety-net: prefetch when ≤5 min from buffer edge
const HISTORY_BUFFER_MS = 30_000          // 30 s before window start for sparkline history

function adaptChunk(current: number, fetchMs: number): number {
  if (fetchMs <= 0) return current
  return Math.max(MIN_CHUNK_MS, Math.min(MAX_CHUNK_MS, current * (TARGET_FETCH_MS / fetchMs)))
}

export function useCarData(
  sessionKey: number,
  driverNumber: number | null,
  sessionDateEnd: string | null = null,
  replayTime: Date | null = null,
) {
  const [rawData, setRawData] = useState<CarData[]>([])
  const [bufferEnd, setBufferEnd] = useState<Date | null>(null)
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Adaptive buffer — mutable refs (no re-renders)
  const chunkSizeMsRef = useRef(INITIAL_CHUNK_MS)
  const bufferEndRef   = useRef<Date | null>(null)
  const accumulatedRef = useRef<CarData[]>([])
  const prefetchingRef = useRef(false)
  const fetchingRef    = useRef(false)
  const replayTimeRef  = useRef(replayTime)
  replayTimeRef.current = replayTime

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetBuffer = useCallback(() => {
    accumulatedRef.current = []
    bufferEndRef.current   = null
    prefetchingRef.current = false
    fetchingRef.current    = false
    setBufferEnd(null)
  }, [])

  const advanceBuffer = useCallback((to: Date) => {
    bufferEndRef.current = to
    setBufferEnd(to)
  }, [])

  // Fetch a window, merge into accumulated, update rawData state, return elapsed ms
  const fetchWindow = useCallback(async (dateGt: string, dateLt: string): Promise<number> => {
    const t0 = Date.now()
    const results = await openF1.carData({
      session_key: sessionKey,
      driver_number: driverNumber!,
      'date>': dateGt,
      'date<': dateLt,
    })
    const elapsed = Date.now() - t0
    if (results.length) {
      accumulatedRef.current = [...accumulatedRef.current, ...results]
      setRawData([...accumulatedRef.current])
    }
    return elapsed
  }, [sessionKey, driverNumber])

  // ── Initial fetch ──────────────────────────────────────────────────────────

  const fetchInitial = useCallback(async () => {
    if (driverNumber === null || fetchingRef.current) return
    fetchingRef.current = true
    try {
      const historical = isHistorical(sessionDateEnd)

      if (historical && replayTimeRef.current) {
        const rt = replayTimeRef.current
        const windowStart = new Date(rt.getTime() - HISTORY_BUFFER_MS)
        const windowEnd   = new Date(rt.getTime() + chunkSizeMsRef.current)

        const elapsed = await fetchWindow(windowStart.toISOString(), windowEnd.toISOString())
        chunkSizeMsRef.current = adaptChunk(chunkSizeMsRef.current, elapsed)
        advanceBuffer(windowEnd)

      } else if (historical && sessionDateEnd) {
        // replayTime not yet available — fallback to last minute
        const sessionEnd = new Date(sessionDateEnd)
        await fetchWindow(
          new Date(sessionEnd.getTime() - 60_000).toISOString(),
          sessionEnd.toISOString(),
        )
      } else {
        // Live — last 30 s
        const now = new Date()
        await fetchWindow(
          new Date(now.getTime() - 30_000).toISOString(),
          now.toISOString(),
        )
      }
    } catch { /* silent */ }
    fetchingRef.current = false
  }, [sessionKey, driverNumber, sessionDateEnd, fetchWindow, advanceBuffer])

  // ── Adaptive prefetch (one chunk) ──────────────────────────────────────────

  const prefetchNext = useCallback(async () => {
    if (!bufferEndRef.current || prefetchingRef.current || driverNumber === null) return
    prefetchingRef.current = true
    try {
      const fetchStart   = bufferEndRef.current
      const naturalEnd   = new Date(fetchStart.getTime() + chunkSizeMsRef.current)
      // Cap at session end — no wasted request past it
      const sessionEndDate = sessionDateEnd ? new Date(sessionDateEnd) : null
      const fetchEnd     = sessionEndDate && naturalEnd > sessionEndDate ? sessionEndDate : naturalEnd

      const elapsed = await fetchWindow(fetchStart.toISOString(), fetchEnd.toISOString())
      chunkSizeMsRef.current = adaptChunk(chunkSizeMsRef.current, elapsed)
      advanceBuffer(fetchEnd)
    } catch { /* silent */ }
    prefetchingRef.current = false
  }, [driverNumber, sessionDateEnd, fetchWindow, advanceBuffer])

  // ── Effects ────────────────────────────────────────────────────────────────

  // Reset + initial fetch when driver / session changes
  useEffect(() => {
    if (driverNumber === null) {
      setRawData([])
      resetBuffer()
      return
    }
    resetBuffer()
    setRawData([])

    if (!isHistorical(sessionDateEnd) || replayTimeRef.current) {
      fetchInitial()
    }
    if (!isHistorical(sessionDateEnd)) {
      liveIntervalRef.current = setInterval(fetchInitial, 8_000)
    }
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, driverNumber, sessionDateEnd])

  // For historical sessions: kick off initial fetch once replayTime is first available
  useEffect(() => {
    if (!replayTime || !isHistorical(sessionDateEnd) || driverNumber === null) return
    if (bufferEndRef.current !== null || fetchingRef.current) return
    fetchInitial()
  }, [replayTime, sessionDateEnd, driverNumber, fetchInitial])

  // Continuous fill: whenever bufferEnd advances, keep fetching until session end
  useEffect(() => {
    if (!bufferEnd || !sessionDateEnd || !isHistorical(sessionDateEnd)) return
    if (driverNumber === null || prefetchingRef.current) return
    if (bufferEnd < new Date(sessionDateEnd)) {
      prefetchNext()
    }
  }, [bufferEnd, sessionDateEnd, driverNumber, prefetchNext])

  // Safety-net: seek / fast-forward triggered prefetch when replay nears buffer edge
  useEffect(() => {
    if (!replayTime || !isHistorical(sessionDateEnd) || !bufferEndRef.current) return
    const timeUntilEnd = bufferEndRef.current.getTime() - replayTime.getTime()
    if (timeUntilEnd < TRIGGER_AHEAD_MS && !prefetchingRef.current) {
      prefetchNext()
    }
  }, [replayTime, sessionDateEnd, prefetchNext])

  // ── Derived state (no API call — just filter accumulated data) ─────────────

  const { latest, history } = useMemo(() => {
    if (!rawData.length) return { latest: null, history: [] }
    if (!replayTime || !isHistorical(sessionDateEnd)) {
      return { latest: rawData[rawData.length - 1], history: rawData.slice(-60) }
    }
    const iso = replayTime.toISOString()
    const filtered = rawData.filter(r => r.date <= iso)
    return {
      latest: filtered[filtered.length - 1] ?? null,
      history: filtered.slice(-60),
    }
  }, [rawData, replayTime, sessionDateEnd])

  return { latest, history, bufferEnd }
}
