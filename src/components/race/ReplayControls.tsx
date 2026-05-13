import { useRef, useState } from 'react'
import type { PlaybackSpeed, ReplayState, ReplayControls } from '../../hooks/useRaceReplay'
import { SPEEDS } from '../../hooks/useRaceReplay'

type Props = ReplayState & ReplayControls & { bufferProgress?: number }

function pad(n: number) { return String(Math.floor(n)).padStart(2, '0') }
function formatElapsed(s: number) { return `${pad(s / 60)}:${pad(s % 60)}` }

export default function ReplayControls({
  isPlaying, speed, progress, elapsedSeconds, totalSeconds,
  toggle, seek, setSpeed, bufferProgress = 0,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [ripple, setRipple] = useState(false)

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
  }

  const handleToggle = () => {
    toggle()
    setRipple(true)
    setTimeout(() => setRipple(false), 600)
  }

  const pct = progress * 100

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        background: 'rgba(4,5,8,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Accent line — buffer (white) behind playhead (red) */}
      <div className="h-px w-full relative overflow-hidden">
        {bufferProgress > 0 && (
          <div
            className="h-full absolute left-0 top-0"
            style={{
              width: `${bufferProgress * 100}%`,
              background: 'rgba(255,255,255,0.15)',
              transition: 'width 0.6s ease-out',
            }}
          />
        )}
        <div
          className="h-full absolute left-0 top-0"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(232,0,45,0.4), var(--f1-red))',
            transition: 'width 0.1s linear',
            boxShadow: isPlaying ? '0 0 8px rgba(232,0,45,0.8)' : 'none',
          }}
        />
        <div className="absolute inset-0 bg-[#1f2330]" style={{ left: `${bufferProgress > 0 ? bufferProgress * 100 : pct}%` }} />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4 px-5 py-3">

        {/* Play / Pause with ripple */}
        <div className="relative shrink-0">
          {ripple && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'rgba(232,0,45,0.4)',
                animation: 'ripple 0.6s ease-out forwards',
              }}
            />
          )}
          <button
            onClick={handleToggle}
            className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
            style={{
              background: isPlaying ? 'var(--f1-red)' : '#1a1d24',
              border: `1px solid ${isPlaying ? 'var(--f1-red)' : '#2e3444'}`,
              boxShadow: isPlaying ? '0 0 16px rgba(232,0,45,0.5)' : 'none',
            }}
          >
            <span
              className="text-white text-sm select-none leading-none"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
        </div>

        {/* Time display */}
        <div
          className="shrink-0 tabular-nums"
          style={{ fontFamily: 'var(--font-data)', fontSize: 11 }}
        >
          <span style={{ color: '#f0f0f0' }}>{formatElapsed(elapsedSeconds)}</span>
          <span style={{ color: '#5a6272' }}> / {formatElapsed(totalSeconds)}</span>
        </div>

        {/* Scrubber */}
        <div
          ref={barRef}
          className="flex-1 relative cursor-pointer group"
          style={{ height: 20, display: 'flex', alignItems: 'center' }}
          onClick={handleSeek}
          onMouseMove={e => { if (e.buttons === 1) handleSeek(e) }}
        >
          {/* Track */}
          <div className="absolute inset-x-0 h-1 rounded-full bg-[#1f2330]" style={{ top: '50%', marginTop: -2 }} />
          {/* Buffer (data preloaded ahead of playhead) */}
          {bufferProgress > 0 && (
            <div
              className="absolute left-0 h-1 rounded-full"
              style={{
                top: '50%',
                marginTop: -2,
                width: `${bufferProgress * 100}%`,
                background: 'rgba(255,255,255,0.18)',
                transition: 'width 0.6s ease-out',
              }}
            />
          )}
          {/* Played */}
          <div
            className="absolute left-0 h-1 rounded-full"
            style={{
              top: '50%',
              marginTop: -2,
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #8b001a, var(--f1-red))',
              boxShadow: isPlaying ? '0 0 6px rgba(232,0,45,0.7)' : 'none',
              transition: 'width 0.1s linear',
            }}
          />
          {/* Handle */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              top: '50%',
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 6px rgba(232,0,45,0.6)',
            }}
          />
          {/* Quarter markers */}
          {[25, 50, 75].map(p => (
            <div
              key={p}
              className="absolute w-px h-2 bg-[#2e3444]"
              style={{ left: `${p}%`, top: '50%', marginTop: -4 }}
            />
          ))}
        </div>

        {/* Speed pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[9px] text-[#5a6272] uppercase mr-1"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.15em' }}
          >
            Speed
          </span>
          {SPEEDS.map(s => {
            const active = speed === s
            return (
              <button
                key={s}
                onClick={() => setSpeed(s as PlaybackSpeed)}
                className="transition-all duration-150"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  border: `1px solid ${active ? 'var(--f1-red)' : '#2e3444'}`,
                  background: active ? 'var(--f1-red)' : 'transparent',
                  color: active ? '#fff' : '#5a6272',
                  boxShadow: active ? '0 0 8px rgba(232,0,45,0.4)' : 'none',
                }}
              >
                {s}×
              </button>
            )
          })}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 shrink-0 ml-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isPlaying ? 'var(--f1-red)' : '#5a6272',
              boxShadow: isPlaying ? '0 0 6px rgba(232,0,45,0.8)' : 'none',
              animation: isPlaying ? 'flag-pulse 1s ease-in-out infinite' : 'none',
            }}
          />
          <span
            className="text-[10px] uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.15em',
              color: isPlaying ? 'var(--f1-red)' : '#5a6272',
            }}
          >
            {progress >= 0.999 ? 'END' : isPlaying ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>
    </div>
  )
}
