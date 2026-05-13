import "../../styles/TrackMap.css";
import { memo } from 'react'
import type { Driver } from '../../types'
import type { TrackPoint, LivePosition } from '../../hooks/useTrackMap'
import { SVG_W, SVG_H } from '../../hooks/useTrackMap'
import { teamHex } from '../../utils/format'

interface Props {
  outline: TrackPoint[]
  livePositions: LivePosition[]
  drivers: Driver[]
  selectedDriver: number | null
  onSelectDriver: (dn: number) => void
  sessionName: string
  ready: boolean
}

export default memo(function TrackMap({
  outline, livePositions, drivers, selectedDriver,
  onSelectDriver, sessionName, ready,
}: Props) {
  const driverMap = new Map(drivers.map(d => [d.driver_number, d]))
  const pts = outline.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#06070a' }}>

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: '72px 72px',
        }}
      />

      {/* Radial vignette — darkens edges so panels blend better */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)',
        }}
      />

      {/* SVG map */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-track" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-dot" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track layers */}
        {outline.length > 1 && (
          <>
            {/* Wide soft halo */}
            <polyline
              points={pts} fill="none"
              stroke="rgba(255,255,255,0.025)" strokeWidth="28"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Track body */}
            <polyline
              points={pts} fill="none"
              stroke="#181c28" strokeWidth="15"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Track surface */}
            <polyline
              points={pts} fill="none"
              stroke="#22273a" strokeWidth="11"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Edge highlight */}
            <polyline
              points={pts} fill="none"
              stroke="rgba(255,255,255,0.055)" strokeWidth="11"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Center dashes */}
            <polyline
              points={pts} fill="none"
              stroke="rgba(255,255,255,0.14)" strokeWidth="1"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="9 7"
            />
          </>
        )}

        {!ready && !outline.length && (
          <text
            x={SVG_W / 2} y={SVG_H / 2}
            fill="rgba(255,255,255,0.12)"
            fontSize="13"
            textAnchor="middle"
            fontFamily="'Barlow Condensed', sans-serif"
            letterSpacing="5"
          >
            ACQUIRING POSITION DATA
          </text>
        )}

        {/* Driver dots — cx/cy CSS transitions for smooth movement */}
        {livePositions.map(lp => {
          const driver = driverMap.get(lp.driverNumber)
          const color = teamHex(driver?.team_colour)
          const isSelected = lp.driverNumber === selectedDriver
          const acronym = driver?.name_acronym ?? String(lp.driverNumber)
          const TRANSITION = 'cx 0.75s cubic-bezier(0.25,0.46,0.45,0.94), cy 0.75s cubic-bezier(0.25,0.46,0.45,0.94)'

          return (
            <g
              key={lp.driverNumber}
              onClick={() => onSelectDriver(lp.driverNumber)}
              className="cursor-pointer"
            >
              {/* Soft outer glow halo */}
              <circle
                cx={lp.x} cy={lp.y}
                r={isSelected ? 20 : 13}
                fill={color}
                opacity={isSelected ? 0.22 : 0.1}
                style={{ transition: TRANSITION }}
              />

              {/* Expanding pulse ring on selected driver */}
              {isSelected && (
                <circle
                  cx={lp.x} cy={lp.y}
                  r="13"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  className="driver-pulse-ring"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Inner solid ring (selected only) */}
              {isSelected && (
                <circle
                  cx={lp.x} cy={lp.y}
                  r="11"
                  fill="none"
                  stroke={color}
                  strokeWidth="0.8"
                  opacity="0.5"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Main driver dot */}
              <circle
                cx={lp.x} cy={lp.y}
                r={isSelected ? 9 : 5.5}
                fill={color}
                stroke={isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.5)'}
                strokeWidth={isSelected ? 2 : 0.7}
                filter={isSelected ? 'url(#glow-dot)' : undefined}
                style={{ transition: `${TRANSITION}, r 0.3s ease` }}
              />

              {/* White center pip on selected */}
              {isSelected && (
                <circle
                  cx={lp.x} cy={lp.y}
                  r="2.5"
                  fill="rgba(255,255,255,0.95)"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Driver acronym */}
              <text
                x={lp.x}
                y={lp.y - (isSelected ? 16 : 10)}
                fill={isSelected ? '#ffffff' : color}
                fontSize={isSelected ? '10' : '7.5'}
                fontWeight="700"
                textAnchor="middle"
                fontFamily="'Barlow Condensed', sans-serif"
                letterSpacing="0.8"
                opacity={isSelected ? 1 : 0.88}
                style={{ transition: `x 0.75s cubic-bezier(0.25,0.46,0.45,0.94), y 0.75s cubic-bezier(0.25,0.46,0.45,0.94)` }}
              >
                {acronym}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Corner bracket decorations — broadcast TV style */}
      <div className="absolute top-0 left-0 w-14 h-14 pointer-events-none"
        style={{ borderTop: '2px solid rgba(232,0,45,0.55)', borderLeft: '2px solid rgba(232,0,45,0.55)' }} />
      <div className="absolute top-0 right-0 w-14 h-14 pointer-events-none"
        style={{ borderTop: '2px solid rgba(232,0,45,0.55)', borderRight: '2px solid rgba(232,0,45,0.55)' }} />
      <div className="absolute bottom-0 left-0 w-14 h-14 pointer-events-none"
        style={{ borderBottom: '2px solid rgba(232,0,45,0.55)', borderLeft: '2px solid rgba(232,0,45,0.55)' }} />
      <div className="absolute bottom-0 right-0 w-14 h-14 pointer-events-none"
        style={{ borderBottom: '2px solid rgba(232,0,45,0.55)', borderRight: '2px solid rgba(232,0,45,0.55)' }} />

      {/* LIVE badge — top right */}
      <div
        className="absolute top-5 right-5 flex items-center gap-2 pointer-events-none"
        style={{
          padding: '4px 12px 4px 8px',
          background: 'rgba(232,0,45,0.12)',
          border: '1px solid rgba(232,0,45,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#e8002d', animation: 'flag-pulse 1.4s ease-in-out infinite' }}
        />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: 800,
          color: '#e8002d',
          letterSpacing: '0.25em',
        }}>LIVE</span>
      </div>

      {/* Session name — bottom center */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          padding: '3px 14px',
          background: 'rgba(6,7,10,0.7)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {sessionName}
        </span>
      </div>

      {/* Car count — bottom right */}
      {livePositions.length > 0 && (
        <div
          className="absolute bottom-5 right-5 pointer-events-none"
          style={{
            padding: '3px 10px',
            background: 'rgba(6,7,10,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.1em',
          }}>
            {livePositions.length} CARS
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {!ready && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <div className="w-1 h-1 rounded-full bg-[#6b7280] animate-pulse" />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10,
            color: '#4b5563',
            letterSpacing: '0.22em',
          }}>LOADING TRACK DATA</span>
        </div>
      )}
    </div>
  )
})
