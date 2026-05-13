import type React from "react";
import { BADGE_CFG, type BadgeVariant } from "./constants";

export function StatusBadge({
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
