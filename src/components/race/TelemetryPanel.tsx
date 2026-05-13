import { useState, useRef, useCallback, useEffect } from 'react'
import { animate } from 'animejs'
import type { Driver, CarData, Lap, Stint, TeamRadio } from '../../types'
import Telemetry from './Telemetry'
import TeamRadioPlayer from './TeamRadioPlayer'
import ResizeHandle from './ResizeHandle'

interface Props {
  // Layout
  width: number
  onWidthChange: (w: number) => void
  // Telemetry
  driver: Driver | undefined
  latest: CarData | null
  history: CarData[]
  lastLap: Lap | undefined
  currentStint: Stint | undefined
  // Radio
  radio: TeamRadio[]
  drivers: Driver[]
  selectedDriver: number | null
}

export default function TelemetryPanel({
  width, onWidthChange,
  driver, latest, history, lastLap, currentStint,
  radio, drivers, selectedDriver,
}: Props) {
  const [splitPct, setSplitPct] = useState(58)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    animate(containerRef.current, {
      opacity: [0, 1],
      x: [20, 0],
      duration: 360,
      ease: 'outExpo',
    })
  }, [])

  const handleVerticalDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startPct = splitPct

    const onMove = (ev: MouseEvent) => {
      const h = containerRef.current?.clientHeight ?? 1
      const delta = ev.clientY - startY
      setSplitPct(Math.min(80, Math.max(20, startPct + (delta / h) * 100)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [splitPct])

  return (
    <div
      ref={containerRef}
      className="relative h-full shrink-0 flex flex-col overflow-hidden"
      style={{
        width,
        opacity: 0,
        background: 'rgba(5,6,9,0.92)',
        backdropFilter: 'blur(6px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top: Telemetry */}
      <div className="overflow-hidden min-h-0" style={{ flex: `0 0 ${splitPct}%` }}>
        <Telemetry
          driver={driver}
          latest={latest}
          history={history}
          lastLap={lastLap}
          currentStint={currentStint}
        />
      </div>

      {/* Vertical drag handle */}
      <div
        onMouseDown={handleVerticalDrag}
        className="shrink-0 group cursor-row-resize flex items-center justify-center relative z-10"
        style={{ height: 8, background: 'transparent', marginTop: -4, marginBottom: -4 }}
      >
        <div
          className="h-px rounded-full transition-all duration-150 opacity-20 group-hover:opacity-100"
          style={{
            width: 40,
            background: 'rgba(232,0,45,0.7)',
            boxShadow: '0 0 6px rgba(232,0,45,0.3)',
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {/* Bottom: Team radio */}
      <div className="overflow-hidden flex-1 min-h-0">
        <TeamRadioPlayer radio={radio} drivers={drivers} selectedDriver={selectedDriver} />
      </div>

      {/* Drag handle on left edge */}
      <ResizeHandle side="right" currentWidth={width} onResize={onWidthChange} minWidth={200} maxWidth={500} />
    </div>
  )
}
