import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger } from "animejs";
import { useNextSession, type OpenF1Session } from "../hooks/useNextSession";

// ── Web Audio power-up SFX ────────────────────────────────────────────
function playPowerUp(ctx: AudioContext) {
  const t = ctx.currentTime;

  // Engine rumble sweep 55→180 Hz
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

  // Lock beep at t+0.35
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

  // Confirmation chirp at t+0.65
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

// ── Static fallback sessions (Belgium 2023 + neighbours) ─────────────
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

// ── Boot sequence lines ───────────────────────────────────────────────
const BOOT_LINES = [
  "INITIALIZING TELEMETRY SYSTEMS...",
  "LOADING DRIVER DATABASE............[OK]",
  "CALIBRATING SENSOR ARRAY...........[OK]",
  "SYNCHRONIZING TIMING DATA..........[OK]",
  "ESTABLISHING API CONNECTION........[OK]",
  "SYSTEM NOMINAL. AWAITING INPUT.",
];

// ── Shard grid ────────────────────────────────────────────────────────
const COLS = 7;
const ROWS = 5;

// ── F1 Car Wireframe (top-down, car faces right) ──────────────────────
function WireframeCar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      className={className}
      style={{ filter: "drop-shadow(0 0 6px rgba(232,0,45,0.5))" }}
    >
      <defs>
        <filter id="carGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#carGlow)" stroke="#e8002d" strokeWidth="1" fill="none" opacity="0.85">
        {/* Main body */}
        <path d="M 310,68 C 300,58 268,52 200,50 L 80,48 C 40,47 14,55 10,80 C 14,105 40,113 80,112 L 200,110 C 268,108 300,102 310,92 Z" />
        {/* Nose cone */}
        <path d="M 310,68 L 350,75 L 350,85 L 310,92" strokeWidth="0.8" opacity="0.7" />
        {/* Front wing */}
        <path d="M 340,50 L 356,42 L 356,118 L 340,110 Z" strokeWidth="1.2" />
        <line x1="356" y1="42" x2="356" y2="118" strokeWidth="0.5" opacity="0.4" />
        {/* Rear body */}
        <line x1="10" y1="80" x2="10" y2="80" strokeWidth="2" strokeLinecap="round" />
        {/* Rear wing */}
        <rect x="0" y="36" width="16" height="88" rx="2" strokeWidth="1.2" />
        <line x1="8" y1="36" x2="8" y2="124" strokeWidth="0.4" opacity="0.4" />
        {/* Front-right wheel */}
        <ellipse cx="252" cy="40" rx="26" ry="10" />
        <ellipse cx="252" cy="40" rx="14" ry="5" opacity="0.35" />
        {/* Front-left wheel */}
        <ellipse cx="252" cy="120" rx="26" ry="10" />
        <ellipse cx="252" cy="120" rx="14" ry="5" opacity="0.35" />
        {/* Rear-right wheel */}
        <ellipse cx="60" cy="40" rx="28" ry="11" />
        <ellipse cx="60" cy="40" rx="15" ry="6" opacity="0.35" />
        {/* Rear-left wheel */}
        <ellipse cx="60" cy="120" rx="28" ry="11" />
        <ellipse cx="60" cy="120" rx="15" ry="6" opacity="0.35" />
        {/* Suspension arms front */}
        <line x1="240" y1="50" x2="228" y2="46" strokeWidth="0.7" opacity="0.6" />
        <line x1="240" y1="110" x2="228" y2="114" strokeWidth="0.7" opacity="0.6" />
        {/* Suspension arms rear */}
        <line x1="72" y1="49" x2="86" y2="53" strokeWidth="0.7" opacity="0.6" />
        <line x1="72" y1="111" x2="86" y2="107" strokeWidth="0.7" opacity="0.6" />
        {/* Cockpit halo */}
        <ellipse cx="200" cy="80" rx="42" ry="17" />
        {/* Inner body line */}
        <path d="M 130,60 C 180,58 220,58 290,63" strokeWidth="0.5" opacity="0.3" />
        <path d="M 130,100 C 180,102 220,102 290,97" strokeWidth="0.5" opacity="0.3" />
        {/* Centreline */}
        <line x1="14" y1="80" x2="340" y2="80" strokeWidth="0.4" strokeDasharray="6 4" opacity="0.2" />
        {/* Sidepod details */}
        <path d="M 100,52 L 95,48 M 100,108 L 95,112" strokeWidth="0.6" opacity="0.5" />
        <path d="M 160,51 L 160,48 M 160,109 L 160,112" strokeWidth="0.6" opacity="0.5" />
      </g>
    </svg>
  );
}

