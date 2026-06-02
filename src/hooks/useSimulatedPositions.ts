import { useRef, useState, useEffect, useMemo } from 'react'
import type { Position, Interval, Lap, Stint, Pit, CarData } from '../types'
import type { TrackPoint, LivePosition } from './useTrackMap'
import {
  buildArcData, posAtFraction, speedFactorAtFraction,
  getTrackLengthKm, type ArcData,
} from '../utils/trackPhysics'

/** Simulation update rate. 50ms = 20fps, CSS transition set to 80ms for smooth motion. */
const TICK_MS = 50

/**
 * Proportional correction rate: 8% of position error corrected per second.
 * Prevents drift from reality without causing visible teleporting.
 */
const ANCHOR_RATE = 0.08

interface DriverState {
  fraction: number
  baseFracPerMs: number
}

/**
 * Field-median lap time in ms.
 * IQR-based filter removes SC laps: keeps laps within [p25*0.9, p75*1.2].
 * Much tighter than the old < 200s cap which included 160s SC laps.
 */
function computeFieldAvgMs(laps: Lap[]): number {
  const raw = laps
    .filter(l => l.lap_duration != null && l.lap_duration > 50 && l.lap_duration < 200 && !l.is_pit_out_lap)
    .map(l => l.lap_duration!)
  if (!raw.length) return 90_000
  const sorted = [...raw].sort((a, b) => a - b)
  const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? sorted[0]
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1]
  const racing = raw.filter(d => d >= p25 * 0.9 && d <= p75 * 1.2)
  const avg = racing.length
    ? racing.reduce((a, b) => a + b, 0) / racing.length
    : sorted[Math.floor(sorted.length / 2)]
  return avg * 1000
}

/**
 * Per-driver average lap time in ms using their own recent racing laps.
 * Falls back to fieldMs if not enough data.
 * Filters laps to within ±15% of field avg to exclude their SC/formation laps.
 */
function computeDriverLapMs(dn: number, laps: Lap[], fieldMs: number): number {
  const fieldS = fieldMs / 1000
  const dl = laps
    .filter(l =>
      l.driver_number === dn &&
      l.lap_duration != null &&
      !l.is_pit_out_lap &&
      l.lap_duration > fieldS * 0.85 &&
      l.lap_duration < fieldS * 1.15,
    )
    .sort((a, b) => b.lap_number - a.lap_number)
    .slice(0, 8)
  if (!dl.length) return fieldMs
  return (dl.reduce((s, l) => s + l.lap_duration!, 0) / dl.length) * 1000
}

