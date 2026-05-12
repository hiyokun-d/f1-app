import { useState, useEffect } from 'react'
import axios from 'axios'

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string | null
  circuit_short_name: string
  country_name: string
  country_code: string
  meeting_name: string
  year: number
  location: string
}

interface SessionState {
  nextSession: OpenF1Session | null
  recentRaces: OpenF1Session[]
  liveSession: OpenF1Session | null
  loading: boolean
}

export function useNextSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    nextSession: null,
    recentRaces: [],
    liveSession: null,
    loading: true,
  })

  useEffect(() => {
    const year = new Date().getFullYear()

    axios
      .get<OpenF1Session[]>(`https://api.openf1.org/v1/sessions?year=${year}`, { timeout: 12000 })
      .then(res => {
        const sessions = res.data
        const now = new Date()

        const live =
          sessions.find(s => {
            const start = new Date(s.date_start)
            const end = s.date_end
              ? new Date(s.date_end)
              : new Date(start.getTime() + 2.5 * 3_600_000)
            return now >= start && now <= end
          }) ?? null

        const upcoming = sessions
          .filter(s => new Date(s.date_start) > now)
          .sort((a, b) => +new Date(a.date_start) - +new Date(b.date_start))

        const recent = sessions
          .filter(s => s.session_type === 'Race' && new Date(s.date_end ?? s.date_start) < now)
          .sort((a, b) => +new Date(b.date_start) - +new Date(a.date_start))
          .slice(0, 8)

        setState({
          nextSession: upcoming[0] ?? null,
          recentRaces: recent,
          liveSession: live,
          loading: false,
        })
      })
      .catch(() => setState(s => ({ ...s, loading: false })))
  }, [])

  return state
}
