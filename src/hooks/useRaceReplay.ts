import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

export const SPEEDS = [1, 5, 15, 30, 60] as const
export type PlaybackSpeed = typeof SPEEDS[number]

export interface ReplayState {
  replayTime: Date | null
  isPlaying: boolean
  speed: PlaybackSpeed
  progress: number           // 0–1
  elapsedSeconds: number     // seconds from session start
  totalSeconds: number
}

export interface ReplayControls {
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (progress: number) => void  // 0–1
  setSpeed: (s: PlaybackSpeed) => void
}

const TICK_MS = 250  // update every 250ms — 4fps is smooth enough for replay scrubbing

export function useRaceReplay(
  sessionDateStart: string | null,
  sessionDateEnd: string | null,
): ReplayState & ReplayControls {
  const [replayTime, setReplayTime] = useState<Date | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(30)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sessionStart = sessionDateStart ? new Date(sessionDateStart) : null
  const sessionEnd = sessionDateEnd ? new Date(sessionDateEnd) : null
  const totalSeconds = sessionStart && sessionEnd
    ? (sessionEnd.getTime() - sessionStart.getTime()) / 1000
    : 0

  // Initialise replay to session start when session loads
  useEffect(() => {
    if (sessionStart && !replayTime) {
      setReplayTime(new Date(sessionStart))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDateStart])

  // Playback tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (!isPlaying || !sessionStart || !sessionEnd) return

    tickRef.current = setInterval(() => {
      setReplayTime(prev => {
        if (!prev) return sessionStart
        const next = new Date(prev.getTime() + speed * TICK_MS)
        if (next >= sessionEnd) {
          setIsPlaying(false)
          return new Date(sessionEnd)
        }
        return next
      })
    }, TICK_MS)

    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [isPlaying, speed, sessionDateStart, sessionDateEnd])

  const progress = useMemo(() => {
    if (!replayTime || !sessionStart || totalSeconds === 0) return 0
    return Math.min(1, Math.max(0, (replayTime.getTime() - sessionStart.getTime()) / 1000 / totalSeconds))
  }, [replayTime, sessionStart, totalSeconds])

  const elapsedSeconds = useMemo(() => {
    if (!replayTime || !sessionStart) return 0
    return Math.max(0, (replayTime.getTime() - sessionStart.getTime()) / 1000)
  }, [replayTime, sessionStart])

  const seek = useCallback((pct: number) => {
    if (!sessionStart || !sessionEnd) return
    const t = new Date(sessionStart.getTime() + pct * totalSeconds * 1000)
    setReplayTime(t)
  }, [sessionStart, sessionEnd, totalSeconds])

  return {
    replayTime,
    isPlaying,
    speed,
    progress,
    elapsedSeconds,
    totalSeconds,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    toggle: () => setIsPlaying(p => !p),
    seek,
    setSpeed,
  }
}
