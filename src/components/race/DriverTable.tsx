import { useEffect, useRef } from "react";
import type {
  Driver,
  Position,
  Interval,
  Lap,
  Stint,
  Pit,
  OvertakeEvent,
} from "../../types";
import {
  formatLapTime,
  formatGap,
  formatInterval,
  teamHex,
} from "../../utils/format";
import {
  animate,
  createLayout,
  createScope,
  cubicBezier,
  stagger,
} from "animejs";
import type { AutoLayout } from "animejs";

interface Props {
  positions: Position[];
  drivers: Driver[];
  intervals: Interval[];
  laps: Lap[];
  stints: Stint[];
  pits: Pit[];
  positionChanges: Record<number, "up" | "down">;
  selectedDriver: number | null;
  onSelectDriver: (dn: number) => void;
  recentOvertakes?: OvertakeEvent[];
  drsDriver?: number | null;
  drsActive?: boolean;
}

const TYRE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    SOFT: { bg: "#e8002d", text: "#fff", label: "S" },
    MEDIUM: { bg: "#ffd600", text: "#000", label: "M" },
    HARD: { bg: "#ffffff", text: "#000", label: "H" },
    INTERMEDIATE: { bg: "#39b54a", text: "#fff", label: "I" },
    WET: { bg: "#0067ff", text: "#fff", label: "W" },
    UNKNOWN: { bg: "#555", text: "#fff", label: "?" },
  };

function PositionNumber({
  pos,
  change,
}: {
  pos: number;
  change: "up" | "down" | undefined;
}) {
  const prevRef = useRef(pos);
  const animKey = useRef(0);
  if (prevRef.current !== pos) {
    animKey.current++;
    prevRef.current = pos;
  }
  return (
    <span
      key={animKey.current}
      className={
        change === "up"
          ? "animate-pos-up"
          : change === "down"
            ? "animate-pos-down"
            : ""
      }
      style={{
        display: "inline-block",
        fontFamily: "var(--font-data)",
        fontWeight: 900,
        fontSize: 14,
        color:
          change === "up"
            ? "#22c55e"
            : change === "down"
              ? "#ef4444"
              : pos === 1
                ? "#ffd600"
                : "#fff",
      }}
    >
      {pos}
    </span>
  );
}

