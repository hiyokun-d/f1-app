import { useEffect, useRef, useState } from 'react'
import type { Weather, RaceControl } from '../../types'
import { flagColor } from '../../utils/format'

interface Props {
  sessionName: string
  sessionType: string
  location: string
  currentLap: number
  totalLaps: number
  weather: Weather | null
  raceControl: RaceControl[]
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <span style={{ display: 'inline-block', transform: `rotate(${degrees}deg)`, fontSize: 10 }}>↑</span>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const [flash, setFlash] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(true)
      const t = setTimeout(() => { setDisplay(value); setFlash(false) }, 80)
      prevRef.current = value
      return () => clearTimeout(t)
    } else {
      setDisplay(value)
    }
  }, [value])

  return (
    <span
      style={{
        display: 'inline-block',
        transition: 'transform 0.08s ease, opacity 0.08s ease',
        transform: flash ? 'translateY(-2px)' : 'translateY(0)',
        opacity: flash ? 0.5 : 1,
        fontFamily: 'var(--font-data)',
        color: '#fff',
      }}
    >
      {display || '–'}
    </span>
  )
}

export default function Header({
  sessionName, sessionType, location,
  currentLap, totalLaps, weather, raceControl,
}: Props) {
  const latestFlag = [...raceControl].reverse().find(r => r.flag)
  const flagStr = latestFlag?.flag ?? 'GREEN'
  const fColor = flagColor(flagStr)
  const prevFlagRef = useRef(flagStr)
  const [flagPulse, setFlagPulse] = useState(false)
  const [flagBanner, setFlagBanner] = useState(false)

  useEffect(() => {
    if (prevFlagRef.current !== flagStr) {
      prevFlagRef.current = flagStr
      setFlagPulse(true)
      setFlagBanner(true)
      const t1 = setTimeout(() => setFlagPulse(false), 1500)
      const t2 = setTimeout(() => setFlagBanner(false), 3000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [flagStr])

  const latestRC = raceControl[raceControl.length - 1]

  return (
    <header
      className="shrink-0 relative"
      style={{
        background: 'rgba(4,5,8,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Flag change banner — slides down on flag change */}
      {flagBanner && flagStr !== 'GREEN' && (
        <div
          className="absolute top-full left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 animate-slide-down"
          style={{
            background: `${fColor}18`,
            borderBottom: `1px solid ${fColor}40`,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="w-2 h-2 rounded-full animate-ping" style={{ background: fColor }} />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-display)', color: fColor }}
          >
            {flagStr} FLAG
          </span>
          {latestRC?.message && (
            <span className="text-xs text-[#9ca3af] truncate">{latestRC.message}</span>
          )}
        </div>
      )}

      <div className="h-12 flex items-stretch">
        {/* Flag color strip — animated */}
        <div
          className="w-1 shrink-0 transition-colors duration-300"
          style={{
            background: fColor,
            boxShadow: flagPulse ? `0 0 12px ${fColor}` : 'none',
            animation: flagPulse ? 'flag-pulse 1.5s ease-in-out' : 'none',
          }}
        />

        {/* Session name */}
        <div
          className="flex flex-col justify-center px-4 border-r"
          style={{ borderColor: '#1f2330', minWidth: 220 }}
        >
          <div
            className="text-[9px] uppercase tracking-[0.2em] leading-none mb-0.5"
            style={{ fontFamily: 'var(--font-display)', color: '#5a6272' }}
          >
            {sessionType} · {location}
          </div>
          <div
            className="text-sm font-bold text-white leading-none uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {sessionName}
          </div>
        </div>

        {/* Lap counter */}
        <div
          className="flex items-center gap-2 px-4 border-r"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-display)', color: '#5a6272' }}
          >
            LAP
          </span>
          <span className="text-xl font-black tabular-nums leading-none">
            <AnimatedNumber value={currentLap} />
          </span>
          {totalLaps > 0 && (
            <span className="text-sm" style={{ fontFamily: 'var(--font-data)', color: '#5a6272' }}>
              /{totalLaps}
            </span>
          )}
        </div>

        {/* Flag badge */}
        <div className="flex items-center px-4 border-r" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div
            className="flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300"
            style={{
              fontFamily: 'var(--font-display)',
              color: fColor,
              background: `${fColor}15`,
              border: `1px solid ${fColor}40`,
              boxShadow: flagPulse ? `0 0 12px ${fColor}50` : 'none',
              transform: flagPulse ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: fColor,
                animation: flagPulse ? 'flag-pulse 1.5s ease-in-out' : 'none',
              }}
            />
            {flagStr}
          </div>
        </div>

        {/* Latest RC message — scrolling if long */}
        {latestRC && (
          <div
            className="flex items-center px-4 border-r overflow-hidden"
            style={{ borderColor: '#1f2330', maxWidth: 280 }}
          >
            <p
              className="text-[10px] truncate"
              style={{ fontFamily: 'var(--font-display)', color: '#9ca3af' }}
            >
              {latestRC.message}
            </p>
          </div>
        )}

        {/* Weather — right */}
        {weather && (
          <div className="flex items-center gap-5 px-4 ml-auto">
            <Stat label="TRACK" value={`${weather.track_temperature.toFixed(0)}°`} hot={weather.track_temperature > 40} />
            <Stat label="AIR" value={`${weather.air_temperature.toFixed(0)}°`} />
            <Stat label="HUM" value={`${weather.humidity.toFixed(0)}%`} />
            {weather.rainfall > 0 && (
              <Stat label="RAIN" value={`${weather.rainfall}mm`} blue />
            )}
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-[0.15em] mb-0.5" style={{ fontFamily: 'var(--font-display)', color: '#5a6272' }}>WIND</span>
              <span className="text-[11px] font-bold tabular-nums text-white" style={{ fontFamily: 'var(--font-data)' }}>
                {weather.wind_speed.toFixed(1)}<span style={{ color: '#5a6272' }}>km/h</span>{' '}
                <WindArrow degrees={weather.wind_direction} />
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function Stat({ label, value, hot, blue }: { label: string; value: string; hot?: boolean; blue?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-[0.15em] mb-0.5" style={{ fontFamily: 'var(--font-display)', color: '#5a6272' }}>{label}</span>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-data)', color: blue ? '#60a5fa' : hot ? '#f97316' : '#f0f0f0' }}
      >
        {value}
      </span>
    </div>
  )
}
