import { useState, useEffect, useCallback, useRef } from 'react'
import { openF1 } from '../api/openf1'
import type {
  Driver, Position, Interval, Lap, Stint,
  Pit, RaceControl, TeamRadio, Weather, OvertakeEvent,
} from '../types'

export interface RaceState {
  drivers: Driver[]
  positions: Position[]       // latest per driver (for live view)
  allPositions: Position[]    // every position record (for replay scrubbing)
  intervals: Interval[]
  laps: Lap[]
  stints: Stint[]
  pits: Pit[]
  raceControl: RaceControl[]
  teamRadio: TeamRadio[]
  weather: Weather | null
  overtakes: OvertakeEvent[]
  positionChanges: Record<number, 'up' | 'down'>
  loading: boolean
  error: string | null
}

// Historical = session ended more than 1 hour ago
function isHistorical(sessionDateEnd: string | null): boolean {
  if (!sessionDateEnd) return false
  return Date.now() - new Date(sessionDateEnd).getTime() > 3600_000
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

const LIVE_POLL = 15000
const HISTORICAL_POLL = 0  // no polling for historical sessions

export function useRaceData(sessionKey: number, sessionDateEnd: string | null = null) {
  const [state, setState] = useState<RaceState>({
    drivers: [], positions: [], allPositions: [], intervals: [], laps: [],
    stints: [], pits: [], raceControl: [], teamRadio: [],
    weather: null, overtakes: [], positionChanges: {},
    loading: true, error: null,
  })

  const prevPositionsRef = useRef<Position[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const params = { session_key: sessionKey }

      // Batch 1: critical display data
      const [drivers, positions, intervals] = await Promise.all([
        openF1.drivers(params),
        openF1.positions(params),
        openF1.intervals(params),
      ])

      // Batch 2: lap/stint/pit data
      const [laps, stints, pits] = await Promise.all([
        openF1.laps(params),
        openF1.stints(params),
        openF1.pits(params),
      ])

      // Batch 3: comms + weather
      const [raceControl, teamRadio, weatherArr] = await Promise.all([
        openF1.raceControl(params),
        openF1.teamRadio(params),
        openF1.weather(params),
      ])

      // Latest position per driver, sorted
      const latestPositions = Object.values(
        positions.reduce<Record<number, Position>>((acc, p) => {
          if (!acc[p.driver_number] || p.date > acc[p.driver_number].date)
            acc[p.driver_number] = p
          return acc
        }, {})
      ).sort((a, b) => a.position - b.position)

      // Latest interval per driver
      const latestIntervals = Object.values(
        intervals.reduce<Record<number, Interval>>((acc, i) => {
          if (!acc[i.driver_number] || i.date > acc[i.driver_number].date)
            acc[i.driver_number] = i
          return acc
        }, {})
      )

      const latestWeather = weatherArr.length
        ? weatherArr.reduce((a, b) => (a.date > b.date ? a : b))
        : null

      const newOvertakes = detectOvertakes(prevPositionsRef.current, latestPositions, laps)

      // Position change indicators
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

      setState(prev => ({
        ...prev,
        drivers, laps, stints, pits, raceControl, teamRadio,
        positions: latestPositions,
        allPositions: positions,  // keep every record for replay
        intervals: latestIntervals,
        weather: latestWeather,
        overtakes: newOvertakes.length
          ? [...prev.overtakes.slice(-50), ...newOvertakes]
          : prev.overtakes,
        positionChanges: Object.keys(changes).length > 0 ? changes : prev.positionChanges,
        loading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
      }))
    }
  }, [sessionKey])

  useEffect(() => {
    fetchAll()
    const interval = isHistorical(sessionDateEnd) ? HISTORICAL_POLL : LIVE_POLL
    if (interval > 0) {
      pollRef.current = setInterval(fetchAll, interval)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
    }
  }, [fetchAll, sessionDateEnd])

  return state
}
