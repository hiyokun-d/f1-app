import { useRef, useState, useEffect, useMemo } from 'react'
import type { Position, Interval, Lap, Stint, Pit, CarData } from '../types'
import type { TrackPoint, LivePosition } from './useTrackMap'
import {
  buildArcData, posAtFraction, speedFactorAtFraction,
  getTrackLengthKm, type ArcData,
} from '../utils/trackPhysics'

/** Simulation update rate. 50ms = 20fps, CSS transition set to 80ms for smooth motion. */
const TICK_MS = 50

interface DriverState {
  /** Track progress 0–1 (wraps at 1.0 = lap complete) */
  fraction: number
  /** Base advance per ms (= 1 / avgLapMs), modulated by curvature each tick */
  baseFracPerMs: number
}

/**
 * Physics-based track position simulation.
 *
 * When real GPS location data is unavailable, this hook advances all
 * drivers along the track outline at physically plausible speeds:
 *
 * 1. Initial positions: derived from interval gaps (seconds behind leader)
 *    converted to track fractions using average lap time.
 * 2. Per-tick speed: base (1 lap / avgLapTime) × local curvature factor
 *    (fast on straights, slow in corners).
 * 3. Selected driver calibration: when real car telemetry (speed km/h) is
 *    available, it blends with the profile to match actual velocity.
 * 4. Pit lane: drivers currently in pit remain stationary.
 * 5. Compound variation: SOFT +0.7%, HARD −0.7%, Inters/Wet proportionally slower.
 *
 * Returns [] when `active` is false so callers can safely swap to GPS data.
 */
