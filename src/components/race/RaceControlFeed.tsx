import { useEffect, useRef } from 'react'
import type { RaceControl } from '../../types'
import { flagColor } from '../../utils/format'

interface Props {
  messages: RaceControl[]
}

function flagLabel(flag: string | null): string {
  if (!flag) return ''
  switch (flag.toUpperCase()) {
    case 'GREEN': return '🟢'
    case 'YELLOW': return '🟡'
    case 'DOUBLE YELLOW': return '🟡🟡'
    case 'RED': return '🔴'
    case 'BLUE': return '🔵'
    case 'CHEQUERED': return '🏁'
    case 'SAFETY CAR': return '🚗'
    case 'VIRTUAL SAFETY CAR': return 'VSC'
    default: return flag
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

export default function RaceControlFeed({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  const sorted = [...messages].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="flex flex-col h-full bg-[#111215]">
      <div className="px-3 py-2 border-b border-[#2a2d35] flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Race Control</span>
        {messages.length > 0 && (
          <span className="text-[10px] text-[#6b7280]">{messages.length} messages</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-px">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7280] text-xs">
            No messages yet
          </div>
        ) : (
          sorted.map((msg, i) => {
            const fColor = msg.flag ? flagColor(msg.flag) : '#6b7280'
            const isNew = i >= sorted.length - 3
            return (
              <div
                key={`${msg.date}-${i}`}
                className={`flex items-start gap-2 px-3 py-1.5 text-xs border-l-2 transition-all duration-300 ${isNew ? 'rc-slide-in' : ''}`}
                style={{
                  borderLeftColor: fColor,
                  background: msg.flag ? `${fColor}0a` : 'transparent',
                }}
              >
                <span className="text-[#6b7280] tabular-nums shrink-0 text-[10px] mt-0.5">
                  {formatTime(msg.date)}
                </span>
                {msg.lap_number && (
                  <span className="text-[#6b7280] tabular-nums shrink-0 text-[10px] mt-0.5">
                    L{msg.lap_number}
                  </span>
                )}
                {msg.flag && (
                  <span className="shrink-0 text-[10px] mt-0.5">{flagLabel(msg.flag)}</span>
                )}
                <span className="text-[#d1d5db] leading-tight flex-1">{msg.message}</span>
                {msg.scope && (
                  <span className="text-[#6b7280] shrink-0 text-[10px] mt-0.5 uppercase">{msg.scope}</span>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
