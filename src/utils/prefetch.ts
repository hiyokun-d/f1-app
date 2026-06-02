import { openF1, markSessionCachePermanent } from '../api/openf1'

const noop = () => {}

/**
 * Warms the API cache for a session before the user navigates to it.
 *
 * All important endpoints are awaited through the serial queue so that when
 * Race.tsx mounts and hooks fire, every request is a cache hit — no extra
 * API calls, no 429 risk.
 *
 * For historical sessions the cache entries are marked permanent (Infinity TTL)
 * because historical data never changes.
 */
export async function prefetchRaceData(sessionKey: number): Promise<void> {
  const params = { session_key: sessionKey }

  // Fetch session metadata first — needed to detect historical + location window
  const sessions = await openF1.sessions({ session_key: sessionKey }).catch(() => [])
  const session = sessions[0] ?? null

  const historical = session?.date_end
    ? Date.now() - new Date(session.date_end).getTime() > 3_600_000
    : false

  // ── Critical data — await all before Race.tsx is likely to mount ─────────
  // All calls go through the serial queue (800ms gaps) so no burst of requests.
  await Promise.all([
    openF1.drivers(params).catch(noop),
    openF1.positions(params).catch(noop),
    openF1.intervals(params).catch(noop),
  ])

  // ── Secondary important data ─────────────────────────────────────────────
  await Promise.all([
    openF1.laps(params).catch(noop),
    openF1.stints(params).catch(noop),
    openF1.pits(params).catch(noop),
    openF1.sessionResult(params).catch(noop),
  ])

  // ── Non-critical background data ─────────────────────────────────────────
  // Fire these without awaiting — they'll populate the cache while the user
  // views the loading screen.
  openF1.raceControl(params).catch(noop)
  openF1.teamRadio(params).catch(noop)
  openF1.weather(params).catch(noop)

  // Prefetch last-15s GPS positions so useTrackMap.pollPositions is a cache hit
  if (historical && session?.date_end) {
    const posEnd = new Date(session.date_end)
    openF1.location({
      session_key: sessionKey,
      'date>': new Date(posEnd.getTime() - 15_000).toISOString(),
      'date<': posEnd.toISOString(),
    }).catch(noop)
  }

  // ── Track location prefetch ───────────────────────────────────────────────
  if (session?.date_start) {
    const locationParams: Parameters<typeof openF1.location>[0] = {
      session_key: sessionKey,
    }
    if (historical && session.date_start) {
      const start = new Date(session.date_start)
      locationParams['date>'] = start.toISOString()
      locationParams['date<'] = new Date(start.getTime() + 600_000).toISOString()
    } else {
      locationParams['date>'] = new Date(Date.now() - 600_000).toISOString()
    }
    openF1.location(locationParams).catch(noop)
  }

  // ── Mark historical cache entries as permanent ────────────────────────────
  // Historical data never changes — no point re-fetching on back-navigation.
  if (historical) {
    // Small delay so in-flight requests have time to settle into the cache
    setTimeout(() => markSessionCachePermanent(sessionKey), 2000)
  }
}
