import { useState, useEffect, useCallback, useRef } from 'react'
import { openF1 } from '../api/openf1'
import { isHistorical, latestPerDriver, LIVE_POLL_MS } from '../utils/session'
import type {
  Driver, Position, Interval, Lap, Stint,
  Pit, RaceControl, TeamRadio, Weather, OvertakeEvent, SessionResult,
} from '../types'

export interface RaceState {
  drivers: Driver[]
  positions: Position[]
  allPositions: Position[]
  intervals: Interval[]
  laps: Lap[]
  stints: Stint[]
  pits: Pit[]
  raceControl: RaceControl[]
  teamRadio: TeamRadio[]
  weather: Weather | null
  overtakes: OvertakeEvent[]
  positionChanges: Record<number, 'up' | 'down'>
  totalLaps: number
  loading: boolean
  // null = ok, string = error or retry status message
  error: string | null
}

function detectOvertakes(prev: Position[], next: Position[], laps: Lap[]): OvertakeEvent[] {
  if (!prev.length || !next.length) return []
  const prevMap = new Map(prev.map(p => [p.driver_number, p.position]))
  const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number), 0)
  const events: OvertakeEvent[] = []
  for (const pos of next) {
    const old = prevMap.get(pos.driver_number)
    if (old === undefined || old === pos.position) continue
    if (pos.position < old) {
      const overtaken = next.find(
        p => p.driver_number !== pos.driver_number && p.position === old
      )
      if (overtaken) {
        events.push({
          overtakingDriver: pos.driver_number,
          overtakenDriver: overtaken.driver_number,
          newPosition: pos.position,
          lapNumber: maxLap,
          timestamp: pos.date,
        })
      }
    }
  }
  return events
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise } catch { return fallback }
}

const MAX_RETRIES = 3

export function useRaceData(sessionKey: number, sessionDateEnd: string | null = null) {
  const [state, setState] = useState<RaceState>({
    drivers: [], positions: [], allPositions: [], intervals: [], laps: [],
    stints: [], pits: [], raceControl: [], teamRadio: [],
    weather: null, overtakes: [], positionChanges: {},
    totalLaps: 0, loading: true, error: null,
  })

  const prevPositionsRef = useRef<Position[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // true until first successful fetch completes
  const isInitialRef = useRef(true)
  const retryCountRef = useRef(0)

  const fetchAll = useCallback(async () => {
    try {
      const params = { session_key: sessionKey }

      // Batch 1: critical — these hit the cache if prefetch ran
      const [drivers, positions, intervals] = await Promise.all([
        openF1.drivers(params),
        openF1.positions(params),
        openF1.intervals(params),
      ])

      // If we got no drivers, the session probably doesn't exist
      if (!drivers.length && isInitialRef.current) {
        throw new Error('No driver data found for this session')
      }

      // Batch 2: important
      const [laps, stints, pits] = await Promise.all([
        openF1.laps(params),
        safe(openF1.stints(params), []),
        safe(openF1.pits(params), []),
      ])

      // Batch 3: non-critical — hide UI sections when empty rather than error
      const [raceControl, teamRadio, weatherArr, sessionResult] = await Promise.all([
        safe(openF1.raceControl(params), []),
        safe(openF1.teamRadio(params), []),
        safe(openF1.weather(params), []),
        safe(openF1.sessionResult(params), [] as SessionResult[]),
      ])

      const totalLaps = sessionResult.length
        ? Math.max(...sessionResult.map(r => r.number_of_laps ?? 0))
        : 0

      const latestPositions = latestPerDriver(positions).sort((a, b) => a.position - b.position)
      const latestIntervals = latestPerDriver(intervals)
      const latestWeather = weatherArr.length
        ? weatherArr.reduce((a, b) => (a.date > b.date ? a : b))
        : null

      const newOvertakes = detectOvertakes(prevPositionsRef.current, latestPositions, laps)

      const prevMap = new Map(prevPositionsRef.current.map(p => [p.driver_number, p.position]))
      const changes: Record<number, 'up' | 'down'> = {}
      for (const pos of latestPositions) {
        const old = prevMap.get(pos.driver_number)
        if (old !== undefined && old !== pos.position)
          changes[pos.driver_number] = pos.position < old ? 'up' : 'down'
      }
      prevPositionsRef.current = latestPositions

      if (Object.keys(changes).length > 0) {
        if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
        changeTimerRef.current = setTimeout(
          () => setState(prev => ({ ...prev, positionChanges: {} })),
          2000
        )
      }

      // ── Success ───────────────────────────────────────────────────────────
      isInitialRef.current = false
      retryCountRef.current = 0

      setState(prev => ({
        ...prev,
        drivers,
        laps,
        stints,
        pits,
        raceControl,
        teamRadio,
        positions: latestPositions,
        allPositions: positions,
        intervals: latestIntervals,
        weather: latestWeather,
        overtakes: newOvertakes.length
          ? [...prev.overtakes.slice(-50), ...newOvertakes]
          : prev.overtakes,
        positionChanges: Object.keys(changes).length > 0 ? changes : prev.positionChanges,
        totalLaps: totalLaps || prev.totalLaps,
        loading: false,
        error: null,
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed'

      if (isInitialRef.current) {
        // ── Initial load failed — auto-retry with exponential backoff ─────
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++
          const delay = 2000 * retryCountRef.current  // 2s → 4s → 6s
          setState(prev => ({
            ...prev,
            error: `Connecting… (attempt ${retryCountRef.current}/${MAX_RETRIES})`,
          }))
          retryTimerRef.current = setTimeout(fetchAll, delay)
        } else {
          // All retries exhausted — surface hard error
          setState(prev => ({
            ...prev,
            loading: false,
            error: msg,
          }))
        }
      } else {
        // ── Poll failure — we already have data, stay silent ──────────────
        // Just mark the error so the header can show a small indicator.
        // Don't clear existing race data or reset loading.
        setState(prev => ({ ...prev, error: `Sync error — ${msg}` }))
        // Auto-clear the poll error after 8s (next poll will try again)
        setTimeout(() => setState(prev => ({ ...prev, error: null })), 8000)
      }
    }
  }, [sessionKey])

  useEffect(() => {
    isInitialRef.current = true
    retryCountRef.current = 0

    fetchAll()

    if (!isHistorical(sessionDateEnd)) {
      pollRef.current = setInterval(fetchAll, LIVE_POLL_MS)
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [fetchAll, sessionDateEnd])

  return state
}
