import { useState, useEffect, useRef, useCallback } from 'react'
import { openF1 } from '../api/openf1'
import type { CarData } from '../types'

export interface CarDataState {
  latest: CarData | null
  history: CarData[]
}

function isHistorical(sessionDateEnd: string | null): boolean {
  if (!sessionDateEnd) return false
  return Date.now() - new Date(sessionDateEnd).getTime() > 3600_000
}

export function useCarData(
  sessionKey: number,
  driverNumber: number | null,
  sessionDateEnd: string | null = null,
) {
  const [state, setState] = useState<CarDataState>({ latest: null, history: [] })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    if (driverNumber === null) return
    try {
      const historical = isHistorical(sessionDateEnd)
      const params: Parameters<typeof openF1.carData>[0] = {
        session_key: sessionKey,
        driver_number: driverNumber,
      }

      if (historical && sessionDateEnd) {
        // Get the final minute of the session for historical replay
        const sessionEnd = new Date(sessionDateEnd)
        const windowStart = new Date(sessionEnd.getTime() - 60000).toISOString()
        params['date>'] = windowStart
        params['date<'] = sessionEnd.toISOString()
      } else {
        // Live: last 30 seconds
        params['date>'] = new Date(Date.now() - 30000).toISOString()
      }

      const results = await openF1.carData(params)
      if (results.length) {
        setState({
          latest: results[results.length - 1],
          history: results.slice(-60),
        })
      }
    } catch { /* silent */ }
  }, [sessionKey, driverNumber, sessionDateEnd])

  useEffect(() => {
    if (driverNumber === null) {
      setState({ latest: null, history: [] })
      return
    }
    fetchData()
    // Historical sessions don't need re-polling (data won't change)
    if (!isHistorical(sessionDateEnd)) {
      intervalRef.current = setInterval(fetchData, 8000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData, driverNumber, sessionDateEnd])

  return state
}
