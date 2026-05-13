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
    // Keep > and < literal in keys (OpenF1 uses e.g. date>2024-01-01, not date%3E...)
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

// ── Response cache (60s TTL) ──────────────────────────────────────────
// Prevents React Strict Mode double-mounts and back-navigation from
// re-hitting the 30 req/min limit with duplicate requests.
const CACHE = new Map<string, { data: unknown[]; expiry: number }>()
const CACHE_TTL = 60_000

function cacheKey(path: string, params?: Record<string, unknown>) {
  return `${path}|${params ? JSON.stringify(params) : ''}`
}

// ── Global serial request queue ───────────────────────────────────────
// 30 req/min = ~2s/req budget. We use 800ms gap — fast enough to load
// 12 requests in ~10s, slow enough to stay comfortably under the limit.
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
  return enqueue(async () => {
    try {
      const { data } = await api.get<T[]>(path, { params })
      CACHE.set(key, { data, expiry: Date.now() + CACHE_TTL })
      return data
    } catch (err) {
      // OpenF1 returns 404 when a query matches no records — treat as empty
      if (axios.isAxiosError(err) && err.response?.status === 404) return []
      throw err
    }
  })
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
