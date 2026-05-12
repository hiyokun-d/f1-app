import { useEffect, useRef } from 'react'
import { animate, stagger, createScope } from 'animejs'
import type { Driver, OvertakeEvent } from '../../../types'
import { teamHex } from '../../../utils/format'

interface Props {
  overtake: OvertakeEvent
  overtakingDriver: Driver
  overtakenDriver: Driver
  onDismiss: () => void
}

export default function OvertakeBanner({
  overtake, overtakingDriver, overtakenDriver, onDismiss,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const scope = useRef<ReturnType<typeof createScope> | null>(null)

  const attackColor = teamHex(overtakingDriver.team_colour)
  const defendColor = teamHex(overtakenDriver.team_colour)

  useEffect(() => {
    if (!ref.current) return
    scope.current = createScope({ root: ref.current })

    scope.current.add(() => {
      // Banner slides in
      animate(ref.current!, {
        opacity: [0, 1],
        y: [-14, 0],
        duration: 380,
        ease: 'outExpo',
      })

      // Driver cards stagger in
      animate('.ob-card', {
        opacity: [0, 1],
        x: (el: unknown) => {
          return (el as Element).classList.contains('ob-attacker') ? [-24, 0] : [24, 0]
        },
        delay: stagger(80, { start: 160 }),
        duration: 320,
        ease: 'outExpo',
      })

      // Center label fades up
      animate('.ob-center', {
        opacity: [0, 1],
        y: [6, 0],
        delay: 300,
        duration: 250,
        ease: 'outQuart',
      })

      // Arrow pulse
      animate('.ob-arrow', {
        scale: [0.6, 1],
        opacity: [0, 1],
        delay: 380,
        duration: 300,
        ease: 'outBack(2)',
      })

      // Auto-dismiss after 4.2s
      setTimeout(() => {
        animate(ref.current!, {
          opacity: [1, 0],
          y: [0, -10],
          duration: 280,
          ease: 'inQuart',
          onComplete: onDismiss,
        })
      }, 4200)
    })

    return () => { scope.current?.revert() }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className="absolute z-40"
      style={{
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(4,5,8,0.88)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          padding: '6px 10px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Overtaking driver */}
        <div
          className="ob-card ob-attacker"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${attackColor}18`,
            border: `1px solid ${attackColor}44`,
            borderRadius: 3,
            padding: '4px 10px',
            opacity: 0,
          }}
        >
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 700,
            color: attackColor,
          }}>
            P{overtake.newPosition}
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '0.04em',
          }}>
            {overtakingDriver.name_acronym}
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            color: '#22c55e',
            letterSpacing: '0.1em',
          }}>
            ↑
          </span>
        </div>

        {/* Center */}
        <div className="ob-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 7,
            fontWeight: 900,
            color: '#ffd600',
            letterSpacing: '0.3em',
          }}>
            OVERTAKE
          </span>
          <div className="ob-arrow" style={{ opacity: 0 }}>
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="0" y1="5" x2="22" y2="5" stroke="#ffd600" strokeWidth="1.5" strokeDasharray="3 2" />
              <polygon points="22,2 28,5 22,8" fill="#ffd600" />
            </svg>
          </div>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 7,
            color: '#3d4455',
            letterSpacing: '0.1em',
          }}>
            LAP {overtake.lapNumber}
          </span>
        </div>

        {/* Overtaken driver */}
        <div
          className="ob-card ob-defender"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${defendColor}14`,
            border: `1px solid ${defendColor}33`,
            borderRadius: 3,
            padding: '4px 10px',
            opacity: 0,
          }}
        >
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            color: '#ef4444',
            letterSpacing: '0.1em',
          }}>
            ↓
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 900,
            color: '#9ca3af',
            letterSpacing: '0.04em',
          }}>
            {overtakenDriver.name_acronym}
          </span>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 700,
            color: defendColor,
          }}>
            P{overtake.newPosition + 1}
          </span>
        </div>
      </div>
    </div>
  )
}
