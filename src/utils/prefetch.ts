import { openF1 } from '../api/openf1'

const noop = () => {}

/**
 * Warms the API cache for a session before the user navigates to it.
 * Call fire-and-forget — results are discarded; the cache does the work.
 * When the Race page mounts and hooks run, they hit the cache instead of the network.
 */
export async function prefetchRaceData(sessionKey: number): Promise<void> {
  const params = { session_key: sessionKey }

  // Get session first so we have dates for the location prefetch
  const sessions = await openF1.sessions({ session_key: sessionKey }).catch(() => [])
  const session = sessions[0] ?? null

  // Enqueue all race data endpoints — they run through the queue and cache themselves
  openF1.drivers(params).catch(noop)
  openF1.positions(params).catch(noop)
  openF1.intervals(params).catch(noop)
  openF1.laps(params).catch(noop)
  openF1.stints(params).catch(noop)
  openF1.pits(params).catch(noop)
  openF1.raceControl(params).catch(noop)
  openF1.teamRadio(params).catch(noop)
  openF1.weather(params).catch(noop)
  openF1.sessionResult(params).catch(noop)

  // Prefetch track outline if we have session dates
  if (session?.date_start && session?.date_end) {
    const historical = Date.now() - new Date(session.date_end).getTime() > 3_600_000
    const locationParams: Parameters<typeof openF1.location>[0] = {
      session_key: sessionKey,
    }
    if (historical) {
      const start = new Date(session.date_start)
      locationParams['date>'] = start.toISOString()
      locationParams['date<'] = new Date(start.getTime() + 600_000).toISOString()
    } else {
      locationParams['date>'] = new Date(Date.now() - 600_000).toISOString()
    }
    openF1.location(locationParams).catch(noop)
  }
}
