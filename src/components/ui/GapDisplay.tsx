// ── GapDisplay: animated slot-machine number + proximity glow ─────────────

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import AnimatedValue from "./AnimatedValue";

// gap = gap_to_leader (null during live races); intervalGap = gap to car ahead (fallback)
export function GapDisplay({
  gap,
  intervalGap,
  isLeader,
}: {
  gap: number | null;
  intervalGap: number | null;
  isLeader: boolean;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const prevGapRef = useRef<number | null>(null);
  const hasInitRef = useRef(false);

  // Prefer gap_to_leader; fall back to interval (car ahead) for live races
  const displayGap = gap ?? intervalGap;
  const isIntervalFallback = gap === null && intervalGap !== null;

  const color = isLeader
    ? "#ffd600"
    : displayGap === null
      ? "#4b5563"
      : displayGap <= 0.5
        ? "#4ade80"
        : displayGap <= 1.0
          ? "#22c55e"
          : displayGap <= 2.0
            ? "#eab308"
            : "#4b5563";

  useEffect(() => {
    if (!hasInitRef.current) {
      hasInitRef.current = true;
      prevGapRef.current = displayGap;
      return;
    }
    if (displayGap === null || isLeader || displayGap === prevGapRef.current)
      return;
    prevGapRef.current = displayGap;
    if (!wrapRef.current || displayGap > 2) return;

    const glowColor =
      displayGap <= 0.5
        ? "rgba(74,222,128,"
        : displayGap <= 1.0
          ? "rgba(34,197,94,"
          : "rgba(234,179,8,";

    animate(wrapRef.current, {
      filter: [
        `drop-shadow(0 0 0px ${glowColor}0))`,
        `drop-shadow(0 0 14px ${glowColor}0.95))`,
        `drop-shadow(0 0 5px ${glowColor}0.4))`,
        `drop-shadow(0 0 0px ${glowColor}0))`,
      ],
      duration: 950,
      ease: "outCubic",
    });
  }, [displayGap, isLeader]);

  if (isLeader) {
    return (
      <AnimatedValue
        value="LEAD"
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#ffd600",
        }}
      />
    );
  }

  if (displayGap === null) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "-0.03em",
          color: "#4b5563",
        }}
      >
        —
      </span>
    );
  }

  const cleanGap = parseFloat(displayGap.toFixed(3));
  const isClose = displayGap <= 2;

  return (
    <span
      ref={wrapRef}
      style={{ display: "inline-flex", alignItems: "baseline" }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          color,
          opacity: isIntervalFallback ? 0.4 : 0.6,
        }}
      >
        +
      </span>
      <AnimatedValue
        value={cleanGap}
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          fontWeight: isClose ? 600 : 400,
          letterSpacing: "-0.03em",
          color,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          color,
          opacity: 0.55,
          marginLeft: 1,
        }}
      >
        s
      </span>
    </span>
  );
}