/**
 * Physics-based track position simulation.
 *
 * When real GPS location data is unavailable, this hook advances all
 * drivers along the track outline at physically plausible speeds:
 *
 * 1. Initial positions: derived from interval gaps (seconds behind leader)
 *    converted to track fractions using average lap time.
 * 2. Per-tick speed: base (1 lap / driverAvgLapTime) × local curvature factor.
 *    Each driver uses THEIR OWN recent lap times — faster drivers move faster.
 * 3. SC-filtered lap times: IQR filter excludes safety car laps so the baseline
 *    reflects true racing pace.
 * 4. Interval re-anchoring: when gap_to_leader data updates, a 8%/s proportional
 *    correction nudges drivers toward their true position without teleporting.
 * 5. Selected driver calibration: real car telemetry (speed km/h) blended in.
 * 6. Pit lane: drivers currently in pit remain stationary.
 * 7. Compound variation: SOFT +0.7%, HARD −0.7%, Inters/Wet proportionally slower.
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

  const arcDataRef      = useRef<ArcData | null>(null)
  const stateRef        = useRef(new Map<number, DriverState>())
  // target fractions derived from latest interval data; corrected toward each tick
  const targetFracRef   = useRef(new Map<number, number>())
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
  const prevIntRef      = useRef<Interval[]>(intervals)

  pitsRef.current        = pits
  carRef.current         = carLatest
  selRef.current         = selectedDriver
  circuitRef.current     = circuitHaystack
  raceStartedRef.current = raceStarted
  posRef.current         = positions
  intRef.current         = intervals
  lapRef.current         = laps
  stintRef.current       = stints

  const arcData = useMemo(
    () => (outline.length >= 2 ? buildArcData(outline) : null),
    [outline],
  )
  useEffect(() => {
    arcDataRef.current = arcData
    initedRef.current  = false
  }, [arcData])

  useEffect(() => { initedRef.current = false }, [raceStarted])

  useEffect(() => {
    if (!active) {
      setOutput([])
      return
    }

    lastTickRef.current = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(now - lastTickRef.current, 250)
      lastTickRef.current = now

      const arc = arcDataRef.current
      if (!arc || outline.length < 2) return

      // ── One-time init: place drivers on track ──────────────────────────────
      if (!initedRef.current) {
        const sorted = [...posRef.current].sort((a, b) => a.position - b.position)
        if (!sorted.length) return

        const newState = new Map<number, DriverState>()

        if (!raceStartedRef.current) {
          for (const pos of sorted) {
            newState.set(pos.driver_number, {
              fraction: (pos.position - 1) * 0.002,
              baseFracPerMs: 0,
            })
          }
        } else {
          const fieldMs  = computeFieldAvgMs(lapRef.current)
          const fieldSec = fieldMs / 1000
          const leaderFrac = 0.3
          const gapMap = new Map(intRef.current.map(iv => [iv.driver_number, iv.gap_to_leader]))

          for (const pos of sorted) {
            const dn      = pos.driver_number
            const rawGap  = gapMap.get(dn)
            const gapSec  = rawGap != null ? rawGap : (pos.position - 1) * 1.5
            const fracBehind = (gapSec % fieldSec) / fieldSec
            const fraction   = ((leaderFrac - fracBehind) % 1 + 1) % 1

            const driverMs = computeDriverLapMs(dn, lapRef.current, fieldMs)

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
              baseFracPerMs: (1 / driverMs) * compFactor * jitter,
            })
          }
        }

        stateRef.current  = newState
        initedRef.current = true
        return
      }

      // Pre-race: output parked grid positions, no advance
      if (!raceStartedRef.current) {
        const result: LivePosition[] = []
        for (const [dn, state] of stateRef.current) {
          const pt = posAtFraction(state.fraction, outline, arc)
          result.push({ driverNumber: dn, x: pt.x, y: pt.y })
        }
        setOutput(result)
        return
      }

      // ── Re-anchor targets when interval data updates ───────────────────────
      const currentInt = intRef.current
      if (currentInt !== prevIntRef.current) {
        prevIntRef.current = currentInt
        const sorted     = [...posRef.current].sort((a, b) => a.position - b.position)
        const leaderDn   = sorted[0]?.driver_number
        const leaderFrac = stateRef.current.get(leaderDn ?? -1)?.fraction ?? 0.3
        const fieldMs    = computeFieldAvgMs(lapRef.current)
        const fieldSec   = fieldMs / 1000
        const gapMap     = new Map(currentInt.map(iv => [iv.driver_number, iv.gap_to_leader]))

        for (const pos of sorted) {
          const dn      = pos.driver_number
          const rawGap  = gapMap.get(dn)
          const gapSec  = rawGap != null ? rawGap : (pos.position - 1) * 1.5
          const fracBehind = (gapSec % fieldSec) / fieldSec
          const target     = ((leaderFrac - fracBehind) % 1 + 1) % 1
          targetFracRef.current.set(dn, target)
        }

        // Also update per-driver base speeds with latest lap data
        const lapData = lapRef.current
        for (const [dn, state] of stateRef.current) {
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
          const driverMs = computeDriverLapMs(dn, lapData, fieldMs)
          state.baseFracPerMs = (1 / driverMs) * compFactor * jitter
        }
      }

      // ── Build current pit set ──────────────────────────────────────────────
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
        if (pitSet.has(dn)) {
          const pt = posAtFraction(state.fraction, outline, arc)
          result.push({ driverNumber: dn, x: pt.x, y: pt.y })
          continue
        }

        const curvFactor = speedFactorAtFraction(state.fraction, arc)
        let speed = state.baseFracPerMs * curvFactor

        // Selected driver: blend actual telemetry speed into profile (60/40)
        if (dn === selDn && car && car.speed > 0) {
          const actualFrac = car.speed / (trackKm * 3_600_000)
          speed = 0.60 * actualFrac + 0.40 * (state.baseFracPerMs * curvFactor)
        }

        state.fraction = (state.fraction + speed * dt) % 1

        // Soft-nudge toward interval-derived target (proportional, 8%/sec)
        const target = targetFracRef.current.get(dn)
        if (target != null) {
          let diff = target - state.fraction
          if (diff > 0.5) diff -= 1
          if (diff < -0.5) diff += 1
          if (Math.abs(diff) > 0.0005) {
            state.fraction = ((state.fraction + diff * ANCHOR_RATE * (dt / 1000)) % 1 + 1) % 1
          }
        }

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
