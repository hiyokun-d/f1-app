import "../../styles/Header.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Weather, RaceControl } from "../../types";
import { flagColor } from "../../utils/format";
import AnimatedValue from "../ui/AnimatedValue";
import { animate, createTimeline, spring } from "animejs";

interface Props {
  sessionName: string;
  sessionType: string;
  location: string;
  currentLap: number;
  totalLaps: number;
  weather: Weather | null;
  raceControl: RaceControl[];
  sessionDateStart: string | null;
  sessionDateEnd: string | null;
  replayTime: Date | null;
  bestSectors: { s1: number | null; s2: number | null; s3: number | null };
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function fmtUTCTime(d: Date) {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}

// Softer colors for text/status use (fColor from flagColor() stays for strips/borders)
function statusColor(flag: string): string {
  switch (flag) {
    case "GREEN":
      return "#22c55e";
    case "YELLOW":
    case "DOUBLE YELLOW":
      return "#ffd600";
    case "RED":
      return "#ef4444";
    case "BLUE":
      return "#60a5fa";
    case "CHEQUERED":
      return "#f0f0f0";
    case "SAFETY CAR":
      return "#f97316";
    case "VIRTUAL SAFETY CAR":
      return "#f59e0b";
    default:
      return "#6b7280";
  }
}


function WindArrow({ degrees }: { degrees: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        transform: `rotate(${degrees}deg)`,
        fontSize: 10,
      }}
    >
      ↑
    </span>
  );
}

