import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger, createTimeline } from "animejs";
import { useNextSession, type OpenF1Session } from "../hooks/useNextSession";
import F1CarSVG from "../components/F1CarSVG";

// ── Web Audio power-up SFX ────────────────────────────────────────────
function playPowerUp(ctx: AudioContext) {
  const t = ctx.currentTime;
  const rumble = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(55, t);
  rumble.frequency.exponentialRampToValueAtTime(180, t + 0.9);
  rumbleGain.gain.setValueAtTime(0, t);
  rumbleGain.gain.linearRampToValueAtTime(0.22, t + 0.06);
  rumbleGain.gain.linearRampToValueAtTime(0.12, t + 0.65);
  rumbleGain.gain.linearRampToValueAtTime(0, t + 1.0);
  rumble.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);
  rumble.start(t);
  rumble.stop(t + 1.05);

  const beep1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  beep1.type = "sine";
  beep1.frequency.value = 1046;
  gain1.gain.setValueAtTime(0, t + 0.35);
  gain1.gain.linearRampToValueAtTime(0.17, t + 0.37);
  gain1.gain.linearRampToValueAtTime(0, t + 0.55);
  beep1.connect(gain1);
  gain1.connect(ctx.destination);
  beep1.start(t + 0.35);
  beep1.stop(t + 0.6);

  const beep2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  beep2.type = "sine";
  beep2.frequency.value = 1568;
  gain2.gain.setValueAtTime(0, t + 0.65);
  gain2.gain.linearRampToValueAtTime(0.2, t + 0.67);
  gain2.gain.linearRampToValueAtTime(0, t + 0.95);
  beep2.connect(gain2);
  gain2.connect(ctx.destination);
  beep2.start(t + 0.65);
  beep2.stop(t + 1.0);
}

// ── Helpers ───────────────────────────────────────────────────────────
function getCountdown(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { d, h, m, s };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ── Static fallback sessions ──────────────────────────────────────────
const FALLBACK: OpenF1Session[] = [
  {
    session_key: 9165, meeting_name: "Belgian Grand Prix",
    session_name: "Race", session_type: "Race",
    date_start: "2023-07-30T13:00:00+00:00", date_end: null,
    circuit_short_name: "Spa", country_name: "Belgium", country_code: "BEL",
    year: 2023, location: "Spa",
  },
  {
    session_key: 9149, meeting_name: "British Grand Prix",
    session_name: "Race", session_type: "Race",
    date_start: "2023-07-09T14:00:00+00:00", date_end: null,
    circuit_short_name: "Silverstone", country_name: "United Kingdom", country_code: "GBR",
    year: 2023, location: "Silverstone",
  },
  {
    session_key: 9140, meeting_name: "Austrian Grand Prix",
    session_name: "Race", session_type: "Race",
    date_start: "2023-07-02T13:00:00+00:00", date_end: null,
    circuit_short_name: "Red Bull Ring", country_name: "Austria", country_code: "AUT",
    year: 2023, location: "Spielberg",
  },
  {
    session_key: 9130, meeting_name: "Canadian Grand Prix",
    session_name: "Race", session_type: "Race",
    date_start: "2023-06-18T18:00:00+00:00", date_end: null,
    circuit_short_name: "Montreal", country_name: "Canada", country_code: "CAN",
    year: 2023, location: "Montreal",
  },
];

const BOOT_LINES = [
  "INITIALIZING TELEMETRY SYSTEMS...",
  "LOADING DRIVER DATABASE............[OK]",
  "CALIBRATING SENSOR ARRAY...........[OK]",
  "SYNCHRONIZING TIMING DATA..........[OK]",
  "ESTABLISHING API CONNECTION........[OK]",
  "SYSTEM NOMINAL. AWAITING INPUT.",
];

const COLS = 7;
const ROWS = 5;

// ── Countdown block ───────────────────────────────────────────────────
function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: "var(--font-data)", color: "var(--f1-red)" }}>
        {pad2(value)}
      </div>
      <div className="text-[8px] mt-0.5 uppercase" style={{ fontFamily: "var(--font-display)", color: "#3a4258", letterSpacing: "0.2em" }}>
        {label}
      </div>
    </div>
  );
}

