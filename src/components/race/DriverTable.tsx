import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type React from "react";
import { useCarData } from "../../hooks/useCarData";
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
  createTimeline,
  spring,
  stagger,
} from "animejs";
import type { AutoLayout } from "animejs";

interface Props {
  sessionKey: number;
  sessionDateEnd: string | null;
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
}

const TYRE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    SOFT: { bg: "#e8002d", text: "#fff", label: "S" },
    MEDIUM: { bg: "#ffd600", text: "#000", label: "M" },
    HARD: { bg: "#e8e8e8", text: "#000", label: "H" },
    INTERMEDIATE: { bg: "#39b54a", text: "#fff", label: "I" },
    WET: { bg: "#0067ff", text: "#fff", label: "W" },
    UNKNOWN: { bg: "#333", text: "#888", label: "?" },
  };

// Rough expected stint lengths per compound — used for pit prediction badges.
// These are conservative estimates; real windows vary by circuit + car.
const TYRE_LIFE_LAPS: Record<string, number> = {
  SOFT: 22,
  MEDIUM: 34,
  HARD: 48,
  INTERMEDIATE: 35,
  WET: 999,
  UNKNOWN: 30,
};

const RING_R = 11;
const RING_CIRC = 2 * Math.PI * RING_R;

type BadgeVariant =
  | "pit"
  | "out"
  | "fl"
  | "drs"
  | "pass"
  | "lost"
  | "box-soon"
  | "box-now";

const BADGE_CFG: Record<
  BadgeVariant,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    pulse?: string;
    ls?: string;
  }
> = {
  pit: {
    label: "PIT",
    color: "#ffb800",
    bg: "rgba(255,185,0,0.16)",
    border: "rgba(255,185,0,0.32)",
  },
  out: {
    label: "OUT",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.28)",
  },
  fl: {
    label: "FL",
    color: "#c084fc",
    bg: "rgba(192,132,252,0.14)",
    border: "rgba(192,132,252,0.28)",
  },
  drs: {
    label: "DRS",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.1)",
    border: "rgba(0,255,136,0.32)",
    pulse: "drs-badge-pulse 1.6s ease-in-out infinite",
  },
  pass: {
    label: "PASS",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.28)",
    ls: "0.3em",
  },
  lost: {
    label: "LOST",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.28)",
    ls: "0.3em",
  },
  "box-soon": {
    label: "SOON",
    color: "#f97316",
    bg: "rgba(249,115,22,0.14)",
    border: "rgba(249,115,22,0.3)",
  },
  "box-now": {
    label: "BOX",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.35)",
    pulse: "pit-now-pulse 1.1s ease-in-out infinite",
  },
};

function StatusBadge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children?: React.ReactNode;
}) {
  const s = BADGE_CFG[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: 8,
        fontWeight: 900,
        letterSpacing: s.ls ?? "0.12em",
        padding: "1px 5px 0",
        borderRadius: 2,
        flexShrink: 0,
        lineHeight: "14px",
        textTransform: "uppercase",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        ...(s.pulse ? { animation: s.pulse } : {}),
      }}
    >
      {children ?? s.label}
    </span>
  );
}

