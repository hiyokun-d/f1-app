import { useEffect, useRef, useState, useMemo } from 'react'
import { animate, stagger } from 'animejs'
import { openF1 } from '../../api/openf1'
import type { Driver, SessionResult, Lap, Session } from '../../types'

interface Props {
  sessionKey: number
}

interface ApiStep {
  label: string
  endpoint: string
  status: 'pending' | 'loading' | 'done' | 'error'
  count: number
  ms: number
}

interface TimingRow {
  position: number
  driver: Driver
  gapToLeader: number | null
  bestLap: number | null
}

// Real Spa-Francorchamps circuit outline (layer transform applied in JSX)
const SPA_CIRCUIT_D =
  'm -1785.7292,792.86845 c -67.4631,47.6329 -136.8716,92.50853 -206.8599,136.34679 -10.3037,6.45387 -19.757,14.98157 -31.3516,18.63984 -4.0422,1.27539 -8.9373,2.93985 -12.6804,0.95103 -3.0093,-1.59895 -4.7806,-5.48102 -5.0722,-8.87629 -0.8187,-9.53376 7.0404,-21.07515 9.7848,-26.98746 18.7684,-40.4325 32.5731,-75.25655 52.3492,-111.10243 9.7931,-17.75091 20.0392,-35.44966 32.7158,-51.27062 18.5455,-23.14555 41.9063,-41.98211 62.7681,-63.06379 18.9528,-19.15258 37.8814,-38.3297 56.6921,-57.62194 13.0861,-13.42106 27.8076,-25.46016 39.0764,-40.4396 8.1158,-10.78821 12.3066,-24.14858 20.1823,-35.11326 5.8625,-8.16174 12.0461,-16.40465 19.9717,-22.58261 9.2179,-7.18533 20.1804,-12.05474 31.1401,-16.11486 14.2066,-5.26299 30.2284,-4.67101 44.2326,-10.45118 10.9909,-4.53647 20.3412,-11.6625 30.0033,-18.28029 17.0568,-11.68259 32.7571,-25.23249 49.2299,-37.72517 17.089,-12.95998 34.0853,-26.04969 51.461,-38.62259 13.3104,-9.63129 26.6578,-19.23313 40.4294,-28.19266 6.3654,-4.14118 12.7691,-8.25985 19.4855,-11.80332 10.1861,-5.37397 20.7582,-10.02659 31.458,-14.28671 28.2031,-11.22903 57.5917,-19.23915 86.1103,-29.64094 108.264,-39.48786 293.1142,-113.21099 322.5788,-124.36324 22.6881,-8.58731 44.78584,-19.5641 68.54911,-24.44216 4.97826,-1.02192 10.25088,-2.03266 15.2165,-0.95103 7.05353,1.53641 13.18102,5.45684 18.70361,9.82732 5.62536,4.4518 8.98322,10.71891 13.72938,15.85051 2.44332,2.64173 4.34429,5.40993 7.1933,7.29124 3.90756,2.58031 8.23097,3.99314 12.68041,4.75515 4.08707,0.69995 8.12389,0.25064 12.04639,-0.63402 13.47671,-3.03945 25.34866,-11.03439 38.31668,-15.79783 7.63492,-2.80447 15.21107,-6.06974 23.21569,-7.51304 6.25256,-1.12739 12.84477,-2.2351 19.04187,-0.83459 6.48144,1.46478 13.05132,4.55432 17.60471,9.35229 32.57422,34.32396 68.02275,76.28376 101.41094,114.96938 9.19604,10.6551 18.7466,21.03913 27.24162,32.26111 3.34682,4.42117 7.13555,8.68262 9.31992,13.77932 2.71702,6.33951 5.09616,13.35105 4.41688,20.21473 -0.54526,5.50943 -3.39367,10.7443 -6.65721,15.21649 -2.79802,3.83426 -6.5476,7.08539 -10.68316,9.41512 -4.23868,2.38782 -9.10345,3.73203 -13.92719,4.36421 -4.1389,0.54243 -8.47818,0.53765 -12.51128,-0.53882 -4.98042,-1.32932 -9.6397,-3.98067 -13.72664,-7.12211 -5.88512,-4.52362 -10.20033,-10.79654 -14.99469,-16.46328 -16.80602,-19.86403 -36.46855,-48.67955 -48.20682,-61.39464 -3.8937,-4.21773 -10.70563,-5.85072 -16.61115,-6.84762 -5.53122,-0.93371 -11.35495,-0.39092 -16.80155,0.95103 -10.48889,2.5843 -19.56952,9.16499 -29.50322,13.40964 -13.86635,5.92507 -27.95673,11.31293 -41.99323,16.8228 -15.83221,6.21476 -31.52489,12.83056 -47.62548,18.31266 -17.53362,5.97003 -35.38844,10.97628 -53.25773,15.85052 -33.16096,9.04537 -66.94416,15.70668 -100.08016,24.84326 -9.7944,2.7006 -19.8704,4.75196 -29.1649,8.85502 -7.09,3.1299 -13.9835,6.97978 -19.9818,11.88742 -5.0761,4.15307 -10.0042,8.8603 -13.2091,14.58247 -3.9907,7.1253 -5.5085,15.46241 -6.8902,23.51144 -1.2485,7.27362 -1.1231,14.7272 -1.2153,22.10663 -0.1087,8.70699 -0.2727,17.46774 0.7819,26.11131 1.2962,10.62416 3.285,21.26913 6.7839,31.38402 2.9508,8.53052 6.5939,17.01203 11.856,24.34601 3.5182,4.90342 8.2055,8.90703 12.881,12.72293 5.0928,4.15653 10.7589,7.57577 16.3893,10.96875 6.4793,3.90454 12.9479,7.96882 19.9717,10.77835 25.8772,10.35099 53.8898,14.26513 80.6685,21.99016 35.77334,10.31979 71.46774,20.95401 106.85272,32.53561 12.4506,4.07512 25.52589,6.84189 37.09021,12.99742 5.21868,2.77783 10.22039,6.24897 14.21279,10.60922 4.11526,4.49441 7.66833,9.777 9.60551,15.55476 2.00865,5.99092 2.42127,12.58714 1.77544,18.87274 -0.67802,6.59896 -3.13674,12.75078 -5.07216,19.02062 -3.29403,10.67111 -9.37446,20.57461 -11.11663,31.60584 -1.03499,6.55341 -0.95688,13.42418 0.49631,19.89771 1.54396,6.87791 4.43578,13.62044 8.55928,19.33763 1.83785,2.54817 4.42632,4.50198 6.97423,6.3402 16.6768,12.03165 35.0667,21.8406 53.77624,30.23245 25.09454,11.25573 53.03505,21.48818 74.86617,39.31943 5.17668,4.22822 9.8166,9.4941 12.68041,15.5335 2.49507,5.26178 3.93096,11.31213 3.48711,17.11856 -0.56373,7.37471 -3.87614,14.4746 -7.68218,20.81638 -14.20248,23.66475 -26.91889,43.25151 -43.85278,64.13123 -4.81571,5.9378 -10.91827,10.9691 -17.56218,14.7515 -5.85985,3.3361 -12.17858,5.5609 -18.70361,6.6785 -9.41546,1.6128 -18.9175,1.0666 -28.26659,-0.1054 -18.01915,-2.2588 -35.62573,-7.4797 -52.84459,-13.2506 -15.93641,-5.3411 -31.73219,-11.51717 -46.42122,-19.68592 -19.40702,-10.79248 -37.19441,-24.40485 -54.45184,-38.37952 -17.36931,-14.06527 -34.20019,-28.98774 -49.17914,-45.57554 -19.6266,-21.73462 -35.9563,-46.2591 -52.8558,-70.17575 -13.6581,-19.32944 -24.7379,-40.46589 -39.1928,-59.20698 -11.0578,-14.33677 -22.0725,-29.16913 -36.1918,-40.50338 -12.721,-10.21177 -28.0794,-16.66964 -42.6799,-23.94491 -15.2914,-7.61955 -30.8067,-14.95927 -46.9387,-20.58441 -26.3057,-9.17263 -53.357,-16.60149 -80.8164,-21.30347 -10.84,-1.85618 -21.9417,-3.78639 -32.8841,-2.68396 -10.9469,1.10289 -21.5093,5.04819 -31.701,9.1933 -17.1354,6.96924 -32.5314,17.62488 -48.9573,26.13257 -22.7858,11.80168 -44.9891,24.96619 -68.7912,34.55412 -11.7934,4.7506 -24.1638,7.95816 -36.4349,11.28575 -12.5672,3.40788 -25.3224,6.0876 -38.0413,8.87629 -41.2206,9.03784 -107.092,25.43683 -124.0139,25.45509 -3.4028,0.004 -8.8068,-3.63976 -10.7571,-7.56574 -1.3172,-2.65149 0.1623,-5.91969 0.317,-8.87629 0.321,-6.13503 2.8721,-12.45628 1.2681,-18.3866 -0.8341,-3.08385 -2.7788,-6.08362 -5.3892,-7.92525 -2.0524,-1.44794 -4.7881,-2.10965 -7.2912,-1.90207 -4.384,0.36355 -8.517,2.7635 -12.0464,5.38918 -24.1227,17.94583 -43.815,34.20182 -66.5093,50.22534 z'

