import { useMemo, useEffect, useRef, useState } from 'react'
import type { Position, Interval, Lap, Pit, Stint, RaceControl, TeamRadio } from '../types'

interface RaceFilterInput {
  positions: Position[]
  allPositions: Position[]
  intervals: Interval[]
  laps: Lap[]
  pits: Pit[]
  stints: Stint[]
  raceControl: RaceControl[]
  teamRadio: TeamRadio[]
}

export interface ReplayFiltered {
  positions: Position[]
  positionChanges: Record<number, 'up' | 'down'>
  intervals: Interval[]
  laps: Lap[]
  pits: Pit[]
  stints: Stint[]
  raceControl: RaceControl[]
  teamRadio: TeamRadio[]
}

export function useReplayFilter(race: RaceFilterInput, replayISO: string | null): ReplayFiltered {
  // ── Positions ─────────────────────────────────────────────────────────────
  const positions = useMemo((): Position[] => {
    if (!replayISO || !race.allPositions.length) return race.positions
    const map: Record<number, Position> = {}
    for (const p of race.allPositions) {
      if (p.date <= replayISO && (!map[p.driver_number] || p.date > map[p.driver_number].date))
        map[p.driver_number] = p
    }
    return Object.values(map).sort((a, b) => a.position - b.position)
  }, [replayISO, race.allPositions, race.positions])

  // ── Position changes (for replay rail animations) ─────────────────────────
  const prevPositionsRef = useRef<Position[]>([])
  const [positionChanges, setPositionChanges] = useState<Record<number, 'up' | 'down'>>({})
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevPositionsRef.current
    if (prev.length > 0) {
      const prevMap = new Map(prev.map(p => [p.driver_number, p.position]))
      const changes: Record<number, 'up' | 'down'> = {}
      for (const p of positions) {
        const old = prevMap.get(p.driver_number)
        if (old !== undefined && old !== p.position)
          changes[p.driver_number] = p.position < old ? 'up' : 'down'
      }
      if (Object.keys(changes).length > 0) {
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        setPositionChanges(changes)
        clearTimerRef.current = setTimeout(() => setPositionChanges({}), 2000)
      }
    }
    prevPositionsRef.current = positions
  }, [positions])

  // ── Intervals ─────────────────────────────────────────────────────────────
  const intervals = useMemo((): Interval[] => {
    if (!replayISO) return race.intervals
    const map: Record<number, Interval> = {}
    for (const iv of race.intervals) {
      if (iv.date <= replayISO && (!map[iv.driver_number] || iv.date > map[iv.driver_number].date))
        map[iv.driver_number] = iv
    }
    return Object.values(map)
  }, [replayISO, race.intervals])

  // ── Laps ─────────────────────────────────────────────────────────────────
  const laps = useMemo(
    () => replayISO ? race.laps.filter(l => l.date_start <= replayISO) : race.laps,
    [replayISO, race.laps],
  )

  // ── Pits ─────────────────────────────────────────────────────────────────
  const pits = useMemo(
    () => replayISO ? race.pits.filter(p => p.date <= replayISO) : race.pits,
    [replayISO, race.pits],
  )

  // ── Stints (only stints where driver has reached lap_start in replay) ─────
  const stints = useMemo(
    () => replayISO
      ? race.stints.filter(s =>
          laps.some(l => l.driver_number === s.driver_number && l.lap_number >= s.lap_start),
        )
      : race.stints,
    [replayISO, race.stints, laps],
  )

  // ── Race control + team radio ─────────────────────────────────────────────
  const raceControl = useMemo(
    () => replayISO ? race.raceControl.filter(r => r.date <= replayISO) : race.raceControl,
    [replayISO, race.raceControl],
  )

  const teamRadio = useMemo(
    () => replayISO ? race.teamRadio.filter(r => r.date <= replayISO) : race.teamRadio,
    [replayISO, race.teamRadio],
  )

  return { positions, positionChanges, intervals, laps, pits, stints, raceControl, teamRadio }
}
