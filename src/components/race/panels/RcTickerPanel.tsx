import type { RaceControl } from '../../../types'
import { flagColor } from '../../../utils/format'

interface Props {
  messages: RaceControl[]
  left: number
  right: number
  bottom: number
  height: number
}

export default function RcTickerPanel({ messages, left, right, bottom, height }: Props) {
  const latest = messages[messages.length - 1]
  if (!latest) return null

  const fc = latest.flag ? flagColor(latest.flag) : '#6b7280'

  return (
    <div
      key={latest.date}
      className="absolute z-20 flex items-center overflow-hidden animate-ticker-in"
      style={{
        bottom, left, right, height,
        background: 'rgba(5,6,9,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* RC badge */}
      <div
        className="shrink-0 h-full flex items-center px-3 gap-2"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#e8002d', animation: 'flag-pulse 1.5s ease-in-out infinite' }}
        />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 9, fontWeight: 800,
          color: '#e8002d', letterSpacing: '0.22em',
        }}>RC</span>
      </div>

      {/* Latest message */}
      <div className="flex-1 overflow-hidden px-3 flex items-center gap-3">
        {latest.lap_number !== null && (
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
            L{latest.lap_number}
          </span>
        )}
        <span className="truncate" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11, fontWeight: 600,
          color: fc, letterSpacing: '0.04em',
        }}>
          {latest.message}
        </span>
      </div>

      {/* Message count */}
      <div
        className="shrink-0 h-full flex items-center px-3"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#3d4455' }}>
          {messages.length}
        </span>
      </div>
    </div>
  )
}