// ── Session tile (bottom carousel) ────────────────────────────────────
function SessionTile({ session, onNavigate }: { session: OpenF1Session; onNavigate: (key: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      className="session-tile shrink-0 text-left relative overflow-hidden"
      style={{
        background: "var(--f1-surface)",
        border: "1px solid var(--f1-border)",
        borderTop: "2px solid var(--f1-border)",
        padding: "14px 16px",
        minWidth: 148,
        cursor: "pointer",
        transition: "border-color 0.18s ease, background 0.18s ease, border-top-color 0.18s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--f1-card)";
        e.currentTarget.style.borderColor = "rgba(232,0,45,0.4)";
        e.currentTarget.style.borderTopColor = "var(--f1-red)";
        if (ref.current) animate(ref.current, { translateX: [0, 3], scale: [1, 1.02], duration: 160, easing: "easeOutQuart" });
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "var(--f1-surface)";
        e.currentTarget.style.borderColor = "var(--f1-border)";
        e.currentTarget.style.borderTopColor = "var(--f1-border)";
        if (ref.current) animate(ref.current, { translateX: [3, 0], scale: [1.02, 1], duration: 200, easing: "easeOutQuart" });
      }}
      onClick={() => onNavigate(session.session_key)}
    >
      <div className="text-[10px] font-bold mb-1 uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-data)", color: "#5a6272" }}>
        {session.country_code}
      </div>
      <div className="text-sm font-bold leading-tight mb-2 text-white" style={{ fontFamily: "var(--font-display)" }}>
        {(session.meeting_name ?? session.country_name ?? "Grand Prix").replace(" Grand Prix", " GP")}
      </div>
      <div className="text-[9px] text-[#3a4258]" style={{ fontFamily: "var(--font-data)" }}>
        {(session.date_start ?? "").slice(0, 10)}
      </div>
      <div
        className="inline-block mt-2 text-[8px] px-1.5 py-0.5 uppercase tracking-[0.12em]"
        style={{
          fontFamily: "var(--font-display)",
          background: "rgba(232,0,45,0.08)",
          border: "1px solid rgba(232,0,45,0.18)",
          color: "rgba(232,0,45,0.7)",
        }}
      >
        {session.session_type ?? "Race"}
      </div>
    </button>
  );
}

// ── Quick Launch Panel ────────────────────────────────────────────────
function QuickLaunchPanel({
  session,
  isLive,
  onNavigate,
}: {
  session: OpenF1Session | null;
  isLive: boolean;
  onNavigate: (key: number) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className="text-[10px] uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-data)", color: "#2e3444", animation: "flag-pulse 1.5s ease-in-out infinite" }}
        >
          Loading...
        </span>
      </div>
    );
  }

  const accentColor = isLive ? "#22c55e" : "var(--f1-red)";
  const accentRgb = isLive ? "34,197,94" : "232,0,45";

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: accentColor, animation: "flag-pulse 1.2s ease-in-out infinite" }}
        />
        <span
          className="text-[9px] uppercase tracking-[0.22em]"
          style={{ fontFamily: "var(--font-display)", color: accentColor }}
        >
          {isLive ? "Live Session" : "Latest Race"}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-1">
        <div
          className="font-bold leading-tight text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(16px, 2.2vw, 22px)" }}
        >
          {(session.meeting_name ?? "Grand Prix").replace(" Grand Prix", " GP")}
        </div>
        <div className="text-[11px]" style={{ fontFamily: "var(--font-display)", color: "var(--f1-muted)" }}>
          {session.session_name} · {session.circuit_short_name}
        </div>
        <div className="text-[11px]" style={{ fontFamily: "var(--font-display)", color: "#4a5268" }}>
          {session.country_name} · {session.year}
        </div>
        <div className="text-[9px] mt-1" style={{ fontFamily: "var(--font-data)", color: "#2e3444" }}>
          KEY #{session.session_key}
        </div>
      </div>

      <button
        ref={btnRef}
        onClick={() => onNavigate(session.session_key)}
        onMouseEnter={() => {
          if (btnRef.current) animate(btnRef.current, { scale: [1, 1.015], translateY: [0, -2], duration: 180, easing: "easeOutQuart" });
        }}
        onMouseLeave={() => {
          if (btnRef.current) animate(btnRef.current, { scale: [1.015, 1], translateY: [-2, 0], duration: 220, easing: "easeOutQuart" });
        }}
        className="relative overflow-hidden w-full"
        style={{
          background: `rgba(${accentRgb},0.07)`,
          border: `1px solid rgba(${accentRgb},0.4)`,
          padding: "15px 0",
          cursor: "pointer",
          animation: `glow-${isLive ? "green" : "red"} 2.2s ease-in-out infinite`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-full pointer-events-none"
          style={{
            background: `linear-gradient(180deg, rgba(${accentRgb},0.06) 0%, transparent 60%)`,
            animation: "scan 2.4s ease-in-out infinite",
          }}
        />
        <span
          className="relative flex items-center justify-center gap-3 text-[13px] font-bold uppercase tracking-[0.36em]"
          style={{ fontFamily: "var(--font-display)", color: `rgba(${accentRgb},0.9)` }}
        >
          <span style={{ fontSize: 10 }}>▶</span>
          <span>Launch Session</span>
        </span>
      </button>
    </div>
  );
}

