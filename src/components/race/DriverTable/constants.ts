export const TYRE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SOFT: { bg: "#e8002d", text: "#fff", label: "S" },
  MEDIUM: { bg: "#ffd600", text: "#000", label: "M" },
  HARD: { bg: "#e8e8e8", text: "#000", label: "H" },
  INTERMEDIATE: { bg: "#39b54a", text: "#fff", label: "I" },
  WET: { bg: "#0067ff", text: "#fff", label: "W" },
  UNKNOWN: { bg: "#333", text: "#888", label: "?" },
};

// Conservative per-compound stint windows — used for pit-window prediction badges.
export const TYRE_LIFE_LAPS: Record<string, number> = {
  SOFT: 22,
  MEDIUM: 34,
  HARD: 48,
  INTERMEDIATE: 35,
  WET: 999,
  UNKNOWN: 30,
};

export const RING_R = 11;
export const RING_CIRC = 2 * Math.PI * RING_R;

export type BadgeVariant =
  | "pit"
  | "out"
  | "fl"
  | "drs"
  | "pass"
  | "lost"
  | "box-soon"
  | "box-now";

export const BADGE_CFG: Record<
  BadgeVariant,
  { label: string; color: string; bg: string; border: string; pulse?: string; ls?: string }
> = {
  pit: {
    label: "PIT",
    color: "#ffb800",
    bg: "rgba(255,185,0,0.16)",
    border: "rgba(255,185,0,0.32)",
  },
  out: {
    label: "EXIT PIT",
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
    label: "BOX SOON",
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
