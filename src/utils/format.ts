export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3).padStart(6, '0')
  return mins > 0 ? `${mins}:${secs}` : `${secs}s`
}

export function formatGap(gap: number | string | null): string {
  if (gap === null || gap === undefined) return '—'
  const n = typeof gap === 'string' ? parseFloat(gap) : gap
  if (isNaN(n)) return '—'
  if (n === 0) return 'Leader'
  return `+${n.toFixed(3)}s`
}

export function formatInterval(interval: number | string | null): string {
  if (interval === null || interval === undefined) return '—'
  const n = typeof interval === 'string' ? parseFloat(interval) : interval
  if (isNaN(n)) return '—'
  return `+${n.toFixed(3)}s`
}

export function formatSpeed(speed: number | null): string {
  if (speed === null) return '—'
  return `${speed} km/h`
}

export function tyreColor(compound: string): string {
  switch (compound) {
    case 'SOFT': return '#e8002d'
    case 'MEDIUM': return '#ffd600'
    case 'HARD': return '#ffffff'
    case 'INTERMEDIATE': return '#39b54a'
    case 'WET': return '#0067ff'
    default: return '#888888'
  }
}

export function flagColor(flag: string | null): string {
  switch (flag) {
    case 'GREEN': return '#00ff00'
    case 'YELLOW': return '#ffd600'
    case 'DOUBLE YELLOW': return '#ffd600'
    case 'RED': return '#ff0000'
    case 'BLUE': return '#0066ff'
    case 'CHEQUERED': return '#ffffff'
    default: return '#888888'
  }
}

export function teamHex(colour: string | undefined): string {
  if (!colour) return '#888888'
  return colour.startsWith('#') ? colour : `#${colour}`
}
