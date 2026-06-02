import axios from 'axios'
import type {
  Meeting, Session, Driver, Position, Interval,
  Lap, Stint, Pit, CarData, Location,
  RaceControl, TeamRadio, Weather,
} from '../types'

const api = axios.create({
  baseURL: 'https://api.openf1.org/v1',
  timeout: 20000,
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) =>
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&'),
  },
})

// ── 429 retry interceptor ─────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 429 && !err.config.__retried) {
      const wait = Number(err.response.headers['retry-after'] ?? 12) * 1000
      await new Promise(r => setTimeout(r, wait))
      err.config.__retried = true
      return api.request(err.config)
    }
    return Promise.reject(err)
  }
)

// ── Response cache (60s TTL for live; Infinity for historical) ────────
const CACHE = new Map<string, { data: unknown[]; expiry: number }>()
const CACHE_TTL = 60_000

function cacheKey(path: string, params?: Record<string, unknown>) {
  return `${path}|${params ? JSON.stringify(params) : ''}`
}

/**
 * After fetching historical session data, mark all cached entries for
 * that session as permanent (Infinity TTL) — historical data never changes.
 */
export function markSessionCachePermanent(sessionKey: number) {
  const needle = `session_key":${sessionKey}`
  for (const [key, entry] of CACHE.entries()) {
    if (key.includes(needle)) entry.expiry = Infinity
  }
}

// ── In-flight dedup ───────────────────────────────────────────────────
// If prefetch and a hook both call the same endpoint before the first
// request resolves, they share one promise → one actual API call.
const INFLIGHT = new Map<string, Promise<unknown[]>>()

// ── Global serial request queue ───────────────────────────────────────
// 30 req/min = ~2s/req budget. 800ms gap keeps us well under the limit.
const QUEUE_GAP = 800
const queue: Array<() => void> = []
let draining = false

function drain() {
  if (draining || !queue.length) return
  draining = true
  const task = queue.shift()!
  task()
  setTimeout(() => { draining = false; drain() }, QUEUE_GAP)
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject))
    drain()
  })
}

const get = <T>(path: string, params?: Record<string, unknown>): Promise<T[]> => {
  const key = cacheKey(path, params)
  const cached = CACHE.get(key)
  if (cached && cached.expiry > Date.now()) return Promise.resolve(cached.data as T[])

  // Return existing in-flight promise instead of enqueuing a duplicate request
  const inflight = INFLIGHT.get(key)
  if (inflight) return inflight as Promise<T[]>

  const promise = enqueue(async () => {
    // Re-check cache in case it was populated while we waited in the queue
    const hit = CACHE.get(key)
    if (hit && hit.expiry > Date.now()) return hit.data as T[]
    try {
      const { data } = await api.get<T[]>(path, { params })
      CACHE.set(key, { data, expiry: Date.now() + CACHE_TTL })
      return data
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        CACHE.set(key, { data: [], expiry: Date.now() + CACHE_TTL })
        return []
      }
      throw err
    }
  }).finally(() => {
    INFLIGHT.delete(key)
  })

  INFLIGHT.set(key, promise as Promise<unknown[]>)
  return promise
}

// ── Endpoints ─────────────────────────────────────────────────────────

export const openF1 = {
  meetings: (params?: { year?: number; meeting_key?: number }) =>
    get<Meeting>('/meetings', params),

  sessions: (params?: { meeting_key?: number; session_key?: number; session_type?: string; year?: number; country_name?: string; session_name?: string }) =>
    get<Session>('/sessions', params),

  drivers: (params?: { session_key?: number; driver_number?: number }) =>
    get<Driver>('/drivers', params),

  positions: (params?: { session_key?: number; driver_number?: number; 'date>'?: string }) =>
    get<Position>('/position', params as Record<string, unknown>),

  intervals: (params?: { session_key?: number; driver_number?: number; 'date>'?: string }) =>
    get<Interval>('/intervals', params as Record<string, unknown>),

  laps: (params?: { session_key?: number; driver_number?: number; lap_number?: number }) =>
    get<Lap>('/laps', params),

  stints: (params?: { session_key?: number; driver_number?: number }) =>
    get<Stint>('/stints', params),

  pits: (params?: { session_key?: number; driver_number?: number }) =>
    get<Pit>('/pit', params),

  carData: (params?: { session_key?: number; driver_number?: number; 'date>'?: string; 'date<'?: string }) =>
    get<CarData>('/car_data', params as Record<string, unknown>),

  location: (params?: { session_key?: number; driver_number?: number; 'date>'?: string; 'date<'?: string }) =>
    get<Location>('/location', params as Record<string, unknown>),

  raceControl: (params?: { session_key?: number; flag?: string }) =>
    get<RaceControl>('/race_control', params),

  teamRadio: (params?: { session_key?: number; driver_number?: number }) =>
    get<TeamRadio>('/team_radio', params),

  weather: (params?: { session_key?: number; meeting_key?: number }) =>
    get<Weather>('/weather', params),

  sessionResult: (params?: { session_key?: number; driver_number?: number }) =>
    get<import('../types').SessionResult>('/session_result', params),

  overtakes: (params?: { session_key?: number }) =>
    get<import('../types').Overtake>('/overtakes', params),

  startingGrid: (params?: { session_key?: number }) =>
    get<import('../types').StartingGrid>('/starting_grid', params),

  championshipDrivers: (params?: { session_key?: number; driver_number?: number }) =>
    get<import('../types').ChampionshipDriver>('/championship_drivers', params),

  championshipTeams: (params?: { session_key?: number }) =>
    get<import('../types').ChampionshipTeam>('/championship_teams', params),
}
