import { RING_R, RING_CIRC } from "./constants";

export function TyreBadge({
  tyre,
  wearFraction,
  hasWearData,
  isPitting,
  isJustOut,
  pitSoon,
  pitNow,
}: {
  tyre: { bg: string; text: string; label: string };
  wearFraction: number;
  hasWearData: boolean;
  isPitting: boolean;
  isJustOut: boolean;
  pitSoon: boolean;
  pitNow: boolean;
}) {
  const dashOffset = RING_CIRC * wearFraction;

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
      <circle
        cx="14"
        cy="14"
        r={RING_R}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="2.5"
      />
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
          style={{ transition: "stroke-dashoffset 2s ease, stroke 1.2s ease" }}
        />
      )}
      <circle cx="14" cy="14" r="8.5" fill={tyre.bg} />
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
