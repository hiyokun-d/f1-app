import { useState, useEffect } from 'react'
import type { TrackPoint } from './useTrackMap'

/**
 * Samples a circuit SVG path into GPS container space.
 * Returns 501 evenly-spaced points (loop-closed) so both simulation
 * and arc-following animation follow the same clean path.
 */
export function useSvgOutline(
  circuitSvgUrl: string | null,
  gpsOutline: TrackPoint[],
): TrackPoint[] {
  // Raw sample in SVG viewBox coordinate space
  const [sample, setSample] = useState<{ pts: TrackPoint[]; vbW: number; vbH: number } | null>(null)
  // Final points in GPS container space
  const [svgOutline, setSvgOutline] = useState<TrackPoint[]>([])

  // Fetch + sample once per URL change
  useEffect(() => {
    if (!circuitSvgUrl) { setSample(null); return }
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
        const dMatch = text.match(/\bd="([^"]+)"/)
        if (!dMatch) return
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathEl.setAttribute('d', dMatch[1])
        const total = pathEl.getTotalLength()
        if (!total) return
        const N = 500
        const pts: TrackPoint[] = []
        for (let i = 0; i < N; i++) {
          const pt = pathEl.getPointAtLength((i / N) * total)
          pts.push({ x: pt.x, y: pt.y })
        }
        pts.push({ ...pts[0] })  // close loop — eliminates sharp seam at circuit start/end
        if (!cancelled) setSample({ pts, vbW, vbH })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [circuitSvgUrl])

  // Map sample → GPS container space whenever bounds change (container resize, session change)
  useEffect(() => {
    if (!sample || !gpsOutline.length) { setSvgOutline([]); return }
    const xs = gpsOutline.map(p => p.x), ys = gpsOutline.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const sx = (maxX - minX) / sample.vbW
    const sy = (maxY - minY) / sample.vbH
    setSvgOutline(sample.pts.map(p => ({ x: p.x * sx + minX, y: p.y * sy + minY })))
  }, [sample, gpsOutline])

  return svgOutline
}