// ── Find Session Panel ────────────────────────────────────────────────
function FindSessionPanel({
  sessions,
  onNavigate,
}: {
  sessions: OpenF1Session[];
  onNavigate: (key: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [directKey, setDirectKey] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const isDirectKey = /^\d{4,}$/.test(directKey.trim());

  const filtered = query.trim()
    ? sessions.filter(s => {
        const q = query.toLowerCase();
        return (
          (s.meeting_name ?? "").toLowerCase().includes(q) ||
          (s.circuit_short_name ?? "").toLowerCase().includes(q) ||
          (s.country_name ?? "").toLowerCase().includes(q) ||
          String(s.year).includes(q)
        );
      })
    : sessions;

  useLayoutEffect(() => {
    if (!resultsRef.current) return;
    const items = Array.from(resultsRef.current.querySelectorAll<HTMLElement>(".find-result-item"));
    if (items.length === 0) return;
    animate(items, {
      translateY: [8, 0],
      opacity: [0, 1],
      scale: [0.96, 1],
      duration: 260,
      delay: stagger(40),
      easing: "easeOutQuart",
    });
  }, [query, sessions.length]);

  const handleDirectGo = () => {
    const key = parseInt(directKey.trim(), 10);
    if (!isNaN(key)) onNavigate(key);
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="relative shrink-0">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] select-none pointer-events-none"
          style={{ color: "#3a4258" }}
        >
          ⌕
        </span>
        <input
          type="text"
          placeholder="Monaco, Spa, 2024..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full outline-none pl-8 pr-3 py-2.5 text-[11px]"
          style={{
            fontFamily: "var(--font-data)",
            color: "var(--f1-text)",
            background: "var(--f1-surface)",
            border: `1px solid ${query ? "rgba(232,0,45,0.35)" : "var(--f1-border)"}`,
            transition: "border-color 0.18s ease",
          }}
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex-1 h-px" style={{ background: "var(--f1-border)" }} />
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-display)", color: "#2e3444" }}>or</span>
        <div className="flex-1 h-px" style={{ background: "var(--f1-border)" }} />
      </div>

      <div className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold select-none pointer-events-none"
            style={{ fontFamily: "var(--font-data)", color: "#3a4258" }}
          >
            #
          </span>
          <input
            type="text"
            placeholder="Session key: 9523"
            value={directKey}
            onChange={e => setDirectKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && isDirectKey && handleDirectGo()}
            className="w-full outline-none pl-7 pr-3 py-2.5 text-[11px]"
            style={{
              fontFamily: "var(--font-data)",
              color: isDirectKey ? "var(--f1-red)" : "var(--f1-text)",
              background: "var(--f1-surface)",
              border: `1px solid ${isDirectKey ? "rgba(232,0,45,0.35)" : "var(--f1-border)"}`,
              transition: "border-color 0.18s ease, color 0.18s ease",
            }}
          />
        </div>
        {isDirectKey && (
          <button
            onClick={handleDirectGo}
            className="px-3.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{
              fontFamily: "var(--font-display)",
              background: "rgba(232,0,45,0.1)",
              border: "1px solid rgba(232,0,45,0.35)",
              color: "var(--f1-red)",
              cursor: "pointer",
              animation: "fade-in 0.18s ease",
              flexShrink: 0,
            }}
          >
            GO
          </button>
        )}
      </div>

      <div
        ref={resultsRef}
        className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: "none" }}
      >
        {filtered.length === 0 ? (
          <div className="text-center mt-4 text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: "var(--font-data)", color: "#2e3444" }}>
            No sessions match
          </div>
        ) : (
          filtered.map(s => (
            <button
              key={s.session_key}
              className="find-result-item w-full text-left flex items-center gap-3 px-3 py-2.5"
              style={{
                background: "var(--f1-surface)",
                border: "1px solid var(--f1-border)",
                cursor: "pointer",
                opacity: 0,
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(232,0,45,0.3)";
                e.currentTarget.style.background = "var(--f1-card)";
                animate(e.currentTarget, { translateX: [0, 4], duration: 150, easing: "easeOutQuart" });
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--f1-border)";
                e.currentTarget.style.background = "var(--f1-surface)";
                animate(e.currentTarget, { translateX: [4, 0], duration: 180, easing: "easeOutQuart" });
              }}
              onClick={() => onNavigate(s.session_key)}
            >
              <div className="text-[10px] font-bold shrink-0" style={{ fontFamily: "var(--font-data)", color: "#3a4258", minWidth: 28 }}>
                {s.country_code}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white truncate leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {(s.meeting_name ?? s.country_name ?? "GP").replace(" Grand Prix", " GP")}
                </div>
                <div className="text-[9px]" style={{ fontFamily: "var(--font-display)", color: "var(--f1-muted)" }}>
                  {s.session_name} · {s.year}
                </div>
              </div>
              <div className="text-[9px] shrink-0" style={{ fontFamily: "var(--font-data)", color: "#2e3444" }}>
                #{s.session_key}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Action Panel ──────────────────────────────────────────────────────
type PanelMode = "quick" | "find";

function ActionPanel({
  liveSession,
  latestSession,
  sessions,
  onNavigate,
}: {
  liveSession: OpenF1Session | null;
  latestSession: OpenF1Session | null;
  sessions: OpenF1Session[];
  onNavigate: (key: number) => void;
}) {
  const [mode, setMode] = useState<PanelMode>("quick");
  const contentRef = useRef<HTMLDivElement>(null);

  const switchMode = (next: PanelMode) => {
    if (next === mode) return;
    const el = contentRef.current;
    if (!el) { setMode(next); return; }

    animate(el, { translateY: [0, -10], opacity: [1, 0], duration: 180, easing: "easeInQuart" });
    setTimeout(() => {
      setMode(next);
      if (contentRef.current) {
        animate(contentRef.current, { translateY: [12, 0], opacity: [0, 1], duration: 280, easing: "easeOutQuart" });
      }
    }, 180);
  };

  return (
    <div
      className="mc-action-panel flex flex-col"
      style={{
        background: "var(--f1-card)",
        border: "1px solid var(--f1-border)",
        borderLeft: "3px solid var(--f1-red)",
        width: 380,
        height: 400,
        flexShrink: 0,
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--f1-border)" }}
      >
        <span className="text-[9px] uppercase tracking-[0.28em]" style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}>
          Race Select
        </span>
        {liveSession && (
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-[#22c55e]" style={{ animation: "flag-pulse 1s ease-in-out infinite" }} />
            <span className="text-[9px] uppercase tracking-[0.15em] text-[#22c55e]" style={{ fontFamily: "var(--font-display)" }}>Live</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--f1-border)" }}>
        {(["quick", "find"] as const).map(m => (
          <button
            key={m}
            className="mc-tab-btn flex-1 py-2.5 relative text-[10px] uppercase tracking-[0.2em] font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: mode === m ? "var(--f1-red)" : "#3a4258",
              background: mode === m ? "rgba(232,0,45,0.04)" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.18s ease, background 0.18s ease",
            }}
            onClick={() => switchMode(m)}
          >
            {m === "quick" ? "▶ Quick Launch" : "⌕ Find Session"}
            {mode === m && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--f1-red)" }} />
            )}
          </button>
        ))}
      </div>

      <div ref={contentRef} className="flex-1 p-4 overflow-hidden min-h-0 flex flex-col">
        {mode === "quick" ? (
          <QuickLaunchPanel
            session={liveSession ?? latestSession}
            isLive={!!liveSession}
            onNavigate={onNavigate}
          />
        ) : (
          <FindSessionPanel sessions={sessions} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
type Phase = "standby" | "shattering" | "menu";

export default function Home() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("standby");
  const shardsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const standbyRef = useRef<HTMLDivElement>(null);
  const menuAnimated = useRef(false);
  const standbyCarRef = useRef<HTMLDivElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);
  const carBreatheTlRef = useRef<ReturnType<typeof createTimeline> | null>(null);
  const scanTlRef = useRef<ReturnType<typeof createTimeline> | null>(null);

  const [bootLines, setBootLines] = useState<string[]>([]);
  const [clock, setClock] = useState("");
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown>>(null);

  const { nextSession, recentRaces, liveSession } = useNextSession();

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i >= BOOT_LINES.length) { clearInterval(iv); return; }
      setBootLines(prev => [...prev, BOOT_LINES[i++]]);
    }, 440);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!nextSession) return;
    const target = new Date(nextSession.date_start);
    const tick = () => setCountdown(getCountdown(target));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [nextSession]);

  // Standby: car breathe + scan line loop
  useEffect(() => {
    if (phase !== "standby") return;
    const carEl = standbyCarRef.current;
    const scanEl = scanLineRef.current;
    if (!carEl || !scanEl) return;

    // Gentle breathe
    carBreatheTlRef.current?.pause();
    carBreatheTlRef.current = createTimeline({ loop: true });
    carBreatheTlRef.current
      .add(carEl, { opacity: [0.55, 0.85], duration: 2200, easing: "easeInOutSine" })
      .add(carEl, { opacity: [0.85, 0.55], duration: 2200, easing: "easeInOutSine" });

    // Scan line sweep over car
    scanTlRef.current?.pause();
    scanTlRef.current = createTimeline({ loop: true });
    scanTlRef.current
      .add(scanEl, { opacity: [0, 0], duration: 600 })
      .add(scanEl, { translateY: ["-100%", "600%"], opacity: [0, 0.9, 0], duration: 1600, easing: "easeInOutQuart" })
      .add(scanEl, { opacity: [0, 0], duration: 1800 });

    return () => {
      carBreatheTlRef.current?.pause();
      scanTlRef.current?.pause();
    };
  }, [phase]);

  // Menu entrance — choreographed stagger
  useEffect(() => {
    if (phase !== "menu" || menuAnimated.current || !menuRef.current) return;
    menuAnimated.current = true;
    const menu = menuRef.current;

    // t=0: topbar slams down
    animate(menu.querySelectorAll(".mc-topbar"), {
      translateY: [-30, 0],
      opacity: [0, 1],
      duration: 420,
      easing: "easeOutExpo",
    });

    // t=80: car watermark fades in
    animate(menu.querySelectorAll(".mc-car-bg"), {
      opacity: [0, 1],
      translateX: [40, 0],
      duration: 900,
      delay: 80,
      easing: "easeOutExpo",
    });

    // t=150: action panel scales up from center
    animate(menu.querySelectorAll(".mc-action-panel"), {
      scale: [0.93, 1],
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      delay: 150,
      easing: "easeOutExpo",
    });

    // t=200: MISSION letters drop in with stagger
    animate(menu.querySelectorAll(".mc-letter-row1"), {
      translateY: [-44, 0],
      opacity: [0, 1],
      duration: 520,
      delay: stagger(35, { start: 200 }),
      easing: "easeOutExpo",
    });

    // t=580: CONTROL letters drop in
    animate(menu.querySelectorAll(".mc-letter-row2"), {
      translateY: [-44, 0],
      opacity: [0, 1],
      duration: 520,
      delay: stagger(35, { start: 580 }),
      easing: "easeOutExpo",
    });

    // t=760: tab buttons scale-bounce in
    animate(menu.querySelectorAll(".mc-tab-btn"), {
      scale: [0.5, 1],
      opacity: [0, 1],
      translateY: [6, 0],
      duration: 380,
      delay: stagger(90, { start: 760 }),
      easing: "easeOutExpo",
    });

    // t=1060: right cards slide in from right
    animate(menu.querySelectorAll(".mc-card"), {
      translateX: [32, 0],
      opacity: [0, 1],
      duration: 440,
      delay: stagger(140, { start: 1060 }),
      easing: "easeOutExpo",
    });

    // t=1400: bottom tiles float up
    animate(menu.querySelectorAll(".session-tile"), {
      translateY: [22, 0],
      opacity: [0, 1],
      duration: 360,
      delay: stagger(60, { start: 1400 }),
      easing: "easeOutExpo",
    });

    // t=1700: tagline fades in
    animate(menu.querySelectorAll(".mc-tagline"), {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 500,
      delay: 1700,
      easing: "easeOutExpo",
    });
  }, [phase]);

  const handleInitiate = useCallback(() => {
    if (phase !== "standby") return;
    try { const ctx = new AudioContext(); playPowerUp(ctx); } catch { /* ok */ }

    // Flash car white before shattering
    if (standbyCarRef.current) {
      animate(standbyCarRef.current, {
        opacity: [0.7, 1, 0],
        duration: 400,
        easing: "easeOutQuart",
      });
    }

    setPhase("shattering");

    requestAnimationFrame(() => {
      if (standbyRef.current) {
        animate(standbyRef.current, { opacity: [1, 0], duration: 320, easing: "easeInCubic" });
      }
      if (menuRef.current) {
        animate(menuRef.current, { opacity: [0, 1], duration: 950, delay: 180, easing: "easeOutCubic" });
      }
      if (!shardsRef.current) return;
      const shards = Array.from(shardsRef.current.querySelectorAll<HTMLElement>(".shard"));
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      shards.forEach(shard => {
        const r = shard.getBoundingClientRect();
        const dx = (r.left + r.width / 2) - cx;
        const dy = (r.top + r.height / 2) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 260 + Math.random() * 380;
        animate(shard, {
          translateX: (dx / dist) * speed,
          translateY: (dy / dist) * speed,
          rotate: (Math.random() - 0.5) * 110,
          opacity: [1, 0],
          duration: 750 + Math.random() * 450,
          delay: Math.random() * 220,
          easing: "easeInCubic",
        });
      });
      setTimeout(() => setPhase("menu"), 1200);
    });
  }, [phase]);

  const sessions = recentRaces.length > 0 ? recentRaces : FALLBACK;

  return (
    <div className="h-screen overflow-hidden relative" style={{ background: "var(--f1-dark)" }}>

      {/* ── MAIN MENU ── always rendered, revealed during shatter ────── */}
      <div
        ref={menuRef}
        className={`absolute inset-0 flex flex-col${phase !== "menu" ? " mc-menu-hidden" : ""}`}
        style={{ opacity: 0 }}
      >
        {/* Grid line background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(232,0,45,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(232,0,45,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Top status bar */}
        <div
          className="mc-topbar flex items-center justify-between px-6 py-3 shrink-0 relative z-10"
          style={{ borderBottom: "1px solid rgba(232,0,45,0.12)", background: "rgba(6,7,10,0.95)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: "var(--f1-red)", boxShadow: "0 0 16px rgba(232,0,45,0.5)" }}
            >
              <span className="text-white font-black text-xs leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.05em" }}>F1</span>
            </div>
            <div className="h-4 w-px bg-[#1f2330]" />
            <span className="text-[10px] uppercase tracking-[0.28em]" style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}>
              Mission Control
            </span>
            <div className="h-4 w-px bg-[#1f2330]" />
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ fontFamily: "var(--font-data)", color: "#2a2f40" }}>
              Telemetry v2.0
            </span>
          </div>
          <div className="flex items-center gap-5">
            {liveSession ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" style={{ animation: "flag-pulse 1s ease-in-out infinite" }} />
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#22c55e]" style={{ fontFamily: "var(--font-display)" }}>
                  Live · {liveSession.meeting_name.replace(" Grand Prix", " GP")}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3a4258]" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#3a4258]" style={{ fontFamily: "var(--font-display)" }}>Standby</span>
              </div>
            )}
            <span className="text-[10px] tabular-nums" style={{ fontFamily: "var(--font-data)", color: "#2e3444" }}>{clock}</span>
          </div>
        </div>

        {/* Content row: hero | action panel | info */}
        <div className="flex flex-1 overflow-hidden min-h-0 relative">

          {/* Left — hero */}
          <div className="flex-1 flex flex-col justify-center px-12 gap-8 relative overflow-hidden">
            {/* Car watermark — large background element */}
            <div
              className="mc-car-bg absolute pointer-events-none"
              style={{
                right: "-8%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "72%",
                opacity: 0,
                filter: "drop-shadow(0 0 20px rgba(232,0,45,0.08))",
              }}
            >
              <F1CarSVG className="w-full" />
            </div>

            {/* Red accent line left edge */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(232,0,45,0.4) 30%, rgba(232,0,45,0.4) 70%, transparent)" }}
            />

            <div className="relative z-10">
              {/* Eyebrow label */}
              <div
                className="flex items-center gap-3 mb-6"
              >
                <div className="w-8 h-px" style={{ background: "var(--f1-red)" }} />
                <span
                  className="text-[9px] uppercase tracking-[0.42em]"
                  style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.7)" }}
                >
                  F1 Telemetry Dashboard
                </span>
              </div>

              {/* MISSION CONTROL lettering */}
              <div
                className="select-none"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  lineHeight: 0.88,
                  letterSpacing: "-0.02em",
                  fontSize: "clamp(60px, 8.5vw, 116px)",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  {"MISSION".split("").map((l, i) => (
                    <span key={`m${i}`} className="mc-letter-row1 inline-block text-white">{l}</span>
                  ))}
                </div>
                <div style={{ overflow: "hidden" }}>
                  {"CONTROL".split("").map((l, i) => (
                    <span key={`c${i}`} className="mc-letter-row2 inline-block" style={{ color: "var(--f1-red)" }}>{l}</span>
                  ))}
                </div>
              </div>

              {/* Red underline */}
              <div
                className="mt-5"
                style={{
                  height: 2,
                  background: "linear-gradient(90deg, var(--f1-red), rgba(232,0,45,0.2), transparent)",
                  width: "clamp(200px,55%,520px)",
                }}
              />

              <p
                className="mc-tagline mt-5 text-[10px] uppercase tracking-[0.38em]"
                style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
              >
                Season {new Date().getFullYear()} · Live Telemetry · Race Replay
              </p>
            </div>
          </div>

          {/* Center — action panel */}
          <div className="flex items-center justify-center px-8 shrink-0 relative z-10">
            <ActionPanel
              liveSession={liveSession}
              latestSession={sessions[0] ?? null}
              sessions={sessions}
              onNavigate={key => navigate(`/race/${key}`)}
            />
          </div>

          {/* Right — info panels */}
          <div className="flex flex-col gap-4 px-6 py-8 shrink-0 overflow-y-auto relative z-10" style={{ width: 280 }}>
            {nextSession && (
              <div
                className="mc-card"
                style={{ background: "var(--f1-card)", border: "1px solid var(--f1-border)", borderLeft: "3px solid var(--f1-red)", padding: "16px 20px" }}
              >
                <div className="text-[9px] uppercase tracking-[0.28em] mb-3" style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}>
                  Next Grand Prix
                </div>
                <div className="text-[15px] font-bold text-white leading-none mb-1" style={{ fontFamily: "var(--font-display)" }}>
                  {nextSession.meeting_name}
                </div>
                <div className="text-[10px] mb-4" style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}>
                  {nextSession.circuit_short_name} · {nextSession.country_name}
                </div>
                {countdown ? (
                  <div className="grid grid-cols-4 gap-2">
                    <CountdownBlock label="DAYS" value={countdown.d} />
                    <CountdownBlock label="HRS" value={countdown.h} />
                    <CountdownBlock label="MIN" value={countdown.m} />
                    <CountdownBlock label="SEC" value={countdown.s} />
                  </div>
                ) : (
                  <div className="text-[10px] tracking-[0.18em]" style={{ fontFamily: "var(--font-display)", color: "var(--f1-red)" }}>UNDERWAY</div>
                )}
              </div>
            )}

            <div
              className="mc-card"
              style={{ background: "var(--f1-card)", border: "1px solid var(--f1-border)", borderLeft: "3px solid rgba(34,197,94,0.5)", padding: "14px 20px" }}
            >
              <div className="text-[9px] uppercase tracking-[0.28em] mb-3" style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}>
                System Status
              </div>
              {[
                { label: "TELEMETRY ENGINE", ok: true },
                { label: "API CONNECTION", ok: true },
                { label: "SENSOR ARRAY", ok: true },
                { label: "RACE CALENDAR", ok: !!nextSession },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-[9px] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}>{label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full" style={{ background: ok ? "#22c55e" : "#e8002d", animation: `flag-pulse ${ok ? "2.4" : "0.8"}s ease-in-out infinite` }} />
                    <span className="text-[9px] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-data)", color: ok ? "#22c55e" : "var(--f1-red)" }}>
                      {ok ? "NOMINAL" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mc-card flex items-center gap-2 px-4 py-3"
              style={{ background: "rgba(255,214,0,0.04)", border: "1px solid rgba(255,214,0,0.1)", borderLeft: "3px solid rgba(255,214,0,0.4)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--f1-accent)", boxShadow: "0 0 6px var(--f1-accent)", animation: "flag-pulse 1.8s ease-in-out infinite" }} />
              <span className="text-[9px] uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-display)", color: "#7a6e38" }}>
                Safety Car Deployed · Still Building
              </span>
            </div>
          </div>
        </div>

        {/* Bottom session carousel */}
        <div className="shrink-0 px-8 pb-6 relative z-10">
          <div
            className="h-px w-full mb-5"
            style={{ background: "linear-gradient(90deg, transparent, rgba(232,0,45,0.3) 30%, rgba(232,0,45,0.3) 70%, transparent)" }}
          />
          <div className="text-[9px] uppercase tracking-[0.28em] mb-3" style={{ fontFamily: "var(--font-display)", color: "#2e3444" }}>
            Recent Sessions
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {sessions.map(s => (
              <SessionTile key={s.session_key} session={s} onNavigate={key => navigate(`/race/${key}`)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── STANDBY + SHATTER LAYERS ─────────────────────────────────── */}
      {(phase === "standby" || phase === "shattering") && (
        <>
          <div ref={shardsRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {Array.from({ length: COLS * ROWS }, (_, i) => (
              <div
                key={i}
                className="shard absolute"
                style={{
                  left: `${((i % COLS) / COLS) * 100}%`,
                  top: `${(Math.floor(i / COLS) / ROWS) * 100}%`,
                  width: `${100 / COLS}%`,
                  height: `${100 / ROWS}%`,
                  background: "var(--f1-dark)",
                  borderRight: "1px solid rgba(232,0,45,0.04)",
                  borderBottom: "1px solid rgba(232,0,45,0.04)",
                }}
              />
            ))}
          </div>

          <div
            ref={standbyRef}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ zIndex: 20, pointerEvents: phase === "standby" ? "auto" : "none", gap: 0 }}
          >
            {/* Grid background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(232,0,45,0.04) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(232,0,45,0.04) 1px, transparent 1px)
                `,
                backgroundSize: "48px 48px",
              }}
            />

            {/* Corner brackets */}
            {(["tl", "tr", "bl", "br"] as const).map(pos => (
              <div
                key={pos}
                className="absolute"
                style={{
                  width: 48,
                  height: 48,
                  top: pos[0] === "t" ? 28 : undefined,
                  bottom: pos[0] === "b" ? 28 : undefined,
                  left: pos[1] === "l" ? 28 : undefined,
                  right: pos[1] === "r" ? 28 : undefined,
                  borderTop: pos[0] === "t" ? "1.5px solid rgba(232,0,45,0.35)" : undefined,
                  borderBottom: pos[0] === "b" ? "1.5px solid rgba(232,0,45,0.35)" : undefined,
                  borderLeft: pos[1] === "l" ? "1.5px solid rgba(232,0,45,0.35)" : undefined,
                  borderRight: pos[1] === "r" ? "1.5px solid rgba(232,0,45,0.35)" : undefined,
                  animation: "corner-blink 3s ease-in-out infinite",
                  animationDelay: pos === "tr" || pos === "bl" ? "1.5s" : "0s",
                }}
              />
            ))}

            {/* Horizontal rule top */}
            <div
              className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent 5%, rgba(232,0,45,0.2) 30%, rgba(232,0,45,0.2) 70%, transparent 95%)" }}
            />

            {/* F1 logo */}
            <div
              className="flex items-center gap-3 mb-8"
              style={{ animation: "fade-in 0.5s ease forwards" }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0"
                style={{ background: "var(--f1-red)", boxShadow: "0 0 28px rgba(232,0,45,0.5)" }}
              >
                <span className="text-white font-black text-sm leading-none" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.05em" }}>F1</span>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.42em]" style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.6)" }}>
                  Mission Control
                </div>
                <div className="text-[8px] uppercase tracking-[0.28em] mt-0.5" style={{ fontFamily: "var(--font-data)", color: "#2a2f40" }}>
                  Telemetry System · v2.0
                </div>
              </div>
            </div>

            {/* Car — large centerpiece */}
            <div
              className="relative mb-6"
              style={{ width: "min(560px, 55vw)", animation: "fade-in 0.8s ease 0.2s both" }}
            >
              {/* Glow behind car */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: "25% 10% 0 10%",
                  background: "radial-gradient(ellipse at 50% 80%, rgba(232,0,45,0.18) 0%, transparent 70%)",
                  filter: "blur(20px)",
                }}
              />

              {/* Car itself */}
              <div ref={standbyCarRef} style={{ opacity: 0.65 }}>
                <F1CarSVG className="w-full" />
              </div>

              {/* Scan line that sweeps over car */}
              <div
                ref={scanLineRef}
                className="absolute inset-x-0 pointer-events-none"
                style={{
                  top: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, transparent 0%, rgba(232,0,45,0.7) 20%, rgba(255,255,255,0.9) 50%, rgba(232,0,45,0.7) 80%, transparent 100%)",
                  boxShadow: "0 0 12px rgba(232,0,45,0.8)",
                  opacity: 0,
                }}
              />

              {/* Side decorative lines */}
              <div
                className="absolute top-1/2 -left-6 w-4 h-px pointer-events-none"
                style={{ background: "rgba(232,0,45,0.3)", transform: "translateY(-50%)" }}
              />
              <div
                className="absolute top-1/2 -right-6 w-4 h-px pointer-events-none"
                style={{ background: "rgba(232,0,45,0.3)", transform: "translateY(-50%)" }}
              />
            </div>

            {/* STANDBY label */}
            <div className="text-center mb-6">
              <div className="text-[8px] uppercase tracking-[0.6em] mb-2" style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.4)" }}>
                System Status
              </div>
              <div
                className="font-black uppercase tracking-[0.22em]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(22px, 3vw, 36px)",
                  color: "#2a3040",
                  letterSpacing: "0.22em",
                  animation: "flag-pulse 3s ease-in-out infinite",
                }}
              >
                STANDBY
              </div>
            </div>

            {/* Boot lines */}
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "#2e3444",
                minHeight: 96,
                width: "min(340px, 80vw)",
                background: "rgba(14,16,21,0.6)",
                border: "1px solid rgba(232,0,45,0.07)",
                padding: "12px 14px",
                marginBottom: 24,
              }}
            >
              {bootLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2 mb-1" style={{ animation: "fade-in 0.3s ease forwards" }}>
                  <span style={{ color: i === bootLines.length - 1 ? "rgba(232,0,45,0.5)" : "#252830", flexShrink: 0 }}>›</span>
                  <span style={{ color: line.includes("[OK]") ? "#3a4560" : i === bootLines.length - 1 ? "rgba(232,0,45,0.65)" : "#2e3444" }}>
                    {line}
                  </span>
                </div>
              ))}
              {bootLines.length >= BOOT_LINES.length && (
                <span style={{ color: "rgba(232,0,45,0.4)", animation: "flag-pulse 1s ease-in-out infinite" }}>█</span>
              )}
            </div>

            {/* Initiate button */}
            <button
              onClick={handleInitiate}
              className="relative overflow-hidden"
              style={{
                background: "rgba(232,0,45,0.05)",
                border: "1px solid rgba(232,0,45,0.35)",
                padding: "16px 56px",
                cursor: "pointer",
                animation: "glow-red 2.2s ease-in-out infinite",
                minWidth: 260,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(232,0,45,0.1)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,45,0.6)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(232,0,45,0.05)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,45,0.35)";
              }}
            >
              {/* Scan sweep */}
              <div
                className="absolute inset-x-0 h-8 pointer-events-none"
                style={{ top: 0, background: "linear-gradient(180deg,rgba(232,0,45,0.1),transparent)", animation: "scan 2s ease-in-out infinite" }}
              />
              {/* Corner accents */}
              <div className="absolute top-1 left-1 w-2 h-2 border-t border-l" style={{ borderColor: "rgba(232,0,45,0.5)" }} />
              <div className="absolute top-1 right-1 w-2 h-2 border-t border-r" style={{ borderColor: "rgba(232,0,45,0.5)" }} />
              <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l" style={{ borderColor: "rgba(232,0,45,0.5)" }} />
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r" style={{ borderColor: "rgba(232,0,45,0.5)" }} />
              <span className="relative text-[12px] font-bold uppercase tracking-[0.5em]" style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.85)" }}>
                Initiate System
              </span>
            </button>

            {/* Bottom label */}
            <div
              className="absolute bottom-7 flex items-center gap-4"
              style={{ animation: "fade-in 1s ease 2s both" }}
            >
              <div className="h-px w-12" style={{ background: "rgba(232,0,45,0.15)" }} />
              <span className="text-[8px] uppercase tracking-[0.35em]" style={{ fontFamily: "var(--font-display)", color: "#1f2330" }}>
                F1 Telemetry Dashboard · Ready
              </span>
              <div className="h-px w-12" style={{ background: "rgba(232,0,45,0.15)" }} />
            </div>

            {/* Horizontal rule bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent 5%, rgba(232,0,45,0.15) 30%, rgba(232,0,45,0.15) 70%, transparent 95%)" }}
            />
          </div>
        </>
      )}
    </div>
  );
}
