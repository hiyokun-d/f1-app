import { useRef, useEffect, useState, useCallback } from 'react'
import type { TeamRadio, Driver } from '../../types'
import { teamHex } from '../../utils/format'

interface Props {
  radio: TeamRadio[]
  drivers: Driver[]
  selectedDriver: number | null
}

const BAR_COUNT = 32

// Proxy F1 audio through Vite dev server to bypass CORS
function proxyAudioUrl(url: string): string {
  return url.replace('https://livetiming.formula1.com', '/f1-audio')
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

export default function TeamRadioPlayer({ radio, drivers, selectedDriver }: Props) {
  const [activeMsg, setActiveMsg] = useState<TeamRadio | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [useRealAudio, setUseRealAudio] = useState(true)

  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  // simulated bar values for fallback
  const barsRef = useRef(new Float32Array(BAR_COUNT).fill(0))
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying

  const driverMap = new Map(drivers.map(d => [d.driver_number, d]))

  // Filter to selected driver or show all (last 20)
  const filtered = radio
    .filter(r => selectedDriver === null || r.driver_number === selectedDriver)
    .slice(-20)
    .reverse()

  // Draw visualizer (real or simulated)
  const drawBars = useCallback((dataArray?: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0f12'
    ctx.fillRect(0, 0, W, H)

    const barW = (W / BAR_COUNT) - 1
    const playing = isPlayingRef.current

    for (let i = 0; i < BAR_COUNT; i++) {
      let barH: number
      if (dataArray) {
        // Real audio data
        barH = (dataArray[i] / 255) * H
      } else {
        // Simulated
        if (playing) {
          // Spiky noise that decays
          barsRef.current[i] = Math.max(0,
            barsRef.current[i] * 0.82 + (Math.random() < 0.4 ? Math.random() * 0.9 : 0)
          )
        } else {
          barsRef.current[i] *= 0.88
        }
        barH = barsRef.current[i] * H
      }

      if (barH < 1) barH = playing ? Math.random() * 3 : 1

      // F1 red → orange gradient per bar based on height
      const intensity = barH / H
      const r = 232
      const g = Math.round(intensity * 120)
      const b = Math.round(45 * (1 - intensity))
      ctx.fillStyle = `rgb(${r},${g},${b})`

      const x = i * (barW + 1)
      ctx.fillRect(x, H - barH, barW, barH)
    }

    // Only keep RAF loop alive while playing — stop when idle
    if (isPlayingRef.current) {
      animRef.current = requestAnimationFrame(() => {
        if (analyserRef.current && useRealAudio) {
          const arr = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(arr)
          drawBars(arr)
        } else {
          drawBars()
        }
      })
    }
  }, [useRealAudio])

  // Start/stop animation loop
  useEffect(() => {
    cancelAnimationFrame(animRef.current)
    drawBars()
    return () => cancelAnimationFrame(animRef.current)
  }, [drawBars, isPlaying])

  // Set up Web Audio API
  const setupAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audioCtxRef.current) return
    try {
      audioCtxRef.current = new AudioContext()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = BAR_COUNT * 2
      sourceRef.current = audioCtxRef.current.createMediaElementSource(audio)
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioCtxRef.current.destination)
    } catch {
      setUseRealAudio(false)
    }
  }, [])

  const handlePlay = useCallback(async (msg: TeamRadio) => {
    const audio = audioRef.current
    if (!audio) return

    if (activeMsg?.recording_url === msg.recording_url && isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    setActiveMsg(msg)
    setIsPlaying(false)
    audio.crossOrigin = 'anonymous'
    audio.src = proxyAudioUrl(msg.recording_url)

    try {
      setupAudio()
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      await audio.play()
      setIsPlaying(true)
    } catch {
      // CORS or autoplay blocked — still update UI
      setUseRealAudio(false)
      setIsPlaying(true)
      setTimeout(() => setIsPlaying(false), 10000)
    }
  }, [activeMsg, isPlaying, setupAudio])

  const handleEnded = useCallback(() => setIsPlaying(false), [])

  return (
    <div className="h-full flex flex-col" style={{ background: 'transparent' }}>
      <div className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(4,5,8,0.5)' }}>
        <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Team Radio</span>
        <span className="text-[10px] text-[#6b7280]">{filtered.length} clips</span>
      </div>

      {/* Waveform visualizer */}
      <div className="shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {activeMsg && (
          <div className="px-3 py-1.5 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#e8002d] animate-pulse' : 'bg-[#6b7280]'}`} />
            <span className="text-[10px] text-white font-bold">
              {driverMap.get(activeMsg.driver_number)?.name_acronym ?? `#${activeMsg.driver_number}`}
            </span>
            <span className="text-[10px] text-[#6b7280]">{formatTime(activeMsg.date)}</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={320}
          height={48}
          className="w-full"
          style={{ height: 48 }}
        />
      </div>

      {/* Audio element (hidden) */}
      <audio ref={audioRef} onEnded={handleEnded} preload="none" />

      {/* Radio message list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7280] text-xs">
            No radio messages
          </div>
        ) : (
          filtered.map((msg, i) => {
            const driver = driverMap.get(msg.driver_number)
            const color = teamHex(driver?.team_colour)
            const isActive = activeMsg?.recording_url === msg.recording_url
            const isThisPlaying = isActive && isPlaying

            return (
              <button
                key={`${msg.date}-${i}`}
                onClick={() => handlePlay(msg)}
                className={`w-full flex items-center gap-2 px-3 py-2 border-b border-[#1a1d22] text-left transition-all duration-150 ${
                  isActive ? 'bg-[#1f2229]' : 'hover:bg-[#16191e]'
                }`}
              >
                {/* Play indicator */}
                <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: isThisPlaying ? color : '#2a2d35' }}>
                  <span className="text-[9px]" style={{ color: isThisPlaying ? '#fff' : '#6b7280' }}>
                    {isThisPlaying ? '▐▐' : '▶'}
                  </span>
                </div>

                {/* Driver info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-bold"
                      style={{ color }}
                    >
                      {driver?.name_acronym ?? `#${msg.driver_number}`}
                    </span>
                    <span className="text-[9px] text-[#6b7280] truncate">
                      {driver?.team_name}
                    </span>
                  </div>
                  <span className="text-[9px] text-[#6b7280]">{formatTime(msg.date)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