export function useSimulatedPositions(
  outline: TrackPoint[],
  positions: Position[],
  intervals: Interval[],
  laps: Lap[],
  stints: Stint[],
  pits: Pit[],
  carLatest: CarData | null,
  selectedDriver: number | null,
  circuitHaystack: string,
  active: boolean,
  /** False = race not yet started; park drivers at starting grid fractions */
  raceStarted: boolean,
): LivePosition[] {
  const [output, setOutput] = useState<LivePosition[]>([])

  // ── Refs hold always-current values without restarting the tick effect ─────
  const arcDataRef      = useRef<ArcData | null>(null)
  const stateRef        = useRef(new Map<number, DriverState>())
  const pitsRef         = useRef(pits)
  const carRef          = useRef(carLatest)
  const selRef          = useRef(selectedDriver)
  const circuitRef      = useRef(circuitHaystack)
  const posRef          = useRef(positions)
  const intRef          = useRef(intervals)
  const lapRef          = useRef(laps)
  const stintRef        = useRef(stints)
  const raceStartedRef  = useRef(raceStarted)
  const initedRef       = useRef(false)
  const lastTickRef     = useRef(0)

  pitsRef.current       = pits
  carRef.current        = carLatest
  selRef.current        = selectedDriver
  circuitRef.current    = circuitHaystack
  raceStartedRef.current = raceStarted
  posRef.current    = positions
  intRef.current    = intervals
  lapRef.current    = laps
  stintRef.current  = stints

  // Rebuild arc data whenever outline changes → triggers re-init
  const arcData = useMemo(
    () => (outline.length >= 2 ? buildArcData(outline) : null),
    [outline],
  )
  useEffect(() => {
    arcDataRef.current = arcData
    initedRef.current  = false
  }, [arcData])

  // Re-init when race starts (grid → racing positions)
  useEffect(() => {
    initedRef.current = false
  }, [raceStarted])

  // ── Tick loop (only depends on active + outline identity) ─────────────────
  useEffect(() => {
    if (!active) {
      setOutput([])
      return
    }

    lastTickRef.current = performance.now()

    const tick = () => {
      const now = performance.now()
      // Cap delta so tab switching / suspend doesn't teleport cars
      const dt = Math.min(now - lastTickRef.current, 250)
      lastTickRef.current = now

      const arc = arcDataRef.current
      if (!arc || outline.length < 2) return

      // ── One-time init: place drivers on track ────────────────────────────
      if (!initedRef.current) {
        const sorted = [...posRef.current].sort((a, b) => a.position - b.position)
        if (!sorted.length) return

        const newState = new Map<number, DriverState>()

        if (!raceStartedRef.current) {
          // ── Pre-race: park at starting grid fractions ─────────────────────
          // P1 at fraction 0.0, spaced 0.002 apart (~10m on a 5km circuit)
          for (const pos of sorted) {
            newState.set(pos.driver_number, {
              fraction: (pos.position - 1) * 0.002,
              baseFracPerMs: 0,  // stationary
            })
          }
        } else {
          // ── Race started: gap-based positioning ───────────────────────────
          const validLaps = lapRef.current
            .filter(l => l.lap_duration != null && l.lap_duration > 50 && l.lap_duration < 200)
            .sort((a, b) => b.lap_number - a.lap_number)
            .slice(0, 20)
          const avgLapMs = validLaps.length
            ? (validLaps.reduce((s, l) => s + l.lap_duration!, 0) / validLaps.length) * 1000
            : 90_000
          const avgLapSec  = avgLapMs / 1000
          const leaderFrac = 0.3
          const gapMap     = new Map(intRef.current.map(iv => [iv.driver_number, iv.gap_to_leader]))

          for (const pos of sorted) {
            const dn     = pos.driver_number
            const rawGap = gapMap.get(dn)
            const gapSec = rawGap != null ? rawGap : (pos.position - 1) * 1.5
            const fracBehind = (gapSec % avgLapSec) / avgLapSec
            const fraction   = ((leaderFrac - fracBehind) % 1 + 1) % 1

            const stint = stintRef.current
              .filter(s => s.driver_number === dn)
              .reduce<Stint | undefined>(
                (best, s) => (!best || s.stint_number > best.stint_number ? s : best),
                undefined,
              )
            const compFactor =
              stint?.compound === 'SOFT'         ? 1.007 :
              stint?.compound === 'HARD'         ? 0.993 :
              stint?.compound === 'INTERMEDIATE' ? 0.870 :
              stint?.compound === 'WET'          ? 0.760 : 1.000
            const jitter = 1 + (((dn * 7 + 13) % 11) - 5) * 0.0004

            newState.set(dn, {
              fraction,
              baseFracPerMs: (1 / avgLapMs) * compFactor * jitter,
            })
          }
        }

        stateRef.current  = newState
        initedRef.current = true
        return  // skip advancing on init tick
      }

      // Pre-race: just output current parked positions (no advance)
      if (!raceStartedRef.current) {
        const arc = arcDataRef.current
        if (!arc) return
        const result: LivePosition[] = []
        for (const [dn, state] of stateRef.current) {
          const pt = posAtFraction(state.fraction, outline, arc)
          result.push({ driverNumber: dn, x: pt.x, y: pt.y })
        }
        setOutput(result)
        return
      }

      // ── Build current pit set ─────────────────────────────────────────────
      const latestPit = new Map<number, Pit>()
      for (const p of pitsRef.current) {
        const cur = latestPit.get(p.driver_number)
        if (!cur || p.lap_number > cur.lap_number) latestPit.set(p.driver_number, p)
      }
      const pitSet = new Set(
        [...latestPit.entries()]
          .filter(([, p]) => p.pit_duration === null)
          .map(([dn]) => dn),
      )

      const trackKm = getTrackLengthKm(circuitRef.current)
      const car     = carRef.current
      const selDn   = selRef.current
      const result: LivePosition[] = []

      for (const [dn, state] of stateRef.current) {
        // Pit-lane cars don't advance (they're stopped/slow in box)
        if (pitSet.has(dn)) {
          const pt = posAtFraction(state.fraction, outline, arc)
          result.push({ driverNumber: dn, x: pt.x, y: pt.y })
          continue
        }

        // Local speed = base × curvature factor at current position
        const curvFactor = speedFactorAtFraction(state.fraction, arc)
        let speed = state.baseFracPerMs * curvFactor

        // For selected driver blend actual telemetry speed into the profile.
        // 60/40 blend dampens instantaneous spikes while keeping it accurate.
        if (dn === selDn && car && car.speed > 0) {
          // car.speed is km/h; convert to fractions/ms using known track length
          const actualFrac = car.speed / (trackKm * 3_600_000)
          speed = 0.60 * actualFrac + 0.40 * (state.baseFracPerMs * curvFactor)
        }

        state.fraction = (state.fraction + speed * dt) % 1
        const pt = posAtFraction(state.fraction, outline, arc)
        result.push({ driverNumber: dn, x: pt.x, y: pt.y })
      }

      if (result.length > 0) setOutput(result)
    }

    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, outline])

  return active ? output : []
}
