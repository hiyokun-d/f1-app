// Session-level utilities shared across data hooks

export const LIVE_POLL_MS = 15_000
export const HISTORICAL_THRESHOLD_MS = 3_600_000

/** Returns true when the session ended more than 1 hour ago. */
export function isHistorical(sessionDateEnd: string | null): boolean {
  if (!sessionDateEnd) return false
  return Date.now() - new Date(sessionDateEnd).getTime() > HISTORICAL_THRESHOLD_MS
}

/**
 * Reduces an array of per-driver records to the single latest entry per driver,
 * keyed by `driver_number` and compared by `date` string (ISO, lexicographic).
 */
export function latestPerDriver<T extends { driver_number: number; date: string }>(
  arr: T[],
): T[] {
  const map: Record<number, T> = {}
  for (const item of arr) {
    if (!map[item.driver_number] || item.date > map[item.driver_number].date)
      map[item.driver_number] = item
  }
  return Object.values(map)
}
