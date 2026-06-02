import { useState, useEffect, useRef, useCallback } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical } from '../utils/session'

export interface TrackPoint { x: number; y: number }
export interface LivePosition { driverNumber: number; x: number; y: number }

export interface RacingLineEntry { driverNumber: number; points: TrackPoint[] }

export interface TrackMapState {
  outline: TrackPoint[]
  livePositions: LivePosition[]
  racingLines: RacingLineEntry[]
  ready: boolean
}

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

function calcBounds(pts: TrackPoint[]): Bounds {
  return {
    minX: Math.min(...pts.map(p => p.x)),
    maxX: Math.max(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)),
    maxY: Math.max(...pts.map(p => p.y)),
  }
}

function normalizePoints(
  pts: TrackPoint[],
  bounds: Bounds,
  svgW: number,
  svgH: number,
  pad = 40,
): TrackPoint[] {
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeY = bounds.maxY - bounds.minY || 1
  const scale = Math.min((svgW - pad * 2) / rangeX, (svgH - pad * 2) / rangeY)
  const offsetX = (svgW - rangeX * scale) / 2
  const offsetY = (svgH - rangeY * scale) / 2
  return pts.map(p => ({
    x: (p.x - bounds.minX) * scale + offsetX,
    y: svgH - ((p.y - bounds.minY) * scale + offsetY),
  }))
}