// ── Countdown display ─────────────────────────────────────────────────
function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ fontFamily: "var(--font-data)", color: "var(--f1-red)" }}
      >
        {pad2(value)}
      </div>
      <div
        className="text-[8px] mt-0.5 uppercase"
        style={{ fontFamily: "var(--font-display)", color: "#3a4258", letterSpacing: "0.2em" }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Session tile ──────────────────────────────────────────────────────
function SessionTile({ session, onNavigate }: { session: OpenF1Session; onNavigate: (key: number) => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="session-tile shrink-0 text-left relative overflow-hidden"
      style={{
        background: hov ? "var(--f1-card)" : "var(--f1-surface)",
        border: `1px solid ${hov ? "rgba(232,0,45,0.5)" : "var(--f1-border)"}`,
        borderTop: `2px solid ${hov ? "var(--f1-red)" : "var(--f1-border)"}`,
        padding: "14px 16px",
        minWidth: 148,
        cursor: "pointer",
        transition: "border-color 0.18s ease, background 0.18s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onNavigate(session.session_key)}
    >
      {hov && (
        <div
          className="absolute left-0 right-0 h-6 pointer-events-none"
          style={{
            top: 0,
            background: "linear-gradient(180deg,rgba(232,0,45,0.06),transparent)",
            animation: "scan 1.4s ease-in-out infinite",
          }}
        />
      )}
      <div
        className="text-[10px] font-bold mb-1 uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-data)", color: hov ? "var(--f1-red)" : "#5a6272" }}
      >
        {session.country_code}
      </div>
      <div
        className="text-sm font-bold leading-tight mb-2 text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
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

// ── Main component ────────────────────────────────────────────────────
type Phase = "standby" | "shattering" | "menu";

export default function Home() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("standby");
  const shardsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const standbyRef = useRef<HTMLDivElement>(null);
  const menuAnimated = useRef(false);

  const [bootLines, setBootLines] = useState<string[]>([]);
  const [clock, setClock] = useState("");
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown>>(null);

  const { nextSession, recentRaces, liveSession } = useNextSession();

  // Boot sequence
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i >= BOOT_LINES.length) { clearInterval(iv); return; }
      setBootLines(prev => [...prev, BOOT_LINES[i++]]);
    }, 440);
    return () => clearInterval(iv);
  }, []);

  // UTC clock
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Next GP countdown
  useEffect(() => {
    if (!nextSession) return;
    const target = new Date(nextSession.date_start);
    const tick = () => setCountdown(getCountdown(target));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [nextSession]);

  // Menu entrance — choreographed at 120 BPM (500ms/beat)
  useEffect(() => {
    if (phase !== "menu" || menuAnimated.current || !menuRef.current) return;
    menuAnimated.current = true;
    const menu = menuRef.current;

    // Beat 0: top bar slides down
    animate(menu.querySelectorAll(".mc-topbar"), {
      translateY: [-20, 0],
      opacity: [0, 1],
      duration: 380,
      easing: "easeOutCubic",
    });

    // Beat 1 (500ms): hero title letters drop
    animate(menu.querySelectorAll(".mc-letter"), {
      translateY: [-36, 0],
      opacity: [0, 1],
      duration: 480,
      delay: stagger(38, { start: 500 }),
      easing: "easeOutCubic",
    });

    // Beat 2 (1000ms): right cards slide in
    animate(menu.querySelectorAll(".mc-card"), {
      translateX: [24, 0],
      opacity: [0, 1],
      duration: 420,
      delay: stagger(140, { start: 1000 }),
      easing: "easeOutCubic",
    });

    // Beat 3 (1500ms): session tiles float up
    animate(menu.querySelectorAll(".session-tile"), {
      translateY: [18, 0],
      opacity: [0, 1],
      duration: 380,
      delay: stagger(70, { start: 1500 }),
      easing: "easeOutCubic",
    });

    // Beat 4 (2000ms): tagline
    animate(menu.querySelectorAll(".mc-tagline"), {
      opacity: [0, 1],
      duration: 500,
      delay: 2000,
      easing: "easeOutCubic",
    });
  }, [phase]);

  const handleInitiate = useCallback(() => {
    if (phase !== "standby") return;

    try {
      const ctx = new AudioContext();
      playPowerUp(ctx);
    } catch {
      // Browser may block AudioContext before first interaction fires — safe to ignore
    }

    setPhase("shattering");

    requestAnimationFrame(() => {
      // Fade standby content out
      if (standbyRef.current) {
        animate(standbyRef.current, {
          opacity: [1, 0],
          duration: 320,
          easing: "easeInCubic",
        });
      }

      // Reveal menu underneath
      if (menuRef.current) {
        animate(menuRef.current, {
          opacity: [0, 1],
          duration: 950,
          delay: 180,
          easing: "easeOutCubic",
        });
      }

      // Shatter the shard grid
      if (!shardsRef.current) return;
      const shards = Array.from(shardsRef.current.querySelectorAll<HTMLElement>(".shard"));
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      shards.forEach(shard => {
        const r = shard.getBoundingClientRect();
        const sx = r.left + r.width / 2;
        const sy = r.top + r.height / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 260 + Math.random() * 380;
        const delay = Math.random() * 220;

        animate(shard, {
          translateX: (dx / dist) * speed,
          translateY: (dy / dist) * speed,
          rotate: (Math.random() - 0.5) * 110,
          opacity: [1, 0],
          duration: 750 + Math.random() * 450,
          delay,
          easing: "easeInCubic",
        });
      });

      setTimeout(() => setPhase("menu"), 1200);
    });
  }, [phase]);

  const sessions = recentRaces.length > 0 ? recentRaces : FALLBACK;

  return (
    <div className="h-screen overflow-hidden relative" style={{ background: "var(--f1-dark)" }}>

      {/* ═══════════════════════════════════════════════════════════
          MAIN MENU — always rendered, revealed by shattering phase
          ═══════════════════════════════════════════════════════════ */}
      <div
        ref={menuRef}
        className={`absolute inset-0 flex flex-col speed-lines${phase !== "menu" ? " mc-menu-hidden" : ""}`}
      >
        {/* Top status bar */}
        <div
          className="mc-topbar flex items-center justify-between px-6 py-3 shrink-0"
          style={{
            borderBottom: "1px solid rgba(232,0,45,0.18)",
            background: "rgba(6,7,10,0.96)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: "var(--f1-red)" }}
            >
              <span
                className="text-white font-black text-xs leading-none"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.05em" }}
              >
                F1
              </span>
            </div>
            <div className="h-4 w-px bg-[#1f2330]" />
            <span
              className="text-[10px] uppercase tracking-[0.28em]"
              style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
            >
              Mission Control
            </span>
          </div>

          <div className="flex items-center gap-5">
            {liveSession ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"
                  style={{ animation: "flag-pulse 1s ease-in-out infinite" }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.18em] text-[#22c55e]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Live · {liveSession.meeting_name.replace(" Grand Prix", " GP")}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3a4258]" />
                <span
                  className="text-[10px] uppercase tracking-[0.18em] text-[#3a4258]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Standby
                </span>
              </div>
            )}
            <span
              className="text-[10px] tabular-nums"
              style={{ fontFamily: "var(--font-data)", color: "#2e3444" }}
            >
              {clock}
            </span>
          </div>
        </div>

        {/* Content row */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left — hero + car wireframe */}
          <div className="flex-1 flex flex-col justify-center px-12 gap-8 relative overflow-hidden">
            {/* Ambient car wireframe */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ opacity: 0.07 }}
            >
              <WireframeCar className="w-full max-w-2xl" />
            </div>

            {/* Hero title */}
            <div className="relative">
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
                <div>
                  {"MISSION".split("").map((l, i) => (
                    <span
                      key={`m${i}`}
                      className="mc-letter inline-block text-white"
                      style={{}}
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <div>
                  {"CONTROL".split("").map((l, i) => (
                    <span
                      key={`c${i}`}
                      className="mc-letter inline-block"
                      style={{ color: "var(--f1-red)" }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Underline */}
              <div
                className="h-px mt-4"
                style={{
                  background: "linear-gradient(90deg,var(--f1-red),transparent)",
                  width: "clamp(200px,45%,480px)",
                }}
              />
            </div>

            <p
              className="mc-tagline text-[10px] uppercase tracking-[0.32em]"
              style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
            >
              F1 Telemetry Dashboard · Season {new Date().getFullYear()}
            </p>
          </div>

          {/* Right — info panels */}
          <div
            className="w-76 flex flex-col gap-4 px-6 py-8 shrink-0 overflow-y-auto"
            style={{ width: 300 }}
          >
            {/* Next GP */}
            {nextSession && (
              <div
                className="mc-card"
                style={{
                  background: "var(--f1-card)",
                  border: "1px solid var(--f1-border)",
                  borderLeft: "3px solid var(--f1-red)",
                  padding: "16px 20px",
                }}
              >
                <div
                  className="text-[9px] uppercase tracking-[0.28em] mb-3"
                  style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
                >
                  Next Grand Prix
                </div>
                <div
                  className="text-[15px] font-bold text-white leading-none mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {nextSession.meeting_name}
                </div>
                <div
                  className="text-[10px] mb-4"
                  style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}
                >
                  {nextSession.circuit_short_name} · {nextSession.country_name}
                </div>
                {countdown ? (
                  <div className="grid grid-cols-4 gap-2">
                    <CountdownBlock label="DAYS" value={countdown.d} />
                    <CountdownBlock label="HRS"  value={countdown.h} />
                    <CountdownBlock label="MIN"  value={countdown.m} />
                    <CountdownBlock label="SEC"  value={countdown.s} />
                  </div>
                ) : (
                  <div
                    className="text-[10px] tracking-[0.18em]"
                    style={{ fontFamily: "var(--font-display)", color: "var(--f1-red)" }}
                  >
                    UNDERWAY
                  </div>
                )}
              </div>
            )}

            {/* System status */}
            <div
              className="mc-card"
              style={{
                background: "var(--f1-card)",
                border: "1px solid var(--f1-border)",
                borderLeft: "3px solid rgba(34,197,94,0.5)",
                padding: "14px 20px",
              }}
            >
              <div
                className="text-[9px] uppercase tracking-[0.28em] mb-3"
                style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
              >
                System Status
              </div>
              {[
                { label: "TELEMETRY ENGINE", ok: true },
                { label: "API CONNECTION", ok: true },
                { label: "SENSOR ARRAY", ok: true },
                { label: "RACE CALENDAR", ok: !!nextSession },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span
                    className="text-[9px] uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: ok ? "#22c55e" : "#e8002d",
                        animation: `flag-pulse ${ok ? "2.4" : "0.8"}s ease-in-out infinite`,
                      }}
                    />
                    <span
                      className="text-[9px] uppercase tracking-[0.1em]"
                      style={{ fontFamily: "var(--font-data)", color: ok ? "#22c55e" : "var(--f1-red)" }}
                    >
                      {ok ? "NOMINAL" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* WIP badge */}
            <div
              className="mc-card flex items-center gap-2 px-4 py-3"
              style={{
                background: "rgba(255,214,0,0.04)",
                border: "1px solid rgba(255,214,0,0.1)",
                borderLeft: "3px solid rgba(255,214,0,0.4)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: "var(--f1-accent)",
                  boxShadow: "0 0 6px var(--f1-accent)",
                  animation: "flag-pulse 1.8s ease-in-out infinite",
                }}
              />
              <span
                className="text-[9px] uppercase tracking-[0.2em]"
                style={{ fontFamily: "var(--font-display)", color: "#7a6e38" }}
              >
                Safety Car Deployed · Still Building
              </span>
            </div>
          </div>
        </div>

        {/* Session carousel */}
        <div className="shrink-0 px-8 pb-6">
          <div
            className="text-[9px] uppercase tracking-[0.28em] mb-3"
            style={{ fontFamily: "var(--font-display)", color: "#2e3444" }}
          >
            Recent Sessions
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {sessions.map(s => (
              <SessionTile key={s.session_key} session={s} onNavigate={key => navigate(`/race/${key}`)} />
            ))}
          </div>
        </div>

        {/* Bottom accent */}
        <div
          className="h-px w-full shrink-0"
          style={{ background: "linear-gradient(90deg,transparent,var(--f1-red) 40%,transparent)" }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          STANDBY + SHATTER LAYERS
          ═══════════════════════════════════════════════════════════ */}
      {(phase === "standby" || phase === "shattering") && (
        <>
          {/* Shard grid — below standby UI (z-10), shatters to reveal menu (z-0) */}
          <div
            ref={shardsRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 10 }}
          >
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

          {/* Standby UI — sits above shard grid (z-20), fades out on initiate */}
          <div
            ref={standbyRef}
            className="absolute inset-0 flex flex-col items-center justify-center gap-7 speed-lines"
            style={{ zIndex: 20, pointerEvents: phase === "standby" ? "auto" : "none" }}
          >
            {/* Corner brackets */}
            {(["tl","tr","bl","br"] as const).map(pos => (
              <div
                key={pos}
                className="absolute w-9 h-9"
                style={{
                  top: pos[0] === "t" ? 32 : undefined,
                  bottom: pos[0] === "b" ? 32 : undefined,
                  left: pos[1] === "l" ? 32 : undefined,
                  right: pos[1] === "r" ? 32 : undefined,
                  borderTop: pos[0] === "t" ? "2px solid rgba(232,0,45,0.28)" : undefined,
                  borderBottom: pos[0] === "b" ? "2px solid rgba(232,0,45,0.28)" : undefined,
                  borderLeft: pos[1] === "l" ? "2px solid rgba(232,0,45,0.28)" : undefined,
                  borderRight: pos[1] === "r" ? "2px solid rgba(232,0,45,0.28)" : undefined,
                  animation: "corner-blink 3s ease-in-out infinite",
                  animationDelay: pos === "tr" || pos === "bl" ? "1.5s" : "0s",
                }}
              />
            ))}

            {/* F1 badge */}
            <div
              className="w-11 h-11 flex items-center justify-center"
              style={{ background: "var(--f1-red)", boxShadow: "0 0 24px rgba(232,0,45,0.4)" }}
            >
              <span
                className="text-white font-black text-base leading-none"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.05em" }}
              >
                F1
              </span>
            </div>

            {/* Car wireframe */}
            <WireframeCar
              className="w-full max-w-sm"
              // inline opacity handled by parent opacity
            />

            {/* SYSTEM STANDBY */}
            <div className="text-center -mt-2">
              <div
                className="text-[10px] uppercase tracking-[0.5em] mb-1.5"
                style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.5)" }}
              >
                System Status
              </div>
              <div
                className="text-3xl font-black uppercase tracking-[0.18em]"
                style={{ fontFamily: "var(--font-display)", color: "#3a4258" }}
              >
                STANDBY
              </div>
            </div>

            {/* Boot log */}
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "#2e3444",
                minHeight: 96,
                width: 320,
              }}
            >
              {bootLines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 mb-1"
                  style={{ animation: "fade-in 0.3s ease forwards" }}
                >
                  <span style={{ color: i === bootLines.length - 1 ? "rgba(232,0,45,0.5)" : "#2a2d35", flexShrink: 0 }}>›</span>
                  <span
                    style={{
                      color: line.includes("[OK]")
                        ? "#2e3444"
                        : i === bootLines.length - 1
                          ? "rgba(232,0,45,0.65)"
                          : "#2e3444",
                    }}
                  >
                    {line}
                  </span>
                </div>
              ))}
              {bootLines.length >= BOOT_LINES.length && (
                <span
                  style={{ color: "rgba(232,0,45,0.4)", animation: "flag-pulse 1s ease-in-out infinite" }}
                >
                  █
                </span>
              )}
            </div>

            {/* INITIATE SYSTEM button */}
            <button
              onClick={handleInitiate}
              className="relative overflow-hidden group"
              style={{
                background: "rgba(232,0,45,0.05)",
                border: "1px solid rgba(232,0,45,0.35)",
                padding: "13px 44px",
                cursor: "pointer",
                animation: "glow-red 2.2s ease-in-out infinite",
              }}
            >
              {/* Scan sweep */}
              <div
                className="absolute inset-x-0 h-7 pointer-events-none"
                style={{
                  top: 0,
                  background: "linear-gradient(180deg,rgba(232,0,45,0.1),transparent)",
                  animation: "scan 2s ease-in-out infinite",
                }}
              />
              <span
                className="relative text-[12px] font-bold uppercase tracking-[0.45em]"
                style={{ fontFamily: "var(--font-display)", color: "rgba(232,0,45,0.85)" }}
              >
                Initiate System
              </span>
            </button>

            {/* Bottom label */}
            <div
              className="absolute bottom-7 text-[9px] uppercase tracking-[0.3em]"
              style={{ fontFamily: "var(--font-display)", color: "#1f2330" }}
            >
              F1 Telemetry Dashboard · Ready
            </div>
          </div>
        </>
      )}
    </div>
  );
}