function TyreBadge({
  tyre,
  wearFraction,
  hasWearData,
  isPitting,
  isJustOut,
  pitSoon,
  pitNow,
}: {
  tyre: { bg: string; text: string; label: string };
  wearFraction: number; // 0 = fresh, 1 = fully worn
  hasWearData: boolean;
  isPitting: boolean;
  isJustOut: boolean;
  pitSoon: boolean;
  pitNow: boolean;
}) {
  // Remaining arc: full circle when fresh, shrinks to nothing when worn
  const dashOffset = RING_CIRC * wearFraction;

  // Ring color shifts fresh → warm → critical
  const ringColor = isPitting
    ? "#ffb800"
    : isJustOut
      ? "#22c55e"
      : pitNow
        ? "#ef4444"
        : pitSoon
          ? "#f97316"
          : wearFraction > 0.65
            ? "#eab308"
            : "#22c55e";

  const glowClass = isPitting
    ? "tyre-badge-pit-glow"
    : isJustOut
      ? "tyre-badge-out-glow"
      : "";

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      className={glowClass}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      {/* Dim full-circle track — shows total wear space */}
      <circle
        cx="14"
        cy="14"
        r={RING_R}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="2.5"
      />

      {/* Remaining life arc — depletes clockwise as tyre wears */}
      {hasWearData && (
        <circle
          cx="14"
          cy="14"
          r={RING_R}
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
          style={{
            transition: "stroke-dashoffset 2s ease, stroke 1.2s ease",
          }}
        />
      )}

      {/* Compound colour fill */}
      <circle cx="14" cy="14" r="8.5" fill={tyre.bg} />

      {/* Compound letter */}
      <text
        x="14"
        y="18"
        textAnchor="middle"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          fontWeight: 900,
          fill: tyre.text,
          userSelect: "none",
        }}
      >
        {tyre.label}
      </text>
    </svg>
  );
}

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
        fontSize: 15,
        letterSpacing: "-0.04em",
        color:
          change === "up"
            ? "#22c55e"
            : change === "down"
              ? "#ef4444"
              : pos === 1
                ? "#ffd600"
                : "#c9cdd6",
      }}
    >
      {pos}
    </span>
  );
}

