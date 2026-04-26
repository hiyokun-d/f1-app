import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { animate, stagger } from 'animejs'

const SESSION = {
  key: 9140,
  name: 'Belgium Grand Prix',
  subtitle: 'Sprint Race',
  circuit: 'Circuit de Spa-Francorchamps',
  date: '29 Jul 2023',
  laps: 15,
  country: 'BEL',
  round: 12,
}

// Real Spa-Francorchamps circuit outline (from Inkscape SVG, layer transform applied in JSX)
const SPA_CIRCUIT_D =
  'm -1785.7292,792.86845 c -67.4631,47.6329 -136.8716,92.50853 -206.8599,136.34679 -10.3037,6.45387 -19.757,14.98157 -31.3516,18.63984 -4.0422,1.27539 -8.9373,2.93985 -12.6804,0.95103 -3.0093,-1.59895 -4.7806,-5.48102 -5.0722,-8.87629 -0.8187,-9.53376 7.0404,-21.07515 9.7848,-26.98746 18.7684,-40.4325 32.5731,-75.25655 52.3492,-111.10243 9.7931,-17.75091 20.0392,-35.44966 32.7158,-51.27062 18.5455,-23.14555 41.9063,-41.98211 62.7681,-63.06379 18.9528,-19.15258 37.8814,-38.3297 56.6921,-57.62194 13.0861,-13.42106 27.8076,-25.46016 39.0764,-40.4396 8.1158,-10.78821 12.3066,-24.14858 20.1823,-35.11326 5.8625,-8.16174 12.0461,-16.40465 19.9717,-22.58261 9.2179,-7.18533 20.1804,-12.05474 31.1401,-16.11486 14.2066,-5.26299 30.2284,-4.67101 44.2326,-10.45118 10.9909,-4.53647 20.3412,-11.6625 30.0033,-18.28029 17.0568,-11.68259 32.7571,-25.23249 49.2299,-37.72517 17.089,-12.95998 34.0853,-26.04969 51.461,-38.62259 13.3104,-9.63129 26.6578,-19.23313 40.4294,-28.19266 6.3654,-4.14118 12.7691,-8.25985 19.4855,-11.80332 10.1861,-5.37397 20.7582,-10.02659 31.458,-14.28671 28.2031,-11.22903 57.5917,-19.23915 86.1103,-29.64094 108.264,-39.48786 293.1142,-113.21099 322.5788,-124.36324 22.6881,-8.58731 44.78584,-19.5641 68.54911,-24.44216 4.97826,-1.02192 10.25088,-2.03266 15.2165,-0.95103 7.05353,1.53641 13.18102,5.45684 18.70361,9.82732 5.62536,4.4518 8.98322,10.71891 13.72938,15.85051 2.44332,2.64173 4.34429,5.40993 7.1933,7.29124 3.90756,2.58031 8.23097,3.99314 12.68041,4.75515 4.08707,0.69995 8.12389,0.25064 12.04639,-0.63402 13.47671,-3.03945 25.34866,-11.03439 38.31668,-15.79783 7.63492,-2.80447 15.21107,-6.06974 23.21569,-7.51304 6.25256,-1.12739 12.84477,-2.2351 19.04187,-0.83459 6.48144,1.46478 13.05132,4.55432 17.60471,9.35229 32.57422,34.32396 68.02275,76.28376 101.41094,114.96938 9.19604,10.6551 18.7466,21.03913 27.24162,32.26111 3.34682,4.42117 7.13555,8.68262 9.31992,13.77932 2.71702,6.33951 5.09616,13.35105 4.41688,20.21473 -0.54526,5.50943 -3.39367,10.7443 -6.65721,15.21649 -2.79802,3.83426 -6.5476,7.08539 -10.68316,9.41512 -4.23868,2.38782 -9.10345,3.73203 -13.92719,4.36421 -4.1389,0.54243 -8.47818,0.53765 -12.51128,-0.53882 -4.98042,-1.32932 -9.6397,-3.98067 -13.72664,-7.12211 -5.88512,-4.52362 -10.20033,-10.79654 -14.99469,-16.46328 -16.80602,-19.86403 -36.46855,-48.67955 -48.20682,-61.39464 -3.8937,-4.21773 -10.70563,-5.85072 -16.61115,-6.84762 -5.53122,-0.93371 -11.35495,-0.39092 -16.80155,0.95103 -10.48889,2.5843 -19.56952,9.16499 -29.50322,13.40964 -13.86635,5.92507 -27.95673,11.31293 -41.99323,16.8228 -15.83221,6.21476 -31.52489,12.83056 -47.62548,18.31266 -17.53362,5.97003 -35.38844,10.97628 -53.25773,15.85052 -33.16096,9.04537 -66.94416,15.70668 -100.08016,24.84326 -9.7944,2.7006 -19.8704,4.75196 -29.1649,8.85502 -7.09,3.1299 -13.9835,6.97978 -19.9818,11.88742 -5.0761,4.15307 -10.0042,8.8603 -13.2091,14.58247 -3.9907,7.1253 -5.5085,15.46241 -6.8902,23.51144 -1.2485,7.27362 -1.1231,14.7272 -1.2153,22.10663 -0.1087,8.70699 -0.2727,17.46774 0.7819,26.11131 1.2962,10.62416 3.285,21.26913 6.7839,31.38402 2.9508,8.53052 6.5939,17.01203 11.856,24.34601 3.5182,4.90342 8.2055,8.90703 12.881,12.72293 5.0928,4.15653 10.7589,7.57577 16.3893,10.96875 6.4793,3.90454 12.9479,7.96882 19.9717,10.77835 25.8772,10.35099 53.8898,14.26513 80.6685,21.99016 35.77334,10.31979 71.46774,20.95401 106.85272,32.53561 12.4506,4.07512 25.52589,6.84189 37.09021,12.99742 5.21868,2.77783 10.22039,6.24897 14.21279,10.60922 4.11526,4.49441 7.66833,9.777 9.60551,15.55476 2.00865,5.99092 2.42127,12.58714 1.77544,18.87274 -0.67802,6.59896 -3.13674,12.75078 -5.07216,19.02062 -3.29403,10.67111 -9.37446,20.57461 -11.11663,31.60584 -1.03499,6.55341 -0.95688,13.42418 0.49631,19.89771 1.54396,6.87791 4.43578,13.62044 8.55928,19.33763 1.83785,2.54817 4.42632,4.50198 6.97423,6.3402 16.6768,12.03165 35.0667,21.8406 53.77624,30.23245 25.09454,11.25573 53.03505,21.48818 74.86617,39.31943 5.17668,4.22822 9.8166,9.4941 12.68041,15.5335 2.49507,5.26178 3.93096,11.31213 3.48711,17.11856 -0.56373,7.37471 -3.87614,14.4746 -7.68218,20.81638 -14.20248,23.66475 -26.91889,43.25151 -43.85278,64.13123 -4.81571,5.9378 -10.91827,10.9691 -17.56218,14.7515 -5.85985,3.3361 -12.17858,5.5609 -18.70361,6.6785 -9.41546,1.6128 -18.9175,1.0666 -28.26659,-0.1054 -18.01915,-2.2588 -35.62573,-7.4797 -52.84459,-13.2506 -15.93641,-5.3411 -31.73219,-11.51717 -46.42122,-19.68592 -19.40702,-10.79248 -37.19441,-24.40485 -54.45184,-38.37952 -17.36931,-14.06527 -34.20019,-28.98774 -49.17914,-45.57554 -19.6266,-21.73462 -35.9563,-46.2591 -52.8558,-70.17575 -13.6581,-19.32944 -24.7379,-40.46589 -39.1928,-59.20698 -11.0578,-14.33677 -22.0725,-29.16913 -36.1918,-40.50338 -12.721,-10.21177 -28.0794,-16.66964 -42.6799,-23.94491 -15.2914,-7.61955 -30.8067,-14.95927 -46.9387,-20.58441 -26.3057,-9.17263 -53.357,-16.60149 -80.8164,-21.30347 -10.84,-1.85618 -21.9417,-3.78639 -32.8841,-2.68396 -10.9469,1.10289 -21.5093,5.04819 -31.701,9.1933 -17.1354,6.96924 -32.5314,17.62488 -48.9573,26.13257 -22.7858,11.80168 -44.9891,24.96619 -68.7912,34.55412 -11.7934,4.7506 -24.1638,7.95816 -36.4349,11.28575 -12.5672,3.40788 -25.3224,6.0876 -38.0413,8.87629 -41.2206,9.03784 -107.092,25.43683 -124.0139,25.45509 -3.4028,0.004 -8.8068,-3.63976 -10.7571,-7.56574 -1.3172,-2.65149 0.1623,-5.91969 0.317,-8.87629 0.321,-6.13503 2.8721,-12.45628 1.2681,-18.3866 -0.8341,-3.08385 -2.7788,-6.08362 -5.3892,-7.92525 -2.0524,-1.44794 -4.7881,-2.10965 -7.2912,-1.90207 -4.384,0.36355 -8.517,2.7635 -12.0464,5.38918 -24.1227,17.94583 -43.815,34.20182 -66.5093,50.22534 z'

function fmtLapTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
}

export default function Home() {
  const navigate = useNavigate()
  const pathRef = useRef<SVGPathElement>(null)
  const [litCount, setLitCount] = useState(0)
  const [lightsOut, setLightsOut] = useState(false)

  // Draw circuit with AnimeJS stroke-dashoffset
  useEffect(() => {
    const p = pathRef.current
    if (!p) return
    const len = p.getTotalLength()
    p.style.strokeDasharray = `${len}`
    p.style.strokeDashoffset = `${len}`
    animate(p, {
      strokeDashoffset: [len, 0],
      duration: 2800,
      easing: 'easeInOutSine',
      delay: 250,
    })
  }, [])

  // Starting lights sequence
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = []
    ;[550, 1000, 1450, 1900, 2350].forEach((t, i) =>
      ts.push(setTimeout(() => setLitCount(i + 1), t))
    )
    ts.push(setTimeout(() => setLightsOut(true), 3250))
    return () => ts.forEach(clearTimeout)
  }, [])

  // AnimeJS staggered content reveal
  useEffect(() => {
    const t = setTimeout(() => {
      animate('.home-reveal', {
        opacity: [0, 1],
        translateY: [18, 0],
        delay: stagger(110, { start: 350 }),
        duration: 480,
        easing: 'easeOutCubic',
      })
    }, 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: '#040507', fontFamily: 'var(--font-display)' }}
    >
      {/* ── LEFT: Circuit schematic ───────────────────────────────── */}
      <div
        className="hidden md:flex flex-col items-center justify-center relative shrink-0"
        style={{ width: '42%', borderRight: '1px solid #111318' }}
      >
        {/* Vertical label strip */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center gap-3"
          style={{ borderRight: '1px solid #0e0f12' }}>
          <div className="w-px flex-1" style={{ background: 'linear-gradient(to bottom, transparent, var(--f1-red) 50%, transparent)' }} />
          <span
            className="text-[9px] uppercase tracking-[0.4em] text-[#2e3444]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--font-data)' }}
          >
            Formula One
          </span>
          <div className="w-px flex-1" style={{ background: 'linear-gradient(to bottom, transparent, #1f2330 50%, transparent)' }} />
        </div>

        {/* Background radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 55% 50%, rgba(232,0,45,0.05) 0%, transparent 70%)' }}
        />

        {/* Circuit SVG — real Spa-Francorchamps layout */}
        <svg viewBox="0 0 1415 875" width="330" height="204" style={{ overflow: 'visible' }}>
          <g transform="translate(2047.7528,-153.52072)">
            {/* Glow halo */}
            <path d={SPA_CIRCUIT_D} fill="none" stroke="rgba(232,0,45,0.14)" strokeWidth="10" strokeLinejoin="round" />
            {/* Animated track line */}
            <path
              ref={pathRef}
              d={SPA_CIRCUIT_D}
              fill="none"
              stroke="var(--f1-red)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Start/finish marker on main straight */}
            <line x1="-1530" y1="835" x2="-1530" y2="855" stroke="#fff" strokeWidth="4" strokeOpacity="0.7" />
            <line x1="-1524" y1="835" x2="-1524" y2="855" stroke="#fff" strokeWidth="4" strokeOpacity="0.3" />
          </g>
        </svg>

        {/* Circuit name */}
        <div className="mt-3 home-reveal" style={{ opacity: 0, textAlign: 'center' }}>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#4a5268]">{SESSION.circuit}</div>
          <div className="flex items-center gap-2 mt-1.5 justify-center">
            <div className="h-px w-8 bg-[#1f2330]" />
            <span className="text-[9px] text-[#2e3444] uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-data)' }}>
              {SESSION.laps} Laps
            </span>
            <div className="h-px w-8 bg-[#1f2330]" />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Content ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 relative overflow-hidden">

        {/* WIP status bar */}
        <div
          className="flex items-center justify-center gap-2.5 py-2 shrink-0"
          style={{ background: 'rgba(255,214,0,0.04)', borderBottom: '1px solid rgba(255,214,0,0.1)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: '#ffd600', boxShadow: '0 0 6px #ffd600', animation: 'flag-pulse 1.8s ease-in-out infinite' }}
          />
          <span
            className="text-[10px] uppercase tracking-[0.28em]"
            style={{ fontFamily: 'var(--font-display)', color: '#6a5e28' }}
          >
            Safety car deployed — still building this
          </span>
        </div>

        {/* Nav bar */}
        <div className="flex items-center justify-between px-8 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-7 flex items-center justify-center" style={{ background: 'var(--f1-red)' }}>
              <span className="text-white font-black text-xs" style={{ letterSpacing: '-0.05em' }}>F1</span>
            </div>
            <div className="h-4 w-px bg-[#131620]" />
            <span className="text-[11px] text-[#3a4052] uppercase tracking-[0.2em]">Race Center</span>
          </div>
          <span className="text-[10px] text-[#252a36] tracking-[0.15em] uppercase"
            style={{ fontFamily: 'var(--font-data)' }}>
            2023 Season
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-start justify-center px-10 gap-7">

          {/* Starting lights */}
          <div className="home-reveal" style={{ opacity: 0 }}>
            <div className="text-[9px] uppercase tracking-[0.3em] text-[#252a36] mb-3">
              Formation Lap Complete
            </div>
            <div className="flex items-end gap-1.5">
              {[1, 2, 3, 4, 5].map(i => {
                const lit = !lightsOut && i <= litCount
                const out = lightsOut
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="relative flex flex-col items-center justify-end"
                      style={{
                        width: 20, height: 58,
                        background: '#08090d',
                        border: '1px solid #18191f',
                        paddingBottom: 9,
                      }}
                    >
                      <div
                        style={{
                          width: 13, height: 13, borderRadius: '50%',
                          background: out ? '#0a0004' : lit ? '#e8002d' : '#1e0008',
                          boxShadow: out ? 'none' : lit
                            ? '0 0 18px rgba(232,0,45,1), 0 0 38px rgba(232,0,45,0.75), 0 0 70px rgba(232,0,45,0.3)'
                            : 'none',
                          transition: out ? 'all 0.12s ease' : 'all 0.2s ease',
                        }}
                      />
                      {lit && !out && (
                        <div
                          style={{
                            position: 'absolute', top: 25, left: 4,
                            width: 4, height: 4, borderRadius: '50%',
                            background: 'rgba(255,200,200,0.75)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[8px] text-[#252a36] tabular-nums"
                      style={{ fontFamily: 'var(--font-data)' }}>{i}</span>
                  </div>
                )
              })}

              <div className="ml-4 self-center">
                <span
                  className="text-[11px] uppercase transition-all duration-500"
                  style={{
                    fontFamily: 'var(--font-display)',
                    letterSpacing: lightsOut ? '0.55em' : '0.3em',
                    color: lightsOut ? 'var(--f1-red)' : '#353d50',
                  }}
                >
                  {lightsOut ? "LIGHTS OUT" : 'GRID LOCK'}
                </span>
              </div>
            </div>
          </div>

          {/* Race name */}
          <div className="home-reveal" style={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className="text-[10px] font-bold tracking-[0.2em] px-2 py-0.5"
                style={{
                  fontFamily: 'var(--font-data)',
                  background: 'rgba(232,0,45,0.12)',
                  color: 'var(--f1-red)',
                  border: '1px solid rgba(232,0,45,0.28)',
                }}
              >
                {SESSION.country}
              </span>
              <span className="text-[10px] text-[#353d50] uppercase tracking-[0.18em]"
                style={{ fontFamily: 'var(--font-data)' }}>
                {SESSION.date}
              </span>
              <span className="text-[#1f2330]">·</span>
              <span className="text-[10px] text-[#2e3444] uppercase tracking-[0.15em]"
                style={{ fontFamily: 'var(--font-data)' }}>
                Round {SESSION.round}
              </span>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(44px, 5.5vw, 76px)',
                lineHeight: 0.88,
                letterSpacing: '-0.02em',
              }}
            >
              {SESSION.name.split(' ').map((word, i, arr) => (
                <span key={i} style={{ color: i === arr.length - 1 ? 'var(--f1-red)' : '#ffffff' }}>
                  {word}{' '}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-2.5">
              <div className="h-px w-6" style={{ background: 'var(--f1-red)' }} />
              <span className="text-[11px] uppercase tracking-[0.15em] text-[#5a6272]">
                {SESSION.subtitle}
              </span>
              <span className="text-[#1f2330]">·</span>
              <span className="text-[11px] text-[#3a4052] uppercase tracking-[0.15em]">
                {SESSION.laps} Laps
              </span>
            </div>
          </div>

          {/* Data badges */}
          <div className="flex items-center gap-2 home-reveal" style={{ opacity: 0 }}>
            {[
              { label: 'Session', value: `#${SESSION.key}` },
              { label: 'Type', value: 'Sprint' },
              { label: 'Drivers', value: '20' },
              { label: 'API', value: 'OpenF1' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col px-3 py-2"
                style={{ background: 'rgba(12,13,17,0.9)', border: '1px solid #18191f' }}
              >
                <span className="text-[8px] uppercase tracking-widest text-[#2e3444]"
                  style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
                <span className="text-[13px] font-bold text-white mt-0.5"
                  style={{ fontFamily: 'var(--font-data)' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="home-reveal" style={{ opacity: 0 }}>
            <button
              onClick={() => navigate(`/race/${SESSION.key}`)}
              className="relative overflow-hidden flex items-center gap-5 px-8 py-4 group"
              style={{
                background: 'var(--f1-red)',
                border: 'none',
                cursor: 'pointer',
                minWidth: 290,
              }}
              onMouseEnter={e => {
                animate(e.currentTarget.querySelector('.btn-shine')!, {
                  translateX: ['-100%', '200%'],
                  duration: 500,
                  easing: 'easeInOutCubic',
                })
              }}
            >
              <div className="btn-shine absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                  transform: 'translateX(-100%)',
                  width: '60%',
                }} />
              <span
                className="text-white font-black text-[14px] uppercase"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.32em' }}
              >
                Load Session
              </span>
              <span className="text-white text-xl leading-none ml-auto">→</span>
            </button>
          </div>

          {/* Author */}
          <div className="home-reveal flex items-center gap-3" style={{ opacity: 0 }}>
            <div className="h-px w-8 bg-[#1a1c24]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#2e3444]">
              Engineered by{' '}
              <span style={{ color: 'var(--f1-red)' }}>hiyo</span>
            </span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-px shrink-0 w-full"
          style={{ background: 'linear-gradient(90deg, transparent, var(--f1-red) 50%, transparent)' }}
        />
      </div>
    </div>
  )
}
