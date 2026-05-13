import { useState, useEffect, useRef, useCallback } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical } from '../utils/session'

export interface TrackPoint { x: number; y: number }
export interface LivePosition { driverNumber: number; x: number; y: number }

export interface TrackMapState {
  outline: TrackPoint[]
  livePositions: LivePosition[]
  ready: boolean
}

export const SVG_W = 500
export const SVG_H = 380

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

function calcBounds(pts: TrackPoint[]): Bounds {
  return {
    minX: Math.min(...pts.map(p => p.x)),
    maxX: Math.max(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)),
    maxY: Math.max(...pts.map(p => p.y)),
  }
}

function normalizePoints(pts: TrackPoint[], bounds: Bounds, pad = 30): TrackPoint[] {
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeY = bounds.maxY - bounds.minY || 1
  const scale = Math.min((SVG_W - pad * 2) / rangeX, (SVG_H - pad * 2) / rangeY)
  const offsetX = (SVG_W - rangeX * scale) / 2
  const offsetY = (SVG_H - rangeY * scale) / 2
  return pts.map(p => ({
    x: (p.x - bounds.minX) * scale + offsetX,
    y: SVG_H - ((p.y - bounds.minY) * scale + offsetY), // flip Y
  }))
}

export function useTrackMap(
  sessionKey: number,
  driverNumbers: number[],
  sessionDateStart: string | null = null,
  sessionDateEnd: string | null = null,
) {
  const [state, setState] = useState<TrackMapState>({ outline: [], livePositions: [], ready: false })
  const boundsRef = useRef<Bounds | null>(null)
  const initDoneRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const driversRef = useRef<number[]>(driverNumbers)
  driversRef.current = driverNumbers

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
        // For historical sessions: first 10 minutes of the session = track outline
        const start = new Date(sessionDateStart)
        const end = new Date(start.getTime() + 600_000)
        params['date>'] = start.toISOString()
        params['date<'] = end.toISOString()
      } else if (!historical) {
        // Live: last 10 minutes
        params['date>'] = new Date(Date.now() - 600_000).toISOString()
      }

      const data = await openF1.location(params)
      if (!data.length) return

      const raw: TrackPoint[] = data.filter((_, i) => i % 4 === 0).map(d => ({ x: d.x, y: d.y }))
      const bounds = calcBounds(raw)
      boundsRef.current = bounds
      initDoneRef.current = true

      setState(prev => ({ ...prev, outline: normalizePoints(raw, bounds), ready: true }))
    } catch { /* silent */ }
  }, [sessionKey, sessionDateStart, sessionDateEnd])

  const pollPositions = useCallback(async () => {
    if (!boundsRef.current || !driversRef.current.length) return
    try {
      const historical = isHistorical(sessionDateEnd)
      const params: Parameters<typeof openF1.location>[0] = { session_key: sessionKey }

      if (historical && sessionDateEnd) {
        // Final 15 seconds of the session = last-known positions
        const end = new Date(sessionDateEnd)
        const windowStart = new Date(end.getTime() - 15_000)
        params['date>'] = windowStart.toISOString()
        params['date<'] = end.toISOString()
      } else {
        params['date>'] = new Date(Date.now() - 5000).toISOString()
      }

      const data = await openF1.location(params)
      if (!data.length) return

      // Latest per driver
      const latestMap = data.reduce<Record<number, { x: number; y: number }>>((acc, d) => {
        acc[d.driver_number] = { x: d.x, y: d.y }
        return acc
      }, {})

      const livePositions: LivePosition[] = Object.entries(latestMap).map(([dn, pt]) => {
        const [norm] = normalizePoints([pt], boundsRef.current!)
        return { driverNumber: Number(dn), ...norm }
      })

      setState(prev => ({ ...prev, livePositions }))
    } catch { /* silent */ }
  }, [sessionKey, sessionDateEnd])

  useEffect(() => {
    if (!driverNumbers.length || initDoneRef.current) return
    initOutline()
  }, [driverNumbers.length, initOutline])

  useEffect(() => {
    if (!state.ready) return
    pollPositions()
    // Historical: positions don't change, poll once and stop
    if (!isHistorical(sessionDateEnd)) {
      pollRef.current = setInterval(pollPositions, 10_000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [state.ready, pollPositions, sessionDateEnd])

  return state
}
