import type { TrackPoint } from '../hooks/useTrackMap'

// Known F1 circuit lengths (km), matched by substring against "circuitShortName location"
const TRACK_LENGTHS: [string, number][] = [
  ['bahrain', 5.412],
  ['jeddah', 6.174],
  ['saudi', 6.174],
  ['albert park', 5.278],
  ['melbourne', 5.278],
  ['suzuka', 5.807],
  ['shanghai', 5.451],
  ['miami', 5.412],
  ['imola', 4.909],
  ['monaco', 3.337],
  ['barcelona', 4.675],
  ['catalunya', 4.675],
  ['montreal', 4.361],
  ['villeneuve', 4.361],
  ['red bull ring', 4.318],
  ['spielberg', 4.318],
  ['silverstone', 5.891],
  ['hungaroring', 4.381],
  ['budapest', 4.381],
  ['spa', 7.004],
  ['zandvoort', 4.259],
  ['monza', 5.793],
  ['baku', 6.003],
  ['azerbaijan', 6.003],
  ['marina bay', 4.940],
  ['singapore', 4.940],
  ['americas', 5.513],
  ['cota', 5.513],
  ['austin', 5.513],
  ['hermanos rodriguez', 4.304],
  ['mexico', 4.304],
  ['interlagos', 4.309],
  ['sao paulo', 4.309],
  ['brazil', 4.309],
  ['las vegas', 6.201],
  ['lusail', 5.380],
  ['qatar', 5.380],
  ['yas marina', 5.281],
  ['abu dhabi', 5.281],
]

export function getTrackLengthKm(haystack: string): number {
  const h = haystack.toLowerCase()
  for (const [key, km] of TRACK_LENGTHS) {
    if (h.includes(key)) return km
  }
  return 5.3 // F1 average
}

export interface ArcData {
  /** Cumulative arc length at each outline point, in SVG pixels */
  arcLengths: number[]
  totalArc: number
  /**
   * Normalized speed factor per point.
   * Derived from track curvature: straights > 1.0, hairpins < 1.0.
   * Mean of all factors = 1.0, so a car using speedFactors completes
   * exactly one lap per baseFracPerMs * totalArc ms on average.
   */
  speedFactors: number[]
}

export function buildArcData(outline: TrackPoint[]): ArcData {
  const n = outline.length
  if (n < 2) return { arcLengths: [0], totalArc: 0, speedFactors: [1] }

  // ── Cumulative arc lengths ─────────────────────────────────────────────
  const arcLengths = new Array<number>(n)
  arcLengths[0] = 0
  for (let i = 1; i < n; i++) {
    const dx = outline[i].x - outline[i - 1].x
    const dy = outline[i].y - outline[i - 1].y
    arcLengths[i] = arcLengths[i - 1] + Math.hypot(dx, dy)
  }
  const totalArc = arcLengths[n - 1]

  // ── Curvature via cross-product of adjacent segment vectors ───────────
  const rawCurv = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const dx1 = outline[i].x - outline[i - 1].x, dy1 = outline[i].y - outline[i - 1].y
    const dx2 = outline[i + 1].x - outline[i].x,  dy2 = outline[i + 1].y - outline[i].y
    const l1 = Math.hypot(dx1, dy1) || 1
    const l2 = Math.hypot(dx2, dy2) || 1
    // |cross| / (l1*l2) = sin(turning angle) ≈ curvature for small angles
    rawCurv[i] = Math.abs(dx1 * dy2 - dy1 * dx2) / (l1 * l2)
  }

  // ── Gaussian smooth (5-tap, σ≈1) — removes GPS noise spikes ──────────
  const kernel = [0.06, 0.24, 0.40, 0.24, 0.06]
  const smooth = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = -2; k <= 2; k++) {
      s += rawCurv[Math.max(0, Math.min(n - 1, i + k))] * kernel[k + 2]
    }
    smooth[i] = s
  }

  // ── Speed factor: 1/(1 + K·curvature), then normalize mean → 1.0 ─────
  // K=14 gives roughly 0.3 (hairpin) to ~1.4 (full straight), matching
  // real F1 speed profiles where corner speeds are ~30–35% of max.
  const K = 14
  const raw = smooth.map(c => 1 / (1 + K * c))
  const mean = raw.reduce((a, b) => a + b, 0) / n || 1
  const speedFactors = raw.map(f => f / mean)

  return { arcLengths, totalArc, speedFactors }
}

/**
 * Interpolate a point on the track outline at the given fraction (0–1).
 * Wraps around using modulo.
 */
export function posAtFraction(
  fraction: number,
  outline: TrackPoint[],
  arcData: ArcData,
): TrackPoint {
  const { arcLengths, totalArc } = arcData
  const n = outline.length
  if (n < 2 || totalArc === 0) return outline[0] ?? { x: 0, y: 0 }

  const target = ((fraction % 1) + 1) % 1 * totalArc

  // Binary search for the segment containing `target`
  let lo = 0, hi = n - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (arcLengths[mid] <= target) lo = mid
    else hi = mid
  }
  const segLen = (arcLengths[hi] - arcLengths[lo]) || 1
  const t = Math.max(0, Math.min(1, (target - arcLengths[lo]) / segLen))
  return {
    x: outline[lo].x + t * (outline[hi].x - outline[lo].x),
    y: outline[lo].y + t * (outline[hi].y - outline[lo].y),
  }
}

/** Local speed multiplier at the given track fraction (interpolated from ArcData). */
export function speedFactorAtFraction(fraction: number, arcData: ArcData): number {
  const { arcLengths, totalArc, speedFactors } = arcData
  const n = arcLengths.length
  if (n < 2) return 1

  const target = ((fraction % 1) + 1) % 1 * totalArc
  let lo = 0, hi = n - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (arcLengths[mid] <= target) lo = mid
    else hi = mid
  }
  const segLen = (arcLengths[hi] - arcLengths[lo]) || 1
  const t = Math.max(0, Math.min(1, (target - arcLengths[lo]) / segLen))
  return speedFactors[lo] + t * (speedFactors[hi] - speedFactors[lo])
}

/**
 * Project `pt` onto the nearest outline segment.
 * Returns the snapped point (guaranteed on-track) and its arc fraction (0–1).
 *
 * Used for two things:
 *  1. Keep GPS dots visually on the track line (snap before render)
 *  2. Compute arc fraction so AnimeJS can animate along the outline between polls
 */
export function projectToTrack(
  pt: TrackPoint,
  outline: TrackPoint[],
  arcData: ArcData,
): { snapped: TrackPoint; fraction: number } {
  const { arcLengths, totalArc } = arcData
  const n = outline.length
  if (n < 2 || totalArc === 0) return { snapped: outline[0] ?? pt, fraction: 0 }

  let bestPt: TrackPoint = outline[0]
  let bestFraction = 0
  let bestDist = Infinity

  for (let i = 0; i < n - 1; i++) {
    const a = outline[i], b = outline[i + 1]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2))
    const px = a.x + t * dx, py = a.y + t * dy
    const dist = (pt.x - px) ** 2 + (pt.y - py) ** 2
    if (dist < bestDist) {
      bestDist = dist
      bestPt = { x: px, y: py }
      bestFraction = (arcLengths[i] + t * (arcLengths[i + 1] - arcLengths[i])) / totalArc
    }
  }
  return { snapped: bestPt, fraction: bestFraction }
}
