import { useState, useEffect } from 'react'
import { openF1 } from '../api/openf1'
import type { Session } from '../types'

export function useSession(sessionKey: number) {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    openF1.sessions({ session_key: sessionKey })
      .then(res => { if (res[0]) setSession(res[0]) })
      .catch(() => {})
  }, [sessionKey])
  return session
}