function Stat({
  label,
  value,
  hot,
  blue,
}: {
  label: string;
  value: string;
  hot?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="text-[9px] uppercase tracking-[0.15em] mb-0.5"
        style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{
          fontFamily: "var(--font-data)",
          color: blue ? "#60a5fa" : hot ? "#f97316" : "#f0f0f0",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Header({
  sessionName,
  sessionType,
  currentLap,
  totalLaps,
  location,
  raceControl,
  sessionDateStart,
  sessionDateEnd,
  replayTime,
  bestSectors,
  weather,
}: Props) {
  const latestFlag = [...raceControl].reverse().find((r) => r.flag);
  const flagStr = latestFlag?.flag ?? "GREEN";
  const fColor = flagColor(flagStr);
  const sColor = statusColor(flagStr);
  const isNonGreen = flagStr !== "GREEN";

  const prevFlagRef = useRef(flagStr);
  const [flagPulse, setFlagPulse] = useState(false);
  const [flagBanner, setFlagBanner] = useState(false);

  useEffect(() => {
    if (prevFlagRef.current !== flagStr) {
      prevFlagRef.current = flagStr;
      setFlagPulse(true);
      setFlagBanner(true);
      const t1 = setTimeout(() => setFlagPulse(false), 1500);
      const t2 = setTimeout(() => setFlagBanner(false), 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [flagStr]);

  // ── AnimeJS: chequered / black-and-white flag animations ─────────
  const headerRef = useRef<HTMLElement>(null);
  const chqOverlayRef = useRef<HTMLDivElement>(null);
  const activeFlagTlRef = useRef<ReturnType<typeof createTimeline> | null>(
    null,
  );
  const prevFlagAnimRef = useRef<string | null>(null);

  // Set initial state on mount without animation (e.g. page load of a finished race)
  useLayoutEffect(() => {
    const overlay = chqOverlayRef.current;
    if (!overlay) return;
    prevFlagAnimRef.current = flagStr;
    if (flagStr === "CHEQUERED") {
      overlay.style.opacity = "0.35";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevFlagAnimRef.current === null) return; // layoutEffect hasn't run yet
    if (prevFlagAnimRef.current === flagStr) return;
    const prev = prevFlagAnimRef.current;
    prevFlagAnimRef.current = flagStr;

    if (activeFlagTlRef.current) {
      activeFlagTlRef.current.pause();
      activeFlagTlRef.current = null;
    }

    const overlay = chqOverlayRef.current;
    const header = headerRef.current;
    if (!overlay || !header) return;

    if (flagStr === "CHEQUERED") {
      const tl = createTimeline();
      activeFlagTlRef.current = tl;

      // Header drops in with a spring
      tl.add(
        header,
        {
          translateY: [-5, 0],
          duration: 700,
          ease: spring({ stiffness: 380, damping: 14, mass: 0.85 }),
        },
        0,
      );

      // Overlay sweeps in
      tl.add(
        overlay,
        {
          opacity: [0, 0.7],
          duration: 1100,
          ease: "outCubic",
        },
        0,
      );

      // Settle overlay at reduced opacity
      tl.add(
        overlay,
        {
          opacity: [0.7, 0.35],
          duration: 2400,
          ease: "outSine",
        },
        1300,
      );
    } else if (flagStr === "BLACK AND WHITE") {
      const tl = createTimeline();
      activeFlagTlRef.current = tl;

      // Strobe-flash the overlay twice then clear
      tl.add(
        overlay,
        {
          opacity: [0, 0.5, 0, 0.4, 0],
          duration: 1800,
          ease: "linear",
        },
        0,
      );
      tl.add(
        header,
        {
          boxShadow: [
            "0 0 0px rgba(255,255,255,0)",
            "0 2px 30px rgba(255,255,255,0.45)",
            "0 0 0px rgba(255,255,255,0)",
            "0 2px 22px rgba(255,255,255,0.3)",
            "0 0 0px rgba(255,255,255,0)",
          ],
          duration: 1800,
          ease: "linear",
        },
        0,
      );
    } else if (prev === "CHEQUERED") {
      // Fade out overlay when leaving CHEQUERED
      animate(overlay, {
        opacity: [0.35, 0],
        duration: 1400,
        ease: "outQuart",
      });
      animate(header, {
        boxShadow: "0 0 0px rgba(255,255,255,0)",
        duration: 800,
      });
    }
  }, [flagStr]);

  // Live = sessionDateEnd within last hour
  const isLive = sessionDateEnd
    ? Date.now() - new Date(sessionDateEnd).getTime() < 3_600_000
    : false;

  const [liveClock, setLiveClock] = useState(() => new Date());
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, [isLive]);

  const displayTime = isLive ? liveClock : replayTime;
  const timeStr = displayTime ? fmtUTCTime(displayTime) : "--:--:--";

  const sessionDate = sessionDateStart ? new Date(sessionDateStart) : null;
  const dateStr = sessionDate
    ? `${DAYS[sessionDate.getUTCDay()]} ${String(sessionDate.getUTCDate()).padStart(2, "0")} ${MONTHS[sessionDate.getUTCMonth()]} ${sessionDate.getUTCFullYear()}`
    : null;

  // Sector glow — fires when a new session-best is set
  const [sectorGlow, setSectorGlow] = useState({
    s1: false,
    s2: false,
    s3: false,
  });
  const prevBestRef = useRef(bestSectors);
  useEffect(() => {
    const prev = prevBestRef.current;
    const glow = { s1: false, s2: false, s3: false };
    let any = false;
    if (
      bestSectors.s1 !== null &&
      (prev.s1 === null || bestSectors.s1 < prev.s1)
    ) {
      glow.s1 = true;
      any = true;
    }
    if (
      bestSectors.s2 !== null &&
      (prev.s2 === null || bestSectors.s2 < prev.s2)
    ) {
      glow.s2 = true;
      any = true;
    }
    if (
      bestSectors.s3 !== null &&
      (prev.s3 === null || bestSectors.s3 < prev.s3)
    ) {
      glow.s3 = true;
      any = true;
    }
    prevBestRef.current = bestSectors;
    if (!any) return;
    setSectorGlow(glow);
    const t = setTimeout(
      () => setSectorGlow({ s1: false, s2: false, s3: false }),
      2500,
    );
    return () => clearTimeout(t);
  }, [bestSectors]);

  const latestRC = raceControl[raceControl.length - 1];

  return (
    <header
      ref={headerRef}
      className="shrink-0 relative flex flex-row justify-between"
      style={{
        background: isNonGreen
          ? `linear-gradient(135deg, rgba(4,5,8,0.97) 0%, ${sColor}0a 50%, rgba(4,5,8,0.97) 100%)`
          : "rgba(4,5,8,0.97)",
        borderBottom: `1px solid ${isNonGreen ? `${sColor}28` : "rgba(255,255,255,0.07)"}`,
        minHeight: 52,
        transition: "background 0.6s ease, border-color 0.6s ease",
      }}
    >
      {/* Checkered / penalty overlay — AnimeJS owns opacity */}
      <div className="header-chequered-overlay" ref={chqOverlayRef} />

      {/* Flag change banner — skip CHEQUERED/BLACK AND WHITE, they have dedicated AnimeJS animations */}
      {flagBanner &&
        isNonGreen &&
        flagStr !== "CHEQUERED" &&
        flagStr !== "BLACK AND WHITE" && (
          <div
            className="absolute top-full left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 animate-slide-down"
            style={{
              background: `${fColor}22`,
              borderBottom: `1px solid ${fColor}40`,
            }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ fontFamily: "var(--font-display)", color: fColor }}
            >
              {flagStr} FLAG
            </span>
            {latestRC?.message && (
              <span className="text-xs text-[#9ca3af] truncate">
                {latestRC.message}
              </span>
            )}
          </div>
        )}

      {/* ── LEFT — date / timestamp / status ── */}
      <div className="flex items-stretch">
        <div
          className="w-1 shrink-0 transition-colors duration-300"
          style={{
            background: fColor,
            boxShadow: flagPulse ? `0 0 15px ${fColor}` : "none",
            animation: flagPulse ? "flag-pulse 1.5s ease-in-out" : "none",
          }}
        />
        <div
          className="flex flex-col justify-center gap-1 px-5 py-3 border-r"
          style={{ borderColor: "#1f2330", minWidth: 240 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[8px] font-bold uppercase tracking-[0.25em] self-start px-1.5 py-0.5"
              style={{
                fontFamily: "var(--font-display)",
                color: fColor,
                background: `${fColor}18`,
                border: `1px solid ${fColor}30`,
              }}
            >
              {sessionType}
            </span>
            <span
              className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.25em] px-1.5 py-0.5"
              style={{
                fontFamily: "var(--font-display)",
                color: isLive ? "#22c55e" : "#f59e0b",
                background: isLive
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(245,158,11,0.1)",
                border: `1px solid ${isLive ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
              }}
            >
              {isLive && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#22c55e" }}
                />
              )}
              {isLive ? "LIVE" : "REPLAY"}
            </span>
          </div>
          <span
            className="text-sm font-bold text-white leading-none uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {location} {sessionName}
          </span>
          <div className="flex items-center gap-3">
            {dateStr && (
              <span
                className="text-[9px] uppercase tracking-[0.1em]"
                style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}
              >
                {dateStr}
              </span>
            )}
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "#4b5563",
                letterSpacing: "-0.02em",
              }}
            >
              {timeStr}
              <span style={{ color: "#2e3444", marginLeft: 3 }}>UTC</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── CENTER — lap counter + S1/S2/S3 best times ── */}
      <div className="flex items-stretch">
        <div
          className="flex flex-col items-center justify-center border-l-4 border-r-4"
          style={{
            borderColor: fColor,
            padding: "4px 20px 6px",
            gap: 2,
            minWidth: currentLap >= 100 ? 158 : currentLap >= 10 ? 138 : 118,
            transition: "border-color 0.4s ease, min-width 0.3s ease",
          }}
        >
          <span
            className="text-[11px] uppercase tracking-[0.2em] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "#5a6270" }}
          >
            LAP
          </span>
          <div className="flex items-baseline gap-1">
            <AnimatedValue
              value={currentLap}
              style={{
                fontFamily: "var(--font-data)",
                color: "#fff",
                fontSize: "1.5rem",
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            />
            {totalLaps > 0 && (
              <span
                className="text-sm"
                style={{ fontFamily: "var(--font-data)", color: "#5a6272" }}
              >
                /{totalLaps}
              </span>
            )}
          </div>

          {/* S1 / S2 / S3 best time boxes */}
          <div className="flex gap-1" style={{ marginTop: 4 }}>
            {(["s1", "s2", "s3"] as const).map((key, i) => {
              const val = bestSectors[key];
              const glowing = sectorGlow[key];
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "2px 5px",
                    border: `1px solid ${glowing ? "rgba(192,132,252,0.55)" : "#1f2330"}`,
                    boxShadow: glowing
                      ? "0 0 10px rgba(192,132,252,0.55), 0 0 28px rgba(192,132,252,0.2)"
                      : "none",
                    transition:
                      "border-color 0.35s ease, box-shadow 0.35s ease",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 5,
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: glowing ? "#c084fc" : "#3a4258",
                      transition: "color 0.35s ease",
                    }}
                  >
                    S{i+1}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 7,
                      letterSpacing: "-0.02em",
                      color: glowing ? "#c084fc" : "#4b5563",
                      transition: "color 0.35s ease",
                    }}
                  >
                    {val !== null ? (
                      <AnimatedValue value={parseFloat(val.toFixed(3))} />
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT — track status ── */}
      <div className="flex items-stretch">
        {/* Weather — right */}
        {weather && (
          <div
            className="flex items-center gap-5 ml-auto"
            style={{
              padding: "0 32px",
            }}
          >
            <Stat
              label="TRACK"
              value={`${weather.track_temperature.toFixed(0)}°`}
              hot={weather.track_temperature > 40}
            />
            <Stat
              label="AIR"
              value={`${weather.air_temperature.toFixed(0)}°`}
            />
            <Stat label="HUM" value={`${weather.humidity.toFixed(0)}%`} />
            {weather.rainfall > 0 && (
              <Stat label="RAIN" value={`${weather.rainfall}mm`} blue />
            )}
            <div className="flex flex-col items-center">
              <span
                className="text-[9px] uppercase tracking-[0.15em] mb-0.5"
                style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}
              >
                WIND
              </span>
              <span
                className="text-[11px] font-bold tabular-nums text-white"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {weather.wind_speed.toFixed(1)}
                <span style={{ color: "#5a6272" }}>km/h</span>{" "}
                <WindArrow degrees={weather.wind_direction} />
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
