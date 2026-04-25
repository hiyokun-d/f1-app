import { useEffect, useRef, memo } from 'react'
import type { CarData, Driver, Lap, Stint } from '../../types'
import { formatLapTime, teamHex } from '../../utils/format'

interface Props {
  driver: Driver | undefined
  latest: CarData | null
  history: CarData[]
  lastLap: Lap | undefined
  currentStint: Stint | undefined
}

const TYRE_COLORS: Record<string, { bg: string; text: string }> = {
  SOFT:         { bg: '#e8002d', text: '#fff' },
  MEDIUM:       { bg: '#ffd600', text: '#000' },
  HARD:         { bg: '#ffffff', text: '#000' },
  INTERMEDIATE: { bg: '#39b54a', text: '#fff' },
  WET:          { bg: '#0067ff', text: '#fff' },
  UNKNOWN:      { bg: '#555',    text: '#fff' },
}

function isDRSOpen(drs: number): boolean {
  return drs >= 10
}

function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full h-2 bg-[#1f2229] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function SectorBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center bg-[#1a1d22] px-2 py-1 rounded-sm">
      <span className="text-[9px] text-[#6b7280] uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-white tabular-nums">{formatLapTime(value)}</span>
    </div>
  )
}

export default memo(function Telemetry({ driver, latest, history, lastLap, currentStint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const teamColor = teamHex(driver?.team_colour)
  const tyre = currentStint ? (TYRE_COLORS[currentStint.compound] ?? TYRE_COLORS.UNKNOWN) : null

  // RPM waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    const MAX_RPM = 18000

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0f12'
    ctx.fillRect(0, 0, W, H)

    if (!history.length) {
      ctx.fillStyle = '#2a2d35'
      ctx.fillRect(0, H - 2, W, 2)
      return
    }

    const pts = history.map((d, i) => ({
      x: (i / Math.max(history.length - 1, 1)) * W,
      y: H - Math.max(2, (d.rpm / MAX_RPM) * H * 0.92),
    }))

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, `${teamColor}bb`)
    grad.addColorStop(0.6, `${teamColor}44`)
    grad.addColorStop(1, `${teamColor}00`)

    ctx.beginPath()
    ctx.moveTo(pts[0].x, H)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, H)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // RPM line
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.strokeStyle = teamColor
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Max RPM grid line
    ctx.beginPath()
    ctx.moveTo(0, H * 0.08)
    ctx.lineTo(W, H * 0.08)
    ctx.strokeStyle = '#2a2d35'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }, [history, teamColor])

  const noData = !driver

  return (
    <div className="h-full flex flex-col" style={{ background: 'transparent' }}>
      {/* Driver header */}
      <div className="px-3 py-2 flex items-center gap-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(4,5,8,0.5)' }}>
        <div className="w-0.5 h-8 rounded-full" style={{ background: teamColor }} />
        <div>
          <div className="text-[10px] text-[#6b7280] uppercase tracking-widest leading-none">
            {driver?.team_name ?? 'No Driver Selected'}
          </div>
          <div className="text-sm font-black text-white tracking-wide">
            {driver ? `#${driver.driver_number} ${driver.name_acronym}` : '—'}
          </div>
        </div>
        {tyre && (
          <div
            className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
            style={{ background: tyre.bg, color: tyre.text }}
          >
            {currentStint!.compound[0]}
          </div>
        )}
        {currentStint && (
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-[#6b7280]">age</span>
            <span className="text-xs font-bold text-white tabular-nums">
              {currentStint.tyre_age_at_start} laps
            </span>
          </div>
        )}
      </div>

      {noData ? (
        <div className="flex-1 flex items-center justify-center text-[#6b7280] text-xs">
          Click a driver to view telemetry
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3">

          {/* Speed + Gear row */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[9px] text-[#6b7280] uppercase tracking-widest">Speed</div>
              <div className="text-4xl font-black tabular-nums text-white leading-none">
                {latest?.speed ?? '–'}
              </div>
              <div className="text-[9px] text-[#6b7280]">km/h</div>
            </div>

            <div className="text-right">
              <div className="text-[9px] text-[#6b7280] uppercase tracking-widest">Gear</div>
              <div
                className="text-6xl font-black tabular-nums leading-none"
                style={{ color: teamColor }}
              >
                {latest ? (latest.n_gear === 0 ? 'N' : latest.n_gear) : '–'}
              </div>
            </div>
          </div>

          {/* DRS */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#6b7280] uppercase tracking-widest">DRS</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all duration-200 ${
                latest && isDRSOpen(latest.drs)
                  ? 'bg-[#22c55e20] text-[#22c55e] border border-[#22c55e60]'
                  : 'bg-[#1a1d22] text-[#6b7280] border border-[#2a2d35]'
              }`}
            >
              {latest && isDRSOpen(latest.drs) ? '✓ OPEN' : '✗ CLOSED'}
            </span>
            <span className="text-[9px] text-[#6b7280] ml-auto">
              {latest ? `RAW ${latest.drs}` : ''}
            </span>
          </div>

          {/* Throttle */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-[#6b7280] uppercase tracking-widest">Throttle</span>
              <span className="text-[10px] text-white tabular-nums font-mono">{latest?.throttle ?? 0}%</span>
            </div>
            <Bar value={latest?.throttle ?? 0} color="#22c55e" />
          </div>

          {/* Brake */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-[#6b7280] uppercase tracking-widest">Brake</span>
              <span className="text-[10px] text-white tabular-nums font-mono">{latest?.brake ?? 0}%</span>
            </div>
            <Bar value={latest?.brake ?? 0} color="#e8002d" />
          </div>

          {/* RPM + label */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-[#6b7280] uppercase tracking-widest">RPM</span>
              <span className="text-[10px] text-white tabular-nums font-mono">
                {latest ? latest.rpm.toLocaleString() : '–'}
              </span>
            </div>
            {/* RPM waveform canvas */}
            <canvas
              ref={canvasRef}
              width={280}
              height={60}
              className="w-full rounded-sm"
              style={{ height: 60 }}
            />
          </div>

          {/* Last lap sectors */}
          {lastLap && (
            <div>
              <div className="text-[9px] text-[#6b7280] uppercase tracking-widest mb-1.5">
                Last Lap — {formatLapTime(lastLap.lap_duration)}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <SectorBadge label="S1" value={lastLap.duration_sector_1} />
                <SectorBadge label="S2" value={lastLap.duration_sector_2} />
                <SectorBadge label="S3" value={lastLap.duration_sector_3} />
              </div>
              {(lastLap.i1_speed || lastLap.i2_speed || lastLap.st_speed) && (
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-[#6b7280]">I1</span>
                    <span className="text-[10px] font-mono text-white tabular-nums">
                      {lastLap.i1_speed ?? '–'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-[#6b7280]">I2</span>
                    <span className="text-[10px] font-mono text-white tabular-nums">
                      {lastLap.i2_speed ?? '–'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-[#6b7280]">ST</span>
                    <span className="text-[10px] font-mono text-white tabular-nums">
                      {lastLap.st_speed ?? '–'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