export default function DriverTable({
  positions,
  drivers,
  intervals,
  laps,
  stints,
  pits,
  positionChanges,
  selectedDriver,
  onSelectDriver,
  recentOvertakes,
  drsDriver,
  drsActive,
}: Props) {
  const driverLayout = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const layout = useRef<AutoLayout | null>(null);
  const prevPitRef = useRef(new Map<number, string>());
  const prevOvertakesLenRef = useRef(-1); // -1 = uninitialized, skip first batch
  const prevDrsRef = useRef<{
    active: boolean;
    driver: number | null | undefined;
  }>({ active: false, driver: null });

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));
  const intervalMap = new Map(intervals.map((i) => [i.driver_number, i]));

  const stintMap = new Map<number, Stint>();
  stints.forEach((s) => {
    const existing = stintMap.get(s.driver_number);
    if (!existing || s.stint_number > existing.stint_number)
      stintMap.set(s.driver_number, s);
  });

  const lapMap = new Map<number, Lap>();
  laps.forEach((l) => {
    const existing = lapMap.get(l.driver_number);
    if (!existing || l.lap_number > existing.lap_number)
      lapMap.set(l.driver_number, l);
  });

  const bestLapMap = new Map<number, number>();
  laps.forEach((l) => {
    if (l.lap_duration === null) return;
    const current = bestLapMap.get(l.driver_number);
    if (current === undefined || l.lap_duration < current)
      bestLapMap.set(l.driver_number, l.lap_duration);
  });

  const overallBest = Math.min(
    ...Array.from(bestLapMap.values()).filter((v) => v > 0),
  );

  const pitCountMap = new Map<number, number>();
  pits.forEach((p) =>
    pitCountMap.set(
      p.driver_number,
      (pitCountMap.get(p.driver_number) ?? 0) + 1,
    ),
  );

  // Most recent completed pit stop per driver (for showing duration on exit)
  const lastPitMap = new Map<number, Pit>();
  pits.forEach((p) => {
    if (p.pit_duration === null) return;
    const cur = lastPitMap.get(p.driver_number);
    if (!cur || p.lap_number > cur.lap_number)
      lastPitMap.set(p.driver_number, p);
  });

  const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number), 0);

  // 'pitting'  — driver is currently in the pit lane
  // 'just_out' — driver just exited on this or the previous lap
  const pitStatusMap = new Map<number, "pitting" | "just_out">();

  // just_out: latest lap is a pit-out lap on a recent lap
  lapMap.forEach((lap, dn) => {
    if (lap.is_pit_out_lap && lap.lap_number >= maxLap - 1)
      pitStatusMap.set(dn, "just_out");
  });

  pits.forEach((p) => {
    if (p.lap_number < maxLap - 1) return; // too old
    if (pitStatusMap.get(p.driver_number) === "just_out") return; // already out

    if (p.pit_duration === null) {
      // Live: null duration means still in pit
      pitStatusMap.set(p.driver_number, "pitting");
    } else {
      // Replay: pit on recent lap but driver's latest lap isn't a pit-out → still in
      const latestLap = lapMap.get(p.driver_number);
      if (!latestLap?.is_pit_out_lap)
        pitStatusMap.set(p.driver_number, "pitting");
    }
  });

  // Create AnimeJS layout + ResizeObserver for breakpoint switching
  useEffect(() => {
    if (!driverLayout.current) return;

    layout.current = createLayout(driverLayout.current, {
      children: ".driver-detail",
      enterFrom: { opacity: 0, x: -8 },
      leaveTo: { opacity: 0, x: -8 },
      duration: 350,
      ease: "inOut(3)",
    });

    let expanded = false;
    const ro = new ResizeObserver(([entry]) => {
      const shouldExpand = entry.contentRect.width >= 380;
      if (shouldExpand === expanded || !layout.current) return;
      expanded = shouldExpand;
      layout.current.update(({ root }) => {
        root.classList.toggle("driver-table-expanded", shouldExpand);
      });
    });
    ro.observe(driverLayout.current);

    return () => {
      ro.disconnect();
      layout.current?.revert();
      layout.current = null;
    };
  }, []);

  // Row-level pit animation: yellow bg + PITTING flash → green bg + pit time
  useEffect(() => {
    if (!driverLayout.current) return;
    const c = driverLayout.current;

    pitStatusMap.forEach((status, dn) => {
      if (prevPitRef.current.get(dn) === status) return;
      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const label = c.querySelector<HTMLElement>(`[data-pit-label="${dn}"]`);
      const time = c.querySelector<HTMLElement>(`[data-pit-time="${dn}"]`);

      if (status === "pitting") {
        if (bg)
          animate(bg, {
            backgroundColor: ["rgba(255,214,0,0)", "rgba(255,214,0,0.22)"],
            duration: 180,
            ease: "outQuart",
          });
        if (label) {
          animate(label, { opacity: [0, 1], duration: 120, ease: "outQuart" });
          animate(label, {
            opacity: [1, 0],
            duration: 220,
            delay: 820,
            ease: "inQuart",
          });
        }
        if (time) animate(time, { opacity: [1, 0], duration: 100 });
      } else if (status === "just_out") {
        if (bg)
          animate(bg, {
            backgroundColor: ["rgba(255,214,0,0.22)", "rgba(34,197,94,0.2)"],
            duration: 350,
            ease: "outQuart",
          });
        if (label) animate(label, { opacity: [1, 0], duration: 150 });
        if (time)
          animate(time, {
            opacity: [0, 1],
            y: [5, 0],
            duration: 280,
            ease: "outBack(1.5)",
          });
      }
    });

    // Drivers that cleared pit status — fade everything out
    prevPitRef.current.forEach((_, dn) => {
      if (pitStatusMap.has(dn)) return;
      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const time = c.querySelector<HTMLElement>(`[data-pit-time="${dn}"]`);
      if (bg)
        animate(bg, {
          backgroundColor: ["rgba(34,197,94,0.2)", "rgba(0,0,0,0)"],
          duration: 700,
          ease: "inQuart",
        });
      if (time) animate(time, { opacity: [1, 0], duration: 250 });
    });

    prevPitRef.current = new Map(pitStatusMap);
  });

  // Overtake row flash: green for attacker, red for defender
  useEffect(() => {
    if (!driverLayout.current || !recentOvertakes) return;
    const c = driverLayout.current;

    // First mount — skip historical events, just calibrate the pointer
    if (prevOvertakesLenRef.current === -1) {
      prevOvertakesLenRef.current = recentOvertakes.length;
      return;
    }

    const newOvertakes = recentOvertakes.slice(prevOvertakesLenRef.current);
    prevOvertakesLenRef.current = recentOvertakes.length;
    if (newOvertakes.length === 0) return;

    newOvertakes.forEach((ev) => {
      // Attacker — green sweep
      const atkBg = c.querySelector<HTMLElement>(
        `[data-overtake-bg="${ev.overtakingDriver}"]`,
      );
      const passLabel = c.querySelector<HTMLElement>(
        `[data-pass-label="${ev.overtakingDriver}"]`,
      );
      if (atkBg) {
        animate(atkBg, {
          backgroundColor: [
            "rgba(0,0,0,0)",
            "rgba(34,197,94,0.3)",
            "rgba(0,0,0,0)",
          ],
          duration: 1600,
          ease: "inOut(2)",
        });
      }
      if (passLabel) {
        animate(passLabel, {
          opacity: [0, 1],
          y: [4, 0],
          duration: 200,
          ease: "outExpo",
        });
        animate(passLabel, {
          opacity: [1, 0],
          y: [0, -4],
          duration: 200,
          delay: 800,
          ease: "inQuart",
        });
      }

      // Defender — red sweep
      const defBg = c.querySelector<HTMLElement>(
        `[data-overtake-bg="${ev.overtakenDriver}"]`,
      );
      const lostLabel = c.querySelector<HTMLElement>(
        `[data-lost-label="${ev.overtakenDriver}"]`,
      );
      if (defBg) {
        animate(defBg, {
          backgroundColor: [
            "rgba(0,0,0,0)",
            "rgba(239,68,68,0.3)",
            "rgba(0,0,0,0)",
          ],
          duration: 1600,
          ease: "inOut(2)",
        });
      }
      if (lostLabel) {
        animate(lostLabel, {
          opacity: [0, 1],
          y: [-4, 0],
          duration: 200,
          ease: "outExpo",
        });
        animate(lostLabel, {
          opacity: [1, 0],
          y: [0, 4],
          duration: 200,
          delay: 800,
          ease: "inQuart",
        });
      }
    });
  }, [recentOvertakes]);

  // DRS strip: sweeps in when drsActive, sweeps out when not
  useEffect(() => {
    if (!driverLayout.current) return;
    const c = driverLayout.current;
    const prev = prevDrsRef.current;

    if (drsActive && !prev.active && drsDriver) {
      const strip = c.querySelector<HTMLElement>(
        `[data-drs-strip="${drsDriver}"]`,
      );
      if (strip)
        animate(strip, {
          opacity: [0, 1],
          scaleX: [0, 1],
          duration: 380,
          ease: "outExpo",
        });
    }

    if (!drsActive && prev.active) {
      const dn = prev.driver ?? drsDriver;
      if (dn) {
        const strip = c.querySelector<HTMLElement>(`[data-drs-strip="${dn}"]`);
        if (strip)
          animate(strip, {
            opacity: [1, 0],
            scaleX: [1, 0],
            duration: 300,
            ease: "inQuart",
          });
      }
    }

    // Driver switched while DRS still active
    if (drsActive && prev.active && prev.driver && prev.driver !== drsDriver) {
      const oldStrip = c.querySelector<HTMLElement>(
        `[data-drs-strip="${prev.driver}"]`,
      );
      if (oldStrip) animate(oldStrip, { opacity: [1, 0], duration: 180 });
      if (drsDriver) {
        const newStrip = c.querySelector<HTMLElement>(
          `[data-drs-strip="${drsDriver}"]`,
        );
        if (newStrip)
          animate(newStrip, {
            opacity: [0, 1],
            scaleX: [0, 1],
            duration: 380,
            ease: "outExpo",
          });
      }
    }

    prevDrsRef.current = { active: !!drsActive, driver: drsDriver };
  }, [drsActive, drsDriver]);

  // Initial stagger slide-in when rows first render
  useEffect(() => {
    if (!driverLayout.current || hasAnimated.current || positions.length === 0)
      return;
    // hasAnimated.current = true;
    const s = createScope({ root: driverLayout.current });
    s.add(() => {
      animate(".driver-row", {
        opacity: [0, 1],
        x: [-52, 0],
        delay: stagger(35),
        duration: 600,
        ease: cubicBezier(0.726, -0.988, 0, 2),
        // loop: true,
      });
    });
    return () => s.revert();
  }, [positions.length]);

  return (
    <div className="h-full flex flex-col" style={{ background: "transparent" }}>
      <div ref={driverLayout} className="flex-1 overflow-y-auto min-h-0">
        {positions.map((pos, idx) => {
          const driver = driverMap.get(pos.driver_number);
          const interval = intervalMap.get(pos.driver_number);
          const stint = stintMap.get(pos.driver_number);
          const lastLap = lapMap.get(pos.driver_number);
          const bestLap = bestLapMap.get(pos.driver_number);
          const pitCount = pitCountMap.get(pos.driver_number) ?? 0;
          const change = positionChanges[pos.driver_number];
          const isSelected = pos.driver_number === selectedDriver;
          const isLeader = idx === 0;
          const isPitting = pitStatusMap.get(pos.driver_number) === "pitting";
          const isJustOut = pitStatusMap.get(pos.driver_number) === "just_out";
          const tyre = stint
            ? (TYRE_COLORS[stint.compound] ?? TYRE_COLORS.UNKNOWN)
            : null;
          const teamColor = teamHex(driver?.team_colour);
          const tyreAge = stint
            ? maxLap - stint.lap_start + 1 + stint.tyre_age_at_start
            : null;
          const isFastestLap =
            bestLap !== undefined && bestLap > 0 && bestLap === overallBest;
          const lapDuration = lastLap?.lap_duration ?? null;
          const isBestForDriver =
            lapDuration !== null && lapDuration === bestLap;

          const pitDuration = lastPitMap.get(pos.driver_number)?.pit_duration;

          return (
            <div
              key={pos.driver_number}
              onClick={() => onSelectDriver(pos.driver_number)}
              className={`driver-row relative px-3 cursor-pointer transition-colors duration-150 ${change === "up" ? "animate-flash-up" : ""} ${change === "down" ? "animate-flash-down" : ""}`}
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                isolation: "isolate",
                background: isSelected
                  ? `linear-gradient(90deg, ${teamColor}22 0%, rgba(10,12,18,0.7) 60%)`
                  : isLeader
                    ? "linear-gradient(90deg, rgba(255,214,0,0.06) 0%, transparent 50%)"
                    : "rgba(6,8,12,0.25)",
              }}
            >
              {/* Pit colour overlay — z-index -1 sits between row bg and content */}
              <div
                data-pit-bg={pos.driver_number}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: -1, backgroundColor: "rgba(0,0,0,0)" }}
              />

              {/* "PITTING" flash — appears for ~1s then fades */}
              <div
                data-pit-label={pos.driver_number}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 10, opacity: 0 }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.3em",
                    color: "#fff",
                  }}
                >
                  PITTING
                </span>
              </div>

              {/* Pit stop time — fades in when just_out */}
              <div
                data-pit-time={pos.driver_number}
                className="absolute right-3 inset-y-0 flex items-center pointer-events-none"
                style={{ zIndex: 10, opacity: 0 }}
              >
                {pitDuration != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {pitDuration.toFixed(1)}s
                  </span>
                )}
              </div>

              {/* Overtake flash overlay — green (attacker) or red (defender) */}
              <div
                data-overtake-bg={pos.driver_number}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: -1, backgroundColor: "rgba(0,0,0,0)" }}
              />

              {/* "PASS" badge — attacker row */}
              <div
                data-pass-label={pos.driver_number}
                className="absolute right-2 inset-y-0 flex items-center pointer-events-none"
                style={{ zIndex: 10, opacity: 0 }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 9,
                    fontWeight: 900,
                    color: "#22c55e",
                    letterSpacing: "0.25em",
                  }}
                >
                  PASS
                </span>
              </div>

              {/* "LOST" badge — defender row */}
              <div
                data-lost-label={pos.driver_number}
                className="absolute right-2 inset-y-0 flex items-center pointer-events-none"
                style={{ zIndex: 10, opacity: 0 }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 9,
                    fontWeight: 900,
                    color: "#ef4444",
                    letterSpacing: "0.25em",
                  }}
                >
                  LOST
                </span>
              </div>

              {/* DRS strip — sweeps in from left at row bottom when DRS active */}
              <div
                data-drs-strip={pos.driver_number}
                className="absolute bottom-0 left-0 right-0 pointer-events-none"
                style={{
                  height: 2,
                  backgroundColor: "#22c55e",
                  boxShadow: "0 0 8px rgba(34,197,94,0.9)",
                  zIndex: 8,
                  opacity: 0,
                  transformOrigin: "left center",
                }}
              />

              {/* Left team color strip */}
              <div
                className="absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300"
                style={{
                  background: isSelected ? teamColor : "transparent",
                  boxShadow: isSelected ? `0 0 8px ${teamColor}` : "none",
                }}
              />

              {/* Position + change arrow */}
              <div className="flex items-center gap-0.5 pl-1">
                <PositionNumber pos={pos.position} change={change} />
                {change === "up" && (
                  <span
                    style={{ color: "#22c55e", fontSize: 7, lineHeight: 1 }}
                  >
                    ▲
                  </span>
                )}
                {change === "down" && (
                  <span
                    style={{ color: "#ef4444", fontSize: 7, lineHeight: 1 }}
                  >
                    ▼
                  </span>
                )}
              </div>

              {/* Tyre compound icon */}
              <div className="flex items-center justify-center">
                {tyre ? (
                  <span
                    className="flex items-center justify-center rounded-full font-black"
                    style={{
                      width: 26,
                      height: 26,
                      background: tyre.bg,
                      color: tyre.text,
                      fontFamily: "var(--font-display)",
                      fontSize: 12,
                    }}
                  >
                    {tyre.label}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      fontWeight: 800,
                      color: teamColor,
                    }}
                  >
                    {pos.driver_number}
                  </span>
                )}
              </div>

              {/* Driver name */}
              <div className="flex items-center min-w-0">
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    color: isLeader
                      ? "#ffd600"
                      : isSelected
                        ? "#fff"
                        : "#e5e7eb",
                  }}
                >
                  {driver?.name_acronym ?? "???"}
                </span>
              </div>

              {/* Tyre age [detail] — compound is already the icon */}
              <div className="driver-detail justify-end">
                {tyreAge !== null && (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      color: tyreAge > 20 ? "#f97316" : "#3d4455",
                    }}
                  >
                    {tyreAge}
                  </span>
                )}
              </div>

              {/* Gap to leader */}
              <div
                className="text-right"
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  fontWeight: isLeader ? 700 : 400,
                  color: isLeader ? "#ffd600" : "#6b7280",
                }}
              >
                {isLeader ? "LDR" : formatGap(interval?.gap_to_leader ?? null)}
              </div>

              {/* Interval [detail] */}
              <div className="driver-detail justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    color: "#4b5563",
                  }}
                >
                  {isLeader ? "—" : formatInterval(interval?.interval ?? null)}
                </span>
              </div>

              {/* Last lap [detail] */}
              <div className="driver-detail justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    fontWeight: isFastestLap || isBestForDriver ? 700 : 400,
                    color: isFastestLap
                      ? "#c084fc"
                      : isBestForDriver
                        ? "#22c55e"
                        : "#9ca3af",
                  }}
                >
                  {lastLap?.is_pit_out_lap ? (
                    <span
                      style={{
                        color: "#f97316",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 9,
                      }}
                    >
                      OUT
                    </span>
                  ) : (
                    formatLapTime(lapDuration)
                  )}
                </span>
              </div>

              {/* Pit count [detail] */}
              <div className="driver-detail justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    color: pitCount > 0 ? "#9ca3af" : "#2a2d35",
                  }}
                >
                  {pitCount || "–"}
                </span>
              </div>
            </div>
          );
        })}

        {positions.length === 0 && (
          <div className="flex items-center justify-center h-24">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                color: "#2a2d35",
                letterSpacing: "0.2em",
              }}
            >
              WAITING FOR DATA
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