function fmtLap(s: number | null): string {
  if (s === null || s === undefined) return '─:──.───'
  const m = Math.floor(s / 60)
  const rem = (s % 60).toFixed(3).padStart(6, '0')
  return `${m}:${rem}`
}

function fmtGap(g: number | null): string {
  if (g === null || g === undefined) return 'LEADER'
  if (g >= 60) return `+${Math.floor(g / 60)} LAP`
  return `+${g.toFixed(3)}`
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

function posColor(i: number): string {
  if (i === 0) return '#ae50f5'  // P1 — fastest purple
  if (i <= 2) return '#22c55e'   // P2-3 — green
  return '#8a9ab2'               // rest
}

const INITIAL_STEPS: ApiStep[] = [
  { label: 'Session info', endpoint: '/sessions', status: 'pending', count: 0, ms: 0 },
  { label: 'Drivers', endpoint: '/drivers', status: 'pending', count: 0, ms: 0 },
  { label: 'Race result', endpoint: '/session_result', status: 'pending', count: 0, ms: 0 },
  { label: 'Lap times', endpoint: '/laps', status: 'pending', count: 0, ms: 0 },
]

export default function ComingSoon({ sessionKey }: Props) {
  const circuitRef = useRef<SVGPathElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)

  const [steps, setSteps] = useState<ApiStep[]>(INITIAL_STEPS)
  const [session, setSession] = useState<Session | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [results, setResults] = useState<SessionResult[]>([])
  const [laps, setLaps] = useState<Lap[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [blink, setBlink] = useState(true)

  const setStep = (i: number, patch: Partial<ApiStep>) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))

  // Fetch real data from OpenF1 API
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // Step 0: Session
      setStep(0, { status: 'loading' })
      const t0 = Date.now()
      try {
        const sess = await openF1.sessions({ session_key: sessionKey })
        if (cancelled) return
        if (sess[0]) setSession(sess[0])
        setStep(0, { status: 'done', count: sess.length, ms: Date.now() - t0 })
      } catch { setStep(0, { status: 'error' }) }

      // Step 1: Drivers
      setStep(1, { status: 'loading' })
      const t1 = Date.now()
      try {
        const drvs = await openF1.drivers({ session_key: sessionKey })
        if (cancelled) return
        setDrivers(drvs)
        setStep(1, { status: 'done', count: drvs.length, ms: Date.now() - t1 })
      } catch { setStep(1, { status: 'error' }) }

      // Step 2: Session result
      setStep(2, { status: 'loading' })
      const t2 = Date.now()
      try {
        const res = await openF1.sessionResult({ session_key: sessionKey })
        if (cancelled) return
        setResults(res)
        setStep(2, { status: 'done', count: res.length, ms: Date.now() - t2 })
      } catch { setStep(2, { status: 'error' }) }

      // Step 3: Laps
      setStep(3, { status: 'loading' })
      const t3 = Date.now()
      try {
        const lapData = await openF1.laps({ session_key: sessionKey })
        if (cancelled) return
        setLaps(lapData)
        setStep(3, { status: 'done', count: lapData.length, ms: Date.now() - t3 })
        setDataReady(true)
      } catch {
        setStep(3, { status: 'error' })
        setDataReady(true) // show whatever we have
      }
    }
    run()
    return () => { cancelled = true }
  }, [sessionKey])

  // Animate circuit draw-in
  useEffect(() => {
    const p = circuitRef.current
    if (!p) return
    const len = p.getTotalLength()
    p.style.strokeDasharray = `${len}`
    p.style.strokeDashoffset = `${len}`
    animate(p, { strokeDashoffset: [len, 0], duration: 2200, easing: 'easeInOutSine', delay: 200 })
  }, [])

  // Animate rows in when data arrives
  useEffect(() => {
    if (!dataReady || !rowsRef.current) return
    const rows = rowsRef.current.querySelectorAll('.timing-row')
    if (!rows.length) return
    animate(rows, {
      opacity: [0, 1],
      translateX: [-14, 0],
      delay: stagger(55, { start: 80 }),
      duration: 320,
      easing: 'easeOutCubic',
    })
  }, [dataReady])

  // Blinking cursor
  useEffect(() => {
    const iv = setInterval(() => setBlink(b => !b), 520)
    return () => clearInterval(iv)
  }, [])

  // Build timing rows
  const timingRows = useMemo((): TimingRow[] => {
    if (!drivers.length) return []

    const driverMap: Record<number, Driver> = {}
    for (const d of drivers) driverMap[d.driver_number] = d

    const bestLaps: Record<number, number> = {}
    for (const l of laps) {
      if (l.lap_duration && (!bestLaps[l.driver_number] || l.lap_duration < bestLaps[l.driver_number])) {
        bestLaps[l.driver_number] = l.lap_duration
      }
    }

    if (results.length) {
      return results
        .filter(r => driverMap[r.driver_number])
        .sort((a, b) => a.position - b.position)
        .map(r => ({
          position: r.position,
          driver: driverMap[r.driver_number],
          gapToLeader: r.gap_to_leader,
          bestLap: bestLaps[r.driver_number] ?? null,
        }))
    }

    // Fallback: show drivers with no position data yet
    return drivers.map((d, i) => ({
      position: i + 1,
      driver: d,
      gapToLeader: null,
      bestLap: bestLaps[d.driver_number] ?? null,
    }))
  }, [drivers, results, laps])

  const sessionLabel = session
    ? `${session.country_name} ${session.session_name} · ${session.circuit_short_name} · ${session.year}`
    : `Session #${sessionKey}`

  const fastestLap = timingRows.reduce<number | null>((best, r) => {
    if (r.bestLap === null) return best
    return best === null || r.bestLap < best ? r.bestLap : best
  }, null)

  const fastestDriver = fastestLap !== null
    ? timingRows.find(r => r.bestLap === fastestLap)
    : null

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#040507', fontFamily: 'var(--font-display)', color: '#f0f0f0' }}
    >
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none scanlines" style={{ zIndex: 20, opacity: 0.25 }} />

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 h-10 shrink-0"
        style={{ background: '#06070a', borderBottom: '2px solid var(--f1-red)', zIndex: 15 }}
      >
        <div className="flex items-center gap-2.5">
          {/* Mini Spa-Francorchamps badge */}
          <svg viewBox="0 0 1415 875" width="56" height="35" style={{ overflow: 'visible', opacity: 0.7 }}>
            <g transform="translate(2047.7528,-153.52072)">
              <path d={SPA_CIRCUIT_D} fill="none" stroke="#e8002d" strokeWidth="14" strokeLinejoin="round" />
            </g>
          </svg>
          <svg viewBox="0 0 1415 875" width="56" height="35" className="absolute"
            style={{ overflow: 'visible', marginLeft: 0 }}>
            <g transform="translate(2047.7528,-153.52072)">
              <path
                ref={circuitRef}
                d={SPA_CIRCUIT_D}
                fill="none"
                stroke="#ffffff"
                strokeWidth="7"
                strokeLinejoin="round"
              />
            </g>
          </svg>

          <div className="w-7 h-6 flex items-center justify-center shrink-0"
            style={{ background: 'var(--f1-red)', marginLeft: 8 }}>
            <span className="text-white font-black text-[10px]" style={{ letterSpacing: '-0.05em' }}>F1</span>
          </div>
          <div className="h-3.5 w-px bg-[#1f2330]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Race Center</span>
          <div className="h-3.5 w-px bg-[#1f2330]" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#3a4052]"
            style={{ fontFamily: 'var(--font-data)' }}>
            Timing Tower
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1"
            style={{ background: 'rgba(255,214,0,0.06)', border: '1px solid rgba(255,214,0,0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: '#ffd600', boxShadow: '0 0 5px #ffd600', animation: 'flag-pulse 1.5s ease-in-out infinite' }} />
            <span className="text-[9px] uppercase tracking-[0.2em]"
              style={{ fontFamily: 'var(--font-data)', color: '#7a6828' }}>Safety Car</span>
          </div>
          <span className="text-[11px] text-[#1f2330]" style={{ fontFamily: 'var(--font-data)', minWidth: 8 }}>
            {blink ? '█' : ' '}
          </span>
        </div>
      </div>

      {/* ── SESSION LABEL ─────────────────────────────────────────── */}
      <div
        className="px-4 h-8 flex items-center gap-4 shrink-0"
        style={{ background: '#080a0e', borderBottom: '1px solid #111318' }}
      >
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#4a5268]"
          style={{ fontFamily: 'var(--font-data)' }}>
          {sessionLabel}
        </span>
        <div className="flex-1" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-[#252a36]"
          style={{ fontFamily: 'var(--font-data)' }}>
          openf1.org/v1 · live data
        </span>
      </div>

      {/* ── BODY: two columns ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT: API data feed */}
        <div
          className="w-56 shrink-0 flex flex-col pt-3"
          style={{ borderRight: '1px solid #111318', background: '#040609' }}
        >
          <div className="px-3 pb-2">
            <span className="text-[9px] uppercase tracking-[0.28em] text-[#252a36]"
              style={{ fontFamily: 'var(--font-display)' }}>
              Api endpoints
            </span>
          </div>

          <div className="flex flex-col gap-0 overflow-y-auto">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex flex-col px-3 py-2.5"
                style={{ borderBottom: '1px solid #0c0d11' }}
              >
                <div className="flex items-center gap-2">
                  {/* Status indicator */}
                  {step.status === 'done' && (
                    <span className="text-[10px] shrink-0" style={{ color: '#22c55e', fontFamily: 'var(--font-data)' }}>✓</span>
                  )}
                  {step.status === 'loading' && (
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: '#ffd600', boxShadow: '0 0 5px #ffd600', animation: 'flag-pulse 0.8s ease-in-out infinite' }} />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-2 h-2 rounded-full shrink-0 bg-[#1f2330]" />
                  )}
                  {step.status === 'error' && (
                    <span className="text-[10px] shrink-0" style={{ color: '#ef4444', fontFamily: 'var(--font-data)' }}>✗</span>
                  )}
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: step.status === 'done' ? '#e0e0e0'
                        : step.status === 'loading' ? '#ffd600'
                        : step.status === 'error' ? '#ef4444'
                        : '#353d50',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                <span className="text-[9px] mt-0.5 ml-4" style={{ fontFamily: 'var(--font-data)', color: '#252a36' }}>
                  {step.endpoint}
                </span>
                {step.status === 'done' && (
                  <div className="flex items-center gap-2 ml-4 mt-0.5">
                    <span className="text-[9px]" style={{ fontFamily: 'var(--font-data)', color: '#22c55e' }}>
                      {step.count} records
                    </span>
                    <span className="text-[9px] text-[#252a36]" style={{ fontFamily: 'var(--font-data)' }}>
                      {step.ms}ms
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Spacer + system status */}
          <div className="mt-auto px-3 pb-3 pt-2 border-t border-[#0c0d11]">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#1f2330] mb-2"
              style={{ fontFamily: 'var(--font-display)' }}>
              Data Summary
            </div>
            {[
              { label: 'Drivers', val: drivers.length || '—' },
              { label: 'Results', val: results.length || '—' },
              { label: 'Lap records', val: laps.length || '—' },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-[9px] text-[#353d50]"
                  style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
                <span className="text-[10px] font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-data)', color: '#5a6272' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Timing tower */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Column headers */}
          <div
            className="grid items-center shrink-0 px-3 h-8"
            style={{
              gridTemplateColumns: '32px 4px 36px 52px 1fr 90px 72px',
              gap: '0 10px',
              background: 'var(--f1-red)',
              borderBottom: '1px solid #c0001e',
            }}
          >
            {['P', '', '#', 'DRV', 'Team', 'Best Lap', 'Gap'].map((col, i) => (
              <span key={i}
                className="text-[10px] font-bold uppercase tracking-widest text-white truncate"
                style={{ fontFamily: 'var(--font-display)', textAlign: i >= 5 ? 'right' : 'left' }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div ref={rowsRef} className="flex-1 overflow-y-auto">
            {!dataReady ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i}
                  className="grid items-center px-3 h-10"
                  style={{
                    gridTemplateColumns: '32px 4px 36px 52px 1fr 90px 72px',
                    gap: '0 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent',
                    opacity: 1 - i * 0.08,
                  }}>
                  <div className="h-3 w-5 bg-[#111318] rounded-sm" style={{ filter: 'blur(1px)' }} />
                  <div />
                  <div className="h-3 w-7 bg-[#111318] rounded-sm" style={{ filter: 'blur(1px)' }} />
                  <div className="h-4 w-10 bg-[#111318] rounded-sm" style={{ filter: 'blur(1px)' }} />
                  <div className="h-3 w-32 bg-[#111318] rounded-sm" style={{ filter: 'blur(1px)' }} />
                  <div className="h-3 w-20 bg-[#111318] rounded-sm ml-auto" style={{ filter: 'blur(1px)' }} />
                  <div className="h-3 w-16 bg-[#111318] rounded-sm ml-auto" style={{ filter: 'blur(1px)' }} />
                </div>
              ))
            ) : timingRows.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[#2e3444] text-[11px] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-data)' }}>
                No data available for session #{sessionKey}
              </div>
            ) : (
              timingRows.map((row, i) => {
                const teamRgb = row.driver.team_colour ? hexToRgb(row.driver.team_colour) : '90,98,114'
                const isFL = row.bestLap !== null && row.bestLap === fastestLap
                const timeColor = isFL ? '#ae50f5' : i < 3 ? '#22c55e' : '#8a9ab2'

                return (
                  <div
                    key={row.driver.driver_number}
                    className="timing-row grid items-center px-3 h-10"
                    style={{
                      gridTemplateColumns: '32px 4px 36px 52px 1fr 90px 72px',
                      gap: '0 10px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: i % 2 === 0
                        ? `rgba(${teamRgb}, 0.025)`
                        : 'transparent',
                      opacity: 0, // AnimeJS will animate to 1
                    }}
                  >
                    {/* Position */}
                    <span
                      className="text-[14px] font-bold tabular-nums"
                      style={{ fontFamily: 'var(--font-data)', color: posColor(i) }}
                    >
                      {String(row.position).padStart(2, ' ')}
                    </span>

                    {/* Team color bar */}
                    <div
                      style={{
                        height: '60%',
                        width: 4,
                        background: row.driver.team_colour ? `#${row.driver.team_colour}` : '#3a4052',
                        boxShadow: `0 0 8px rgba(${teamRgb}, 0.6)`,
                      }}
                    />

                    {/* Driver number */}
                    <span
                      className="text-[11px] tabular-nums"
                      style={{
                        fontFamily: 'var(--font-data)',
                        color: `#${row.driver.team_colour || '5a6272'}`,
                      }}
                    >
                      {row.driver.driver_number}
                    </span>

                    {/* Abbreviation */}
                    <span
                      className="text-[15px] font-black uppercase tracking-wide"
                      style={{ fontFamily: 'var(--font-display)', color: i === 0 ? '#ffffff' : '#d0d0d0' }}
                    >
                      {row.driver.name_acronym}
                    </span>

                    {/* Team name */}
                    <span
                      className="text-[11px] uppercase tracking-wide truncate"
                      style={{ fontFamily: 'var(--font-display)', color: '#4a5268' }}
                    >
                      {row.driver.team_name}
                    </span>

                    {/* Best lap */}
                    <span
                      className="text-[12px] tabular-nums text-right"
                      style={{
                        fontFamily: 'var(--font-data)',
                        color: timeColor,
                        textShadow: isFL ? '0 0 12px rgba(174,80,245,0.6)' : undefined,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {fmtLap(row.bestLap)}
                    </span>

                    {/* Gap */}
                    <span
                      className="text-[11px] tabular-nums text-right"
                      style={{
                        fontFamily: 'var(--font-data)',
                        color: row.gapToLeader === null ? '#ffd600' : '#5a6272',
                        fontWeight: row.gapToLeader === null ? 700 : 400,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {fmtGap(row.gapToLeader)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-9"
        style={{ background: '#06070a', borderTop: '1px solid #111318', zIndex: 15 }}
      >
        <div className="flex items-center gap-3">
          {fastestDriver ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#ae50f5', boxShadow: '0 0 6px #ae50f5' }} />
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#3a4052]"
                style={{ fontFamily: 'var(--font-data)' }}>
                Fastest Lap
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide"
                style={{ fontFamily: 'var(--font-display)', color: '#ae50f5' }}>
                {fastestDriver.driver.name_acronym}
              </span>
              <span className="text-[11px] tabular-nums"
                style={{ fontFamily: 'var(--font-data)', color: '#ae50f5', letterSpacing: '-0.02em' }}>
                {fmtLap(fastestLap)}
              </span>
            </>
          ) : (
            <span className="text-[9px] uppercase tracking-[0.25em] text-[#252a36]"
              style={{ fontFamily: 'var(--font-data)' }}>
              Fetching data from openf1.org…
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-3 w-px bg-[#1f2330]" />
          <span className="text-[9px] uppercase tracking-[0.28em] text-[#252a36]"
            style={{ fontFamily: 'var(--font-display)' }}>
            Race UI under construction · Engineered by{' '}
            <span style={{ color: 'var(--f1-red)' }}>hiyo</span>
          </span>
        </div>
      </div>
    </div>
  )
}
