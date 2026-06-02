import "../../styles/TrackMap.css";
import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { animate } from 'animejs'
import type { Driver, Pit, RaceControl } from '../../types'
import type { TrackPoint, LivePosition } from '../../hooks/useTrackMap'
import { buildArcData, posAtFraction, projectToTrack, type ArcData } from '../../utils/trackPhysics'
import { teamHex } from '../../utils/format'

interface Props {
  outline: TrackPoint[]
  livePositions: LivePosition[]
  drivers: Driver[]
  selectedDriver: number | null
  onSelectDriver: (dn: number) => void
  sessionName: string
  ready: boolean
  containerW: number
  containerH: number
  circuitSvgUrl: string | null
  pits?: Pit[]
  raceControl?: RaceControl[]
}

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.2

export default memo(function TrackMap({
  outline, livePositions, drivers, selectedDriver,
  onSelectDriver, sessionName, ready, containerW, containerH,
  circuitSvgUrl, pits, raceControl,
}: Props) {
  const driverMap = new Map(drivers.map(d => [d.driver_number, d]))

  // ── Arc data (for GPS snap + arc-following animation) ─────────────────────
  const arcData = useMemo<ArcData | null>(
    () => outline.length >= 2 ? buildArcData(outline) : null,
    [outline],
  )
  const outlineRef  = useRef(outline)
  const arcDataRef  = useRef(arcData)
  outlineRef.current = outline
  arcDataRef.current = arcData

  // ── Circuit SVG inline data ───────────────────────────────────────────────
  const [circuitSvgData, setCircuitSvgData] = useState<{ paths: string[]; vbW: number; vbH: number } | null>(null)

  useEffect(() => {
    if (!circuitSvgUrl) { setCircuitSvgData(null); return }
    let cancelled = false
    fetch(circuitSvgUrl)
      .then(r => r.text())
      .then(text => {
        if (cancelled) return
        const vbMatch = text.match(/viewBox="([^"]+)"/)
        if (!vbMatch) return
        const parts = vbMatch[1].trim().split(/\s+/).map(Number)
        const vbW = parts[2], vbH = parts[3]
        if (!vbW || !vbH) return
        const dMatches = text.match(/\bd="([^"]+)"/g) ?? []
        const paths = dMatches.map(m => m.slice(3, -1))
        setCircuitSvgData({ paths, vbW, vbH })
        setSvgLoaded(true)
      })
      .catch(() => { if (!cancelled) setSvgLoaded(true) })
    return () => { cancelled = true }
  }, [circuitSvgUrl])

  const gpsBB = useMemo(() => {
    if (!outline.length) return null
    return {
      minX: Math.min(...outline.map(p => p.x)),
      maxX: Math.max(...outline.map(p => p.x)),
      minY: Math.min(...outline.map(p => p.y)),
      maxY: Math.max(...outline.map(p => p.y)),
    }
  }, [outline])

  const circuitTransform = useMemo(() => {
    if (!circuitSvgData) return null
    const { vbW, vbH } = circuitSvgData
    if (gpsBB) {
      const sx = (gpsBB.maxX - gpsBB.minX) / vbW
      const sy = (gpsBB.maxY - gpsBB.minY) / vbH
      return `translate(${gpsBB.minX}, ${gpsBB.minY}) scale(${sx}, ${sy})`
    }
    const pad = 40
    const s = Math.min((containerW - pad * 2) / vbW, (containerH - pad * 2) / vbH)
    return `translate(${(containerW - vbW * s) / 2}, ${(containerH - vbH * s) / 2}) scale(${s})`
  }, [circuitSvgData, gpsBB, containerW, containerH])

  // ── GPS arc-following animation state ─────────────────────────────────────
  // Each driver has a proxy object {frac} that AnimeJS animates monotonically.
  // posAtFraction handles the mod-1 wrapping each frame.
  type Proxy = { frac: number }
  const driverProxies = useRef(new Map<number, Proxy>())
  const driverAnims   = useRef(new Map<number, ReturnType<typeof animate>>())
  const driverGEls    = useRef(new Map<number, SVGGElement>())

  // When real GPS positions update: animate each driver along the track arc
  useEffect(() => {
    if (!arcData || !outline.length) return

    for (const lp of livePositions) {
      const el = driverGEls.current.get(lp.driverNumber)
      if (!el) continue

      const { snapped, fraction: newFrac } = projectToTrack(lp, outline, arcData)

      let proxy = driverProxies.current.get(lp.driverNumber)
      if (!proxy) {
        // First appearance: teleport, no animation
        proxy = { frac: newFrac }
        driverProxies.current.set(lp.driverNumber, proxy)
        el.style.transform = `translate(${snapped.x}px, ${snapped.y}px)`
        continue
      }

      // Compute forward delta from current animated fraction to new fraction
      const currentMod = ((proxy.frac % 1) + 1) % 1
      let delta = newFrac - currentMod
      if (delta < 0) delta += 1  // wrap forward
      if (delta > 0.5) {
        // GPS anomaly / data gap > half lap → teleport instead of animate backwards
        proxy.frac = newFrac
        el.style.transform = `translate(${snapped.x}px, ${snapped.y}px)`
        continue
      }

      const endFrac = proxy.frac + delta

      // Pause previous animation so we start from the current intermediate position
      driverAnims.current.get(lp.driverNumber)?.pause()

      const anim = animate(proxy, {
        frac: endFrac,
        duration: 2800,  // slightly under 3s poll so dots always feel current
        ease: 'linear',
        onUpdate: () => {
          const arc = arcDataRef.current
          const ol  = outlineRef.current
          if (!arc || !ol.length) return
          const { x, y } = posAtFraction(proxy!.frac, ol, arc)
          el.style.transform = `translate(${x}px, ${y}px)`
        },
      })
      driverAnims.current.set(lp.driverNumber, anim)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePositions])

  // Cleanup animations when outline changes (arc fractions no longer valid)
  useEffect(() => {
    for (const anim of driverAnims.current.values()) anim.pause()
    driverAnims.current.clear()
    driverProxies.current.clear()
  }, [outline])

  // ── Pit + incident flags ──────────────────────────────────────────────────
  const pitDrivers = useMemo(() => {
    if (!pits?.length) return new Set<number>()
    const latestPit = new Map<number, Pit>()
    for (const p of pits) {
      const cur = latestPit.get(p.driver_number)
      if (!cur || p.lap_number > cur.lap_number) latestPit.set(p.driver_number, p)
    }
    return new Set(
      [...latestPit.entries()]
        .filter(([, p]) => p.pit_duration === null)
        .map(([dn]) => dn)
    )
  }, [pits])

  const { yellowFlagDrivers, hasActiveSC, hasRedFlag } = useMemo(() => {
    if (!raceControl?.length) return { yellowFlagDrivers: new Set<number>(), hasActiveSC: false, hasRedFlag: false }
    const latestTime = Math.max(...raceControl.map(rc => new Date(rc.date).getTime()))
    const cutoff = latestTime - 120_000
    const recent = raceControl.filter(rc => new Date(rc.date).getTime() > cutoff)
    const yellowFlagDrivers = new Set(
      recent.filter(rc => rc.flag === 'YELLOW' && rc.driver_number != null).map(rc => rc.driver_number!)
    )
    const hasActiveSC = recent.some(rc => rc.category === 'SafetyCar' || rc.message?.includes('SAFETY CAR'))
    const hasRedFlag  = recent.some(rc => rc.flag === 'RED')
    return { yellowFlagDrivers, hasActiveSC, hasRedFlag }
  }, [raceControl])

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const isDragging      = useRef(false)
  const lastMouse       = useRef({ x: 0, y: 0 })
  const containerRef    = useRef<HTMLDivElement>(null)

  const clampPan = useCallback((px: number, py: number, z: number) => {
    const maxX = (containerW * (z - 1)) / 2
    const maxY = (containerH * (z - 1)) / 2
    return { x: Math.min(maxX, Math.max(-maxX, px)), y: Math.min(maxY, Math.max(-maxY, py)) }
  }, [containerW, containerH])

  const applyZoom = useCallback((next: number, originX?: number, originY?: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    setZoom(z)
    if (z <= 1) { setPan({ x: 0, y: 0 }); return }
    if (originX !== undefined && originY !== undefined) {
      setPan(prev => {
        const dx = (originX - containerW / 2 - prev.x) * (next / zoom - 1)
        const dy = (originY - containerH / 2 - prev.y) * (next / zoom - 1)
        return clampPan(prev.x - dx, prev.y - dy, z)
      })
    }
  }, [zoom, containerW, containerH, clampPan])

  const [animateTransform, setAnimateTransform] = useState(false)

  const zoomToDriver = useCallback((driverX: number, driverY: number) => {
    const targetZ = Math.max(2.5, zoom)
    const clamped = clampPan((containerW / 2 - driverX) * targetZ, (containerH / 2 - driverY) * targetZ, targetZ)
    setAnimateTransform(true)
    setZoom(targetZ)
    setPan(clamped)
    setTimeout(() => setAnimateTransform(false), 680)
  }, [zoom, containerW, containerH, clampPan])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setAnimateTransform(false)
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const rect   = containerRef.current?.getBoundingClientRect()
    const ox     = rect ? e.clientX - rect.left : containerW / 2
    const oy     = rect ? e.clientY - rect.top  : containerH / 2
    applyZoom(zoom * factor, ox, oy)
  }, [zoom, applyZoom, containerW, containerH])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    setAnimateTransform(false)
    isDragging.current = true
    lastMouse.current  = { x: e.clientX, y: e.clientY }
    document.body.style.cursor     = 'grabbing'
    document.body.style.userSelect = 'none'
  }, [zoom])

  useEffect(() => {
    if (zoom <= 1) return
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
      setPan(prev => clampPan(prev.x + dx, prev.y + dy, zoom))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [zoom, clampPan])

  // ── Preload reveal ────────────────────────────────────────────────────────
  // svgLoaded is set by the fetch effect above (or starts true when no circuit SVG)
  const [svgLoaded, setSvgLoaded] = useState(!circuitSvgUrl)
  const isFullyReady = ready && svgLoaded
  const revealedRef  = useRef(false)
  const overlayRef   = useRef<HTMLDivElement>(null)
  const contentRef   = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!circuitSvgUrl) setSvgLoaded(true); revealedRef.current = false }, [circuitSvgUrl])

  useEffect(() => {
    if (!isFullyReady || revealedRef.current) return
    revealedRef.current = true
    const overlay = overlayRef.current, content = contentRef.current
    if (!content) return
    animate(content, { opacity: [0, 1], scale: [0.96, 1], duration: 800, ease: 'outExpo' })
    if (overlay) {
      animate(overlay, {
        opacity: [1, 0], duration: 600, delay: 200, ease: 'outQuart',
        onComplete: () => { if (overlay) overlay.style.display = 'none' },
      })
    }
  }, [isFullyReady])

  // ── Render ────────────────────────────────────────────────────────────────
  const transform           = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
  const transformTransition = animateTransform ? 'transform 0.62s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
  const pts = outline.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#06070a', cursor: zoom > 1 ? 'grab' : 'default' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
    >
      {/* Grid texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
        backgroundSize: '72px 72px', zIndex: 0,
      }} />

      {/* ── Loading overlay ── */}
      <div ref={overlayRef} className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#06070a', zIndex: 20 }}>
        {circuitSvgUrl && (
          <img src={circuitSvgUrl} className="absolute inset-0 w-full h-full circuit-svg-art"
            style={{ objectFit: 'contain', opacity: 0.12 }} aria-hidden />
        )}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="track-scan-line" />
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#e8002d] animate-pulse" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 800, color: '#e8002d', letterSpacing: '0.35em' }}>
              LOADING CIRCUIT
            </span>
            <div className="w-1 h-1 rounded-full bg-[#e8002d] animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-px rounded-full" style={{
                height: 8 + (i % 3) * 4, background: 'rgba(232,0,45,0.6)',
                animation: `track-bar-pulse 0.9s ease-in-out ${i * 0.12}s infinite alternate`,
              }} />
            ))}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
            {sessionName}
          </span>
        </div>
      </div>

      {/* ── Map content ── */}
      <div ref={contentRef} className="absolute inset-0" style={{ opacity: 0, zIndex: 1 }}>
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)',
          zIndex: 2,
        }} />

        {/* SC / Red flag badge */}
        {(hasActiveSC || hasRedFlag) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 5 }}>
            <div style={{
              padding: '3px 12px',
              background: hasRedFlag ? 'rgba(239,68,68,0.15)' : 'rgba(250,204,21,0.12)',
              border: `1px solid ${hasRedFlag ? 'rgba(239,68,68,0.5)' : 'rgba(250,204,21,0.4)'}`,
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
                color: hasRedFlag ? '#ef4444' : '#facc15', letterSpacing: '0.3em',
              }}>
                {hasRedFlag ? '🔴 RED FLAG' : '🟡 SAFETY CAR'}
              </span>
            </div>
          </div>
        )}

        {/* Zoomable layer */}
        <div className="absolute inset-0" style={{
          transform, transformOrigin: 'center center',
          willChange: 'transform', transition: transformTransition, zIndex: 1,
        }}>
          {/* Track + driver dots — single unified SVG layer */}
          <svg
            viewBox={`0 0 ${containerW} ${containerH}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="glow-dot" x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Circuit SVG paths — mapped into GPS coordinate space via transform */}
            {circuitSvgData && circuitTransform && circuitSvgData.paths.map((d, i) => (
              <g key={i} transform={circuitTransform}>
                <path d={d} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="30"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke="#191d28" strokeWidth="17"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke="#22273a" strokeWidth="13"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 13"
                  vectorEffect="non-scaling-stroke" />
              </g>
            ))}

            {/* GPS polyline fallback — only when no /tracks/ SVG for this circuit */}
            {outline.length > 1 && !circuitSvgUrl && (
              <g>
                <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="#191d28" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="#22273a" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"
                  strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 13" />
              </g>
            )}

            {/* Driver dots */}
            {livePositions.map(lp => {
              const driver     = driverMap.get(lp.driverNumber)
              const isPitting  = pitDrivers.has(lp.driverNumber)
              const hasYellow  = yellowFlagDrivers.has(lp.driverNumber)
              const isSelected = lp.driverNumber === selectedDriver
              const baseColor  = teamHex(driver?.team_colour)
              const fillColor  =
                isPitting    ? '#f59e0b' :
                hasRedFlag   ? '#ef4444' :
                hasActiveSC  ? '#facc15' : baseColor
              const dotR  = isPitting ? 4 : isSelected ? 9 : 5.5
              const label = isPitting ? 'PIT' : (driver?.name_acronym ?? String(lp.driverNumber))

              const gStyle = { willChange: 'transform' as const }

              return (
                <g
                  key={lp.driverNumber}
                  ref={(el) => {
                    if (el) {
                      driverGEls.current.set(lp.driverNumber, el)
                      // Initial GPS position set directly (no React style, prevents flash at 0,0)
                      if (!driverProxies.current.has(lp.driverNumber)) {
                        const arc = arcDataRef.current
                        const ol  = outlineRef.current
                        if (arc && ol.length) {
                          const { snapped } = projectToTrack(lp, ol, arc)
                          el.style.transform = `translate(${snapped.x}px, ${snapped.y}px)`
                        }
                      }
                    } else {
                      driverGEls.current.delete(lp.driverNumber)
                      driverProxies.current.delete(lp.driverNumber)
                      driverAnims.current.get(lp.driverNumber)?.pause()
                      driverAnims.current.delete(lp.driverNumber)
                    }
                  }}
                  style={gStyle}
                  onClick={() => { onSelectDriver(lp.driverNumber); zoomToDriver(lp.x, lp.y) }}
                  className="cursor-pointer"
                >
                  {/* Outer halo */}
                  <circle r={isSelected ? 20 : 13} fill={fillColor} opacity={isSelected ? 0.22 : 0.1} />

                  {/* Yellow flag incident ring */}
                  {hasYellow && !isPitting && (
                    <circle r="16" fill="none" stroke="#facc15" strokeWidth="1.5" className="incident-ring" />
                  )}

                  {/* Selected driver rings */}
                  {isSelected && (
                    <>
                      <circle r="13" fill="none" stroke={fillColor}
                        strokeWidth="1.5" className="driver-pulse-ring" />
                      <circle r="11" fill="none" stroke={fillColor}
                        strokeWidth="0.8" opacity="0.5" />
                    </>
                  )}

                  {/* Pit pulse ring */}
                  {isPitting && <circle r="8" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="pit-pulse-ring" />}

                  {/* Main dot */}
                  <circle
                    r={dotR}
                    fill={fillColor}
                    stroke={isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.45)'}
                    strokeWidth={isSelected ? 2 : 0.8}
                    filter={isSelected ? 'url(#glow-dot)' : undefined}
                    style={{ transition: 'r 0.3s ease' }}
                  />
                  {isSelected && <circle r="2.5" fill="rgba(255,255,255,0.95)" />}

                  {/* Label */}
                  <text
                    y={isSelected ? -16 : isPitting ? -9 : -10}
                    fill={isPitting ? '#f59e0b' : isSelected ? '#fff' : fillColor}
                    fontSize={isSelected ? '10' : isPitting ? '6' : '7.5'}
                    fontWeight="700" textAnchor="middle"
                    fontFamily="'Barlow Condensed', sans-serif"
                    letterSpacing="0.8"
                    opacity={isSelected ? 1 : 0.88}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Corner brackets */}
        {[['top-0 left-0', 'borderTop borderLeft'], ['top-0 right-0', 'borderTop borderRight'],
          ['bottom-0 left-0', 'borderBottom borderLeft'], ['bottom-0 right-0', 'borderBottom borderRight']].map(([pos]) => (
          <div key={pos} className={`absolute ${pos} w-10 h-10 pointer-events-none`}
            style={{ border: '2px solid rgba(232,0,45,0.55)', borderRight: pos.includes('left') ? 'none' : undefined,
              borderLeft: pos.includes('right') ? 'none' : undefined,
              borderBottom: pos.includes('top-0') ? 'none' : undefined,
              borderTop: pos.includes('bottom') ? 'none' : undefined, zIndex: 3 }} />
        ))}

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-auto" style={{ zIndex: 4 }}>
          {['+', '−'].map((lbl, i) => (
            <button key={lbl} onClick={() => applyZoom(zoom + (i === 0 ? ZOOM_STEP : -ZOOM_STEP))}
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: 'rgba(6,7,10,0.85)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16, lineHeight: 1, backdropFilter: 'blur(6px)' }}>
              {lbl}
            </button>
          ))}
          {zoom > 1 && (
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: 'rgba(232,0,45,0.15)', border: '1px solid rgba(232,0,45,0.4)',
                color: 'rgba(232,0,45,0.9)', fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', backdropFilter: 'blur(6px)' }}>
              FIT
            </button>
          )}
        </div>

        {zoom > 1 && (
          <div className="absolute bottom-4 left-14 pointer-events-none flex items-center" style={{ zIndex: 4 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
              {zoom.toFixed(1)}×
            </span>
          </div>
        )}

        {/* Session name */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 4, whiteSpace: 'nowrap' }}>
          <div style={{ padding: '3px 14px', background: 'rgba(6,7,10,0.7)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {sessionName}
            </span>
          </div>
        </div>

        {livePositions.length > 0 && (
          <div className="absolute bottom-4 right-4 pointer-events-none" style={{ zIndex: 4 }}>
            <div style={{ padding: '3px 10px', background: 'rgba(6,7,10,0.6)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                {livePositions.length} CARS
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