export default function DriverTable({
  sessionKey,
  sessionDateEnd,
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
}: Props) {
  const driverLayout = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const layout = useRef<AutoLayout | null>(null);
  const prevPitRef = useRef(new Map<number, string>());
  const prevOvertakesLenRef = useRef(-1);
  const prevDrsRef = useRef<{
    active: boolean;
    driver: number | null | undefined;
  }>({ active: false, driver: null });
  const pendingPosTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowPositionsRef = useRef<Map<number, number>>(new Map());
  const prevFastestLapRef = useRef<number | null>(null);

  const [displayPositions, setDisplayPositions] =
    useState<Position[]>(positions);

  // DRS — owned here, not threaded from Race.tsx
  const { latest: carLatest } = useCarData(sessionKey, selectedDriver, sessionDateEnd);
  const drsActive = (carLatest?.drs ?? 0) >= 10;
  const drsDriver = selectedDriver;

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

  const lastPitMap = new Map<number, Pit>();
  pits.forEach((p) => {
    if (p.pit_duration === null) return;
    const cur = lastPitMap.get(p.driver_number);
    if (!cur || p.lap_number > cur.lap_number)
      lastPitMap.set(p.driver_number, p);
  });

  const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number), 0);

  const pitStatusMap = new Map<number, "pitting" | "just_out">();

  lapMap.forEach((lap, dn) => {
    if (lap.is_pit_out_lap && lap.lap_number >= maxLap - 1)
      pitStatusMap.set(dn, "just_out");
  });

  pits.forEach((p) => {
    if (p.lap_number < maxLap - 1) return;
    if (pitStatusMap.get(p.driver_number) === "just_out") return;
    if (p.pit_duration === null) {
      pitStatusMap.set(p.driver_number, "pitting");
    } else {
      const latestLap = lapMap.get(p.driver_number);
      if (!latestLap?.is_pit_out_lap)
        pitStatusMap.set(p.driver_number, "pitting");
    }
  });

  // Rail animation + delayed row reorder
  useEffect(() => {
    if (pendingPosTimer.current) clearTimeout(pendingPosTimer.current);
    const entries = Object.entries(positionChanges) as [
      string,
      "up" | "down",
    ][];

    if (entries.length > 0) {
      const c = driverLayout.current;
      if (c) {
        entries.forEach(([dnStr]) => {
          const rail = c.querySelector<HTMLElement>(
            `[data-team-rail="${dnStr}"]`,
          );
          if (!rail) return;

          const W = 40;
          const tl = createTimeline();
          tl.add(
            rail,
            {
              width: [2, W],
              duration: 200,
              ease: spring({
                stiffness: 208.1,
                damping: 17.2,
                mass: 2.3,
                velocity: 14.2,
              }),
            },
            0,
          );
          tl.add(
            rail,
            {
              width: [W, 2],
              duration: 480,
              ease: spring({
                stiffness: 208.1,
                damping: 17.2,
                mass: 2.3,
                velocity: 14.2,
              }),
            },
            1500,
          );
        });
      }
      // Snapshot row Y positions before reorder so FLIP can animate
      pendingPosTimer.current = setTimeout(() => {
        if (driverLayout.current) {
          const snap = new Map<number, number>();
          driverLayout.current
            .querySelectorAll<HTMLElement>("[data-driver-row]")
            .forEach((row) => {
              const dn = row.getAttribute("data-driver-row");
              if (dn) snap.set(Number(dn), row.getBoundingClientRect().top);
            });
          rowPositionsRef.current = snap;
        }
        setDisplayPositions(positions);
      }, 400);
    } else {
      setDisplayPositions(positions);
    }
    return () => {
      if (pendingPosTimer.current) clearTimeout(pendingPosTimer.current);
    };
  }, [positions, positionChanges]);

  // FLIP — animate rows from their old Y to new Y after displayPositions reorder
  useLayoutEffect(() => {
    if (!driverLayout.current || rowPositionsRef.current.size === 0) return;
    const c = driverLayout.current;
    c.querySelectorAll<HTMLElement>("[data-driver-row]").forEach((row) => {
      const dn = Number(row.getAttribute("data-driver-row"));
      const prevTop = rowPositionsRef.current.get(dn);
      if (prevTop === undefined) return;
      const delta = prevTop - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      animate(row, {
        translateY: [delta, 0],
        duration: 480,
        ease: spring({ stiffness: 300, damping: 26, mass: 1 }),
      });
    });
    rowPositionsRef.current = new Map();
  }, [displayPositions]);

  // AnimeJS layout + ResizeObserver for compact/expanded breakpoint
  useEffect(() => {
    if (!driverLayout.current) return;
    layout.current = createLayout(driverLayout.current, {
      children: ".driver-detail",
      enterFrom: { opacity: 0, x: -10 },
      leaveTo: { opacity: 0, x: -10 },
      duration: 380,
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

  // Pit animation via createTimeline — chains bg flash + label pulse
  // FIX: initial opacity/bg are in CSS (.pit-overlay, .pit-label, etc.)
  // so React's style prop never overrides what AnimeJS sets
  useEffect(() => {
    if (!driverLayout.current) return;
    const c = driverLayout.current;

    pitStatusMap.forEach((status, dn) => {
      if (prevPitRef.current.get(dn) === status) return;

      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const label = c.querySelector<HTMLElement>(`[data-pit-label="${dn}"]`);
      const gapText = c.querySelector<HTMLElement>(`[data-gap-text="${dn}"]`);
      const pitInline = c.querySelector<HTMLElement>(
        `[data-pit-inline="${dn}"]`,
      );

      if (status === "pitting") {
        const tl = createTimeline({ defaults: { ease: "outQuart" } });
        if (bg)
          tl.add(
            bg,
            {
              backgroundColor: ["rgba(255,185,0,0)", "rgba(255,185,0,0.30)"],
              duration: 550,
            },
            0,
          );
        if (label) {
          tl.add(
            label,
            {
              opacity: [0, 1],
              y: [14, 0],
              scale: [0.85, 1],
              duration: 280,
              ease: "outBack(2.5)",
            },
            200,
          );
          tl.add(
            label,
            { opacity: [1, 0], y: [0, -8], duration: 380, ease: "inQuart" },
            2000,
          );
        }
        // ensure pit-inline hidden while in pit
        if (pitInline) tl.add(pitInline, { opacity: 0, duration: 120 }, 0);
      } else if (status === "just_out") {
        const tl = createTimeline({ defaults: { ease: "outCubic" } });
        if (bg)
          tl.add(
            bg,
            {
              backgroundColor: ["rgba(255,185,0,0.30)", "rgba(34,197,94,0.20)"],
              duration: 750,
            },
            0,
          );
        if (label) tl.add(label, { opacity: [1, 0], duration: 150 }, 0);

        // Crossfade gap → pit duration, auto-revert after 5s
        if (gapText) tl.add(gapText, { opacity: [1, 0], duration: 200 }, 0);
        if (pitInline) {
          tl.add(
            pitInline,
            { opacity: [0, 1], y: [6, 0], duration: 400, ease: "outBack(1.5)" },
            200,
          );
          tl.add(
            pitInline,
            { opacity: [1, 0], duration: 280, ease: "inQuad" },
            5000,
          );
        }
        if (gapText)
          tl.add(
            gapText,
            { opacity: [0, 1], duration: 350, ease: "outQuad" },
            5180,
          );
      }
    });

    // Drivers leaving pit status — restore gap text, clear pit inline
    prevPitRef.current.forEach((_, dn) => {
      if (pitStatusMap.has(dn)) return;
      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const gapText = c.querySelector<HTMLElement>(`[data-gap-text="${dn}"]`);
      const pitInline = c.querySelector<HTMLElement>(
        `[data-pit-inline="${dn}"]`,
      );
      if (bg)
        animate(bg, {
          backgroundColor: ["rgba(34,197,94,0.20)", "rgba(0,0,0,0)"],
          duration: 800,
          ease: "inQuart",
        });
      if (gapText) animate(gapText, { opacity: 1, duration: 200 });
      if (pitInline) animate(pitInline, { opacity: 0, duration: 200 });
    });

    prevPitRef.current = new Map(pitStatusMap);
  });

  // Overtake flash — createTimeline for attacker + defender
  useEffect(() => {
    if (!driverLayout.current || !recentOvertakes) return;
    const c = driverLayout.current;

    if (prevOvertakesLenRef.current === -1) {
      prevOvertakesLenRef.current = recentOvertakes.length;
      return;
    }

    const newOvertakes = recentOvertakes.slice(prevOvertakesLenRef.current);
    prevOvertakesLenRef.current = recentOvertakes.length;
    if (newOvertakes.length === 0) return;

    newOvertakes.forEach((ev) => {
      const atkBg = c.querySelector<HTMLElement>(
        `[data-overtake-bg="${ev.overtakingDriver}"]`,
      );
      const passLabel = c.querySelector<HTMLElement>(
        `[data-pass-label="${ev.overtakingDriver}"]`,
      );
      if (atkBg) {
        const tl = createTimeline();
        tl.add(
          atkBg,
          {
            backgroundColor: ["rgba(0,0,0,0)", "rgba(34,197,94,0.26)"],
            duration: 300,
            ease: "outQuart",
          },
          0,
        );
        tl.add(
          atkBg,
          {
            backgroundColor: ["rgba(34,197,94,0.26)", "rgba(0,0,0,0)"],
            duration: 1100,
            ease: "inCubic",
          },
          900,
        );
      }
      if (passLabel) {
        animate(passLabel, {
          opacity: [0, 1],
          x: [-14, 0],
          duration: 220,
          ease: "outBack(2)",
        });
        animate(passLabel, {
          opacity: [1, 0],
          x: [0, 8],
          duration: 260,
          delay: 950,
          ease: "inQuart",
        });
      }

      const defBg = c.querySelector<HTMLElement>(
        `[data-overtake-bg="${ev.overtakenDriver}"]`,
      );
      const lostLabel = c.querySelector<HTMLElement>(
        `[data-lost-label="${ev.overtakenDriver}"]`,
      );
      if (defBg) {
        const tl = createTimeline();
        tl.add(
          defBg,
          {
            backgroundColor: ["rgba(0,0,0,0)", "rgba(239,68,68,0.26)"],
            duration: 300,
            ease: "outQuart",
          },
          0,
        );
        tl.add(
          defBg,
          {
            backgroundColor: ["rgba(239,68,68,0.26)", "rgba(0,0,0,0)"],
            duration: 1100,
            ease: "inCubic",
          },
          900,
        );
      }
      if (lostLabel) {
        animate(lostLabel, {
          opacity: [0, 1],
          x: [14, 0],
          duration: 220,
          ease: "outBack(2)",
        });
        animate(lostLabel, {
          opacity: [1, 0],
          x: [0, -8],
          duration: 260,
          delay: 950,
          ease: "inQuart",
        });
      }

      // Rail burst — both rows clash simultaneously
      const atkRail = c.querySelector<HTMLElement>(
        `[data-team-rail="${ev.overtakingDriver}"]`,
      );
      if (atkRail) {
        const tl = createTimeline();
        tl.add(atkRail, { width: [2, 28], duration: 140, ease: "outExpo" }, 0);
        tl.add(
          atkRail,
          { width: [28, 2], duration: 700, ease: "outCubic" },
          380,
        );
      }
      const defRail = c.querySelector<HTMLElement>(
        `[data-team-rail="${ev.overtakenDriver}"]`,
      );
      if (defRail) {
        const tl = createTimeline();
        tl.add(defRail, { width: [2, 28], duration: 140, ease: "outExpo" }, 0);
        tl.add(
          defRail,
          { width: [28, 2], duration: 700, ease: "outCubic" },
          380,
        );
      }
    });
  }, [recentOvertakes]);

  // DRS strip + rail — sweep in/out with CSS pulse while active
  useEffect(() => {
    if (!driverLayout.current) return;
    const c = driverLayout.current;
    const prev = prevDrsRef.current;

    const revealDrs = (dn: number) => {
      const strip = c.querySelector<HTMLElement>(`[data-drs-strip="${dn}"]`);
      const rail = c.querySelector<HTMLElement>(`[data-rail-drs="${dn}"]`);
      if (strip) {
        strip.classList.remove("drs-strip-active");
        animate(strip, {
          opacity: [0, 1],
          scaleX: [0, 1],
          duration: 450,
          ease: "outExpo",
          onComplete: () => strip.classList.add("drs-strip-active"),
        });
      }
      if (rail) {
        rail.classList.remove("rail-drs-active");
        animate(rail, {
          opacity: [0, 1],
          scaleY: [0, 1],
          duration: 400,
          ease: "outExpo",
          onComplete: () => rail.classList.add("rail-drs-active"),
        });
      }
    };
    const hideDrs = (dn: number) => {
      const strip = c.querySelector<HTMLElement>(`[data-drs-strip="${dn}"]`);
      const rail = c.querySelector<HTMLElement>(`[data-rail-drs="${dn}"]`);
      if (strip) {
        strip.classList.remove("drs-strip-active");
        animate(strip, {
          opacity: [1, 0],
          scaleX: [1, 0],
          duration: 320,
          ease: "inQuart",
        });
      }
      if (rail) {
        rail.classList.remove("rail-drs-active");
        animate(rail, {
          opacity: [1, 0],
          scaleY: [1, 0],
          duration: 320,
          ease: "inQuart",
        });
      }
    };

    if (drsActive && !prev.active && drsDriver) revealDrs(drsDriver);
    if (!drsActive && prev.active) hideDrs(prev.driver ?? drsDriver ?? 0);
    if (drsActive && prev.active && prev.driver && prev.driver !== drsDriver) {
      hideDrs(prev.driver);
      if (drsDriver) revealDrs(drsDriver);
    }

    prevDrsRef.current = { active: !!drsActive, driver: drsDriver };
  }, [drsActive, drsDriver]);

  // Fastest lap — purple rail flash when overallBest improves
  useEffect(() => {
    if (!driverLayout.current || !isFinite(overallBest) || overallBest <= 0)
      return;
    let dn: number | null = null;
    bestLapMap.forEach((time, driver) => {
      if (time === overallBest) dn = driver;
    });
    if (dn === null || dn === prevFastestLapRef.current) return;
    prevFastestLapRef.current = dn;
    const c = driverLayout.current;
    const rail = c.querySelector<HTMLElement>(`[data-team-rail="${dn}"]`);
    const flIcon = c.querySelector<HTMLElement>(`[data-rail-fl="${dn}"]`);
    if (!rail) return;
    const tl = createTimeline();
    tl.add(rail, { width: [2, 22], duration: 220, ease: "outExpo" }, 0);
    if (flIcon)
      tl.add(flIcon, { opacity: [0, 1], duration: 160, ease: "outQuad" }, 80);
    if (flIcon)
      tl.add(flIcon, { opacity: [1, 0], duration: 200, ease: "inQuad" }, 2800);
    tl.add(rail, { width: [22, 2], duration: 500, ease: "inCubic" }, 3000);
  }, [overallBest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial stagger slide-in with spring physics
  useEffect(() => {
    if (!driverLayout.current || hasAnimated.current || positions.length === 0)
      return;
    hasAnimated.current = true;
    const s = createScope({ root: driverLayout.current });
    s.add(() => {
      animate(".driver-row:not(.driver-header-row)", {
        opacity: [0, 1],
        x: [-48, 0],
        delay: stagger(40, { ease: "outQuart" }),
        duration: 520,
        ease: spring({ stiffness: 200, damping: 18, mass: 2.2, velocity: 12 }),
      });
    });
    return () => s.revert();
  }, []);

  return (
    <div className="h-full flex flex-col" style={{ background: "transparent" }}>
      <div ref={driverLayout} className="flex-1 overflow-y-auto min-h-0">
        <div
          className="driver-row driver-header-row"
          style={{ padding: "4px 10px 4px 14px" }}
        >
          <div />
          <div />
          <div className="driver-col-label">DRIVER</div>
          <div className="driver-col-label" style={{ textAlign: "right" }}>
            GAP
          </div>
          <div className="driver-detail driver-col-label justify-end">INT</div>
          <div className="driver-detail driver-col-label justify-end">LAP</div>
          <div className="driver-detail driver-col-label justify-end">AGE</div>
          <div className="driver-detail driver-col-label justify-end">PIT</div>
        </div>
        {displayPositions.map((pos, idx) => {
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
          const hasDrs = drsDriver === pos.driver_number && drsActive;

          // Pit prediction — compare tyre age against expected compound life.
          // >80% = PIT SOON (orange), >100% = PIT NOW (red pulsing).
          const compound = stint?.compound ?? "UNKNOWN";
          const expectedLife = TYRE_LIFE_LAPS[compound] ?? 30;
          const tyreWear =
            tyreAge !== null && !isPitting && !isJustOut
              ? tyreAge / expectedLife
              : 0;
          const pitSoon = tyreWear > 0.8 && tyreWear <= 1.0;
          const pitNow = tyreWear > 1.0;

          // Up to 2 badges: one status/prediction + one secondary (DRS or FL)
          const activeBadges: BadgeVariant[] = [];
          if (isPitting) activeBadges.push("pit");
          else if (isJustOut) activeBadges.push("out");
          else if (pitNow) activeBadges.push("box-now");
          else if (pitSoon) activeBadges.push("box-soon");
          if (hasDrs && activeBadges.length < 2) activeBadges.push("drs");
          if (isFastestLap && activeBadges.length < 2) activeBadges.push("fl");

          return (
            <div
              key={pos.driver_number}
              data-driver-row={pos.driver_number}
              onClick={() => onSelectDriver(pos.driver_number)}
              className={`driver-row relative cursor-pointer ${
                change === "up" ? "animate-flash-up" : ""
              } ${change === "down" ? "animate-flash-down" : ""}`}
              style={{
                padding: "5px 10px 5px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.055)",
                isolation: "isolate",
                background: isSelected
                  ? `linear-gradient(90deg, ${teamColor}20 0%, rgba(8,10,16,0.85) 60%)`
                  : isLeader
                    ? "linear-gradient(90deg, rgba(255,214,0,0.055) 0%, transparent 55%)"
                    : idx % 2 === 0
                      ? "rgba(255,255,255,0.012)"
                      : "transparent",
              }}
            >
              {/* ── Animated overlays ──────────────────────────────────────
                  Initial state set via CSS classes (.pit-overlay, etc.)
                  so React's style prop never fights AnimeJS mutations. */}

              <div
                data-pit-bg={pos.driver_number}
                className="pit-overlay absolute inset-0 pointer-events-none"
                style={{ zIndex: -1 }}
              />
              <div
                data-overtake-bg={pos.driver_number}
                className="overtake-overlay absolute inset-0 pointer-events-none"
                style={{ zIndex: -1 }}
              />

              {/* Tyre wear strip — top of row, width = wear %, colour shifts red near window */}
              {tyreAge !== null && (
                <div
                  className="absolute bottom-0 left-0 right-0 pointer-events-none h-full"
                  style={{ zIndex: -1 }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(tyreWear * 100, 100)}%`,
                      background: pitNow
                        ? "rgba(247, 33, 17, 0.5)"
                        : pitSoon
                          ? "linear-gradient(90deg, rgba(247, 75, 17, 0.2), rgba(247, 33, 17, 0.3)"
                          : tyreWear > 0.6
                            ? "linear-gradient(90deg,rgba(247, 152, 17, 0.2),rgba(245, 111, 22, 0.3)"
                            : "rgba(255,255,255,0.1)",
                      transition: "width 2s ease, background 1.2s ease",
                    }}
                  />
                </div>
              )}

              {/* "PIT STOP" flash — big + dramatic, animated by createTimeline */}
              <div
                data-pit-label={pos.driver_number}
                className="pit-label absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: "0.5em",
                      color: "#ffb800",
                      textShadow:
                        "0 0 30px rgba(255,185,0,1), 0 0 60px rgba(255,185,0,0.5)",
                      textTransform: "uppercase",
                    }}
                  >
                    PIT STOP
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: "0.35em",
                      color: "rgba(255,185,0,0.65)",
                      textTransform: "uppercase",
                    }}
                  >
                    IN LANE
                  </span>
                </div>
              </div>

              {/* Pit stop time badge — animated in on just_out */}
              {/* <div */}
              {/*   data-pit-time={pos.driver_number} */}
              {/*   className="pit-time absolute right-3 inset-y-0 flex items-center pointer-events-none" */}
              {/*   style={{ zIndex: 10 }} */}
              {/* > */}
              {/*   {pitDuration != null && ( */}
              {/*     <span */}
              {/*       style={{ */}
              {/*         fontFamily: "var(--font-data)", */}
              {/*         fontSize: 12, */}
              {/*         fontWeight: 700, */}
              {/*         color: "#22c55e", */}
              {/*         letterSpacing: "-0.03em", */}
              {/*         textShadow: "0 0 10px rgba(34,197,94,0.6)", */}
              {/*       }} */}
              {/*     > */}
              {/*       {pitDuration.toFixed(1)}s */}
              {/*     </span> */}
              {/*   )} */}
              {/* </div> */}

              {/* PASS badge — attacker */}
              <div
                data-pass-label={pos.driver_number}
                className="pass-label absolute right-2 inset-y-0 flex items-center pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <StatusBadge variant="pass">PASS</StatusBadge>
              </div>

              {/* LOST badge — defender */}
              <div
                data-lost-label={pos.driver_number}
                className="lost-label absolute right-2 inset-y-0 flex items-center pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <StatusBadge variant="lost">LOST</StatusBadge>
              </div>

              {/* DRS strip — sweep-animated, CSS-pulsed when active */}
              <div
                data-drs-strip={pos.driver_number}
                className="drs-strip absolute bottom-0 left-4 right-0 pointer-events-none"
                style={{
                  height: 2,
                  background:
                    "linear-gradient(90deg, rgba(0,255,136,0.4) 0%, #00ff88 35%, rgba(0,255,136,0.5) 100%)",
                  zIndex: 8,
                }}
              />

              {/* Left team color rail — momentary event notifier, AnimeJS owns width */}
              <div
                data-team-rail={pos.driver_number}
                data-team-color={teamColor}
                className="absolute left-0 top-0 bottom-0 w-[2px] overflow-hidden"
                style={{ background: teamColor }}
              >
                {/* dark overlay for contrast — makes icons readable on any team color */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "rgba(0,0,0,0.4)" }}
                />
                {/* DRS sweep — AnimeJS animates opacity/scaleY, CSS owns base state */}
                <div
                  data-rail-drs={pos.driver_number}
                  className="rail-drs absolute inset-0 pointer-events-none"
                />
                {/* pit in lane */}
                <div
                  data-rail-pit={pos.driver_number}
                  className="rail-arrow absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#ffb800",
                      textShadow:
                        "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(255,184,0,0.8)",
                    }}
                  >
                    P
                  </span>
                </div>
                {/* pit exit */}
                <div
                  data-rail-out={pos.driver_number}
                  className="rail-arrow absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#22c55e",
                      textShadow:
                        "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(34,197,94,0.8)",
                    }}
                  >
                    ↑
                  </span>
                </div>
                {/* fastest lap star */}
                <div
                  data-rail-fl={pos.driver_number}
                  className="rail-arrow absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#c084fc",
                      textShadow:
                        "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(192,132,252,0.9)",
                    }}
                  >
                    ★
                  </span>
                </div>
              </div>

              {/* Position number */}
              <div className="flex items-center pl-1.5 z-10 gap-1">
                <PositionNumber pos={pos.position} change={change} />
                {change && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: change === "up" ? "#22c55e" : "#ef4444",
                      textShadow: `0 1px 2px rgba(0,0,0,0.8), 0 0 8px ${change === "up" ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)"}`,
                    }}
                  >
                    {change === "up" ? "▲" : "▼"}
                  </span>
                )}
              </div>

              {/* Tyre compound badge — SVG ring shows remaining tyre life */}
              <div className="flex items-center justify-center">
                {tyre ? (
                  <TyreBadge
                    tyre={tyre}
                    wearFraction={Math.min(tyreWear, 1)}
                    hasWearData={tyreAge !== null}
                    isPitting={isPitting}
                    isJustOut={isJustOut}
                    pitSoon={pitSoon}
                    pitNow={pitNow}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: teamColor,
                    }}
                  >
                    {pos.driver_number}
                  </span>
                )}
              </div>

              {/* Driver name + single highest-priority badge */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span
                  className="truncate min-w-0"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.025em",
                    color: isLeader
                      ? "#ffd600"
                      : isSelected
                        ? "#ffffff"
                        : "#d1d5db",
                  }}
                >
                  {driver?.name_acronym ?? "???"}
                </span>
                {activeBadges.map((v) => (
                  <StatusBadge key={v} variant={v} />
                ))}
              </div>

              {/* Gap to leader — dual display: gap normally, pit duration briefly on exit */}
              <div className="text-right" style={{ position: "relative" }}>
                <span
                  data-gap-text={pos.driver_number}
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    fontWeight: isLeader ? 700 : 400,
                    letterSpacing: "-0.03em",
                    color: isLeader ? "#ffd600" : "#4b5563",
                    display: "block",
                  }}
                >
                  {isLeader
                    ? "LEAD"
                    : formatGap(interval?.gap_to_leader ?? null)}
                </span>
                {pitDuration != null && !isLeader && (
                  <span
                    data-pit-inline={pos.driver_number}
                    className="pit-inline"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {pitDuration.toFixed(1)}s
                  </span>
                )}
              </div>

              {/* Interval [expanded] */}
              <div className="driver-detail justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    color: "#6b7280",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {isLeader ? "—" : formatInterval(interval?.interval ?? null)}
                </span>
              </div>

              {/* Last lap [expanded] */}
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
                        : "#6b7280",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {lastLap?.is_pit_out_lap ? (
                    <span
                      style={{
                        color: "#f97316",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                      }}
                    >
                      OUT
                    </span>
                  ) : (
                    formatLapTime(lapDuration)
                  )}
                </span>
              </div>

              {/* Tyre age [expanded] */}
              <div className="driver-detail justify-end">
                {tyreAge !== null && (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      color:
                        tyreAge > 28
                          ? "#f97316"
                          : tyreAge > 16
                            ? "#eab308"
                            : "#6b7280",
                    }}
                  >
                    {tyreAge}
                  </span>
                )}
              </div>

              {/* Pit duration [expanded] — always shows last stop time once available */}
              <div className="driver-detail justify-end">
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    letterSpacing: "-0.02em",
                    color: isJustOut ? "#22c55e" : "#6b7280",
                  }}
                >
                  {pitDuration != null ? `${pitDuration.toFixed(1)}s` : "—"}
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
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              Waiting for data
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