export function useTrackMap(
  sessionKey: number,
  driverNumbers: number[],
  sessionDateStart: string | null = null,
  sessionDateEnd: string | null = null,
  containerW = 800,
  containerH = 600,
) {
  const [state, setState] = useState<TrackMapState>({
    outline: [],
    livePositions: [],
    racingLines: [],
    ready: false,
  })

  const rawOutlineRef     = useRef<TrackPoint[]>([])
  const rawRacingLinesRef = useRef(new Map<number, TrackPoint[]>())
  const boundsRef = useRef<Bounds | null>(null)
  const initDoneRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const driversRef = useRef<number[]>(driverNumbers)
  driversRef.current = driverNumbers

  // Retry state for historical sessions with no GPS position data
  const RETRY_WINDOWS = [15_000, 60_000, 300_000] as const
  const retryIdxRef   = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollPosRef    = useRef<() => Promise<void>>(async () => {})

  // Re-normalize outline + racing line when container resizes
  const containerWRef = useRef(containerW)
  const containerHRef = useRef(containerH)
  containerWRef.current = containerW
  containerHRef.current = containerH

  useEffect(() => {
    if (!rawOutlineRef.current.length || !boundsRef.current) return
    const b = boundsRef.current
    const racingLines: RacingLineEntry[] = [...rawRacingLinesRef.current.entries()].map(([dn, raw]) => ({
      driverNumber: dn,
      points: normalizePoints(raw, b, containerW, containerH),
    }))
    setState(prev => ({
      ...prev,
      outline: normalizePoints(rawOutlineRef.current, b, containerW, containerH),
      ...(racingLines.length ? { racingLines } : {}),
    }))
  }, [containerW, containerH])

  const initOutline = useCallback(async () => {
    if (initDoneRef.current || !driversRef.current.length) return
    const firstDriver = driversRef.current[0]
    try {
      const historical = isHistorical(sessionDateEnd)
      const params: Parameters<typeof openF1.location>[0] = {
        session_key: sessionKey,
        driver_number: firstDriver,
      }

      if (historical && sessionDateStart) {
        const start = new Date(sessionDateStart)
        const end = new Date(start.getTime() + 600_000)
        params['date>'] = start.toISOString()
        params['date<'] = end.toISOString()
      } else if (!historical) {
        params['date>'] = new Date(Date.now() - 600_000).toISOString()
      }

      const data = await openF1.location(params)
      if (!data.length) return

      const raw: TrackPoint[] = data.filter((_, i) => i % 2 === 0).map(d => ({ x: d.x, y: d.y }))
      const bounds = calcBounds(raw)
      rawOutlineRef.current = raw
      boundsRef.current = bounds
      initDoneRef.current = true

      setState(prev => ({
        ...prev,
        outline: normalizePoints(raw, bounds, containerWRef.current, containerHRef.current),
        ready: true,
      }))
    } catch { /* silent */ }
  }, [sessionKey, sessionDateStart, sessionDateEnd])

  const pollPositions = useCallback(async () => {
    if (!boundsRef.current || !driversRef.current.length) return
    try {
      const historical = isHistorical(sessionDateEnd)
      const params: Parameters<typeof openF1.location>[0] = { session_key: sessionKey }

      if (historical && sessionDateEnd) {
        const windowMs = RETRY_WINDOWS[retryIdxRef.current] ?? RETRY_WINDOWS[RETRY_WINDOWS.length - 1]
        const end = new Date(sessionDateEnd)
        params['date>'] = new Date(end.getTime() - windowMs).toISOString()
        params['date<'] = end.toISOString()
      } else {
        params['date>'] = new Date(Date.now() - 10_000).toISOString()
      }

      const data = await openF1.location(params)
      if (!data.length) {
        // Historical: expand window and retry until data found or windows exhausted
        if (historical && retryIdxRef.current < RETRY_WINDOWS.length - 1) {
          retryIdxRef.current++
          retryTimerRef.current = setTimeout(() => pollPosRef.current(), 2_000)
        }
        return
      }

      // Got data — clear retry state
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
      retryIdxRef.current = 0

      const latestMap = data.reduce<Record<number, { x: number; y: number }>>((acc, d) => {
        acc[d.driver_number] = { x: d.x, y: d.y }
        return acc
      }, {})

      const livePositions: LivePosition[] = Object.entries(latestMap).map(([dn, pt]) => {
        const [norm] = normalizePoints([pt], boundsRef.current!, containerWRef.current, containerHRef.current)
        return { driverNumber: Number(dn), ...norm }
      })

      setState(prev => ({ ...prev, livePositions }))
    } catch { /* silent */ }
  }, [sessionKey, sessionDateEnd])

  pollPosRef.current = pollPositions

  // Reset retry index when session changes
  useEffect(() => { retryIdxRef.current = 0 }, [sessionKey])

  // Clean up retry timer on unmount
  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current) }, [])

  useEffect(() => {
    if (!driverNumbers.length || initDoneRef.current) return
    initOutline()
  }, [driverNumbers.length, initOutline])

  useEffect(() => {
    if (!state.ready) return
    pollPositions()
    if (!isHistorical(sessionDateEnd)) {
      pollRef.current = setInterval(pollPositions, 3_000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [state.ready, pollPositions, sessionDateEnd])

  // ── Racing lines — all drivers, last 2 minutes ────────────────────────────
  useEffect(() => {
    if (!state.ready || !boundsRef.current) return
    let cancelled = false

    const doFetch = async () => {
      if (cancelled || !boundsRef.current) return
      try {
        const historical = isHistorical(sessionDateEnd)
        const params: Parameters<typeof openF1.location>[0] = { session_key: sessionKey }
        if (historical && sessionDateEnd) {
          const end = new Date(sessionDateEnd)
          params['date>'] = new Date(end.getTime() - 120_000).toISOString()
          params['date<'] = end.toISOString()
        } else {
          params['date>'] = new Date(Date.now() - 120_000).toISOString()
        }
        const data = await openF1.location(params)
        if (cancelled || !data.length || !boundsRef.current) return

        // Group raw points by driver
        const grouped = new Map<number, TrackPoint[]>()
        for (const d of data) {
          if (!grouped.has(d.driver_number)) grouped.set(d.driver_number, [])
          grouped.get(d.driver_number)!.push({ x: d.x, y: d.y })
        }

        // Sample every 3rd point per driver, normalize with shared bounds
        const b = boundsRef.current
        const racingLines: RacingLineEntry[] = []
        rawRacingLinesRef.current.clear()
        for (const [dn, raw] of grouped) {
          const sampled = raw.filter((_, i) => i % 3 === 0)
          rawRacingLinesRef.current.set(dn, sampled)
          racingLines.push({
            driverNumber: dn,
            points: normalizePoints(sampled, b, containerWRef.current, containerHRef.current),
          })
        }
        setState(prev => ({ ...prev, racingLines }))
      } catch { /* silent */ }
    }

    rawRacingLinesRef.current.clear()
    setState(prev => ({ ...prev, racingLines: [] }))
    doFetch()

    let timer: ReturnType<typeof setInterval> | null = null
    if (!isHistorical(sessionDateEnd)) {
      timer = setInterval(doFetch, 30_000)
    }

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [state.ready, sessionKey, sessionDateEnd])

  return state
}
