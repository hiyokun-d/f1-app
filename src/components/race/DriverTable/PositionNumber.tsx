import { useRef } from "react";

export function PositionNumber({
  pos,
  change,
}: {
  pos: number;
  change: "up" | "down" | undefined;
}) {
  // Key on `change` transitions, not every pos update — pos changes every replay
  // tick and would restart the CSS animation constantly otherwise.
  const prevChangeRef = useRef<typeof change>(undefined);
  const animKey = useRef(0);
  if (prevChangeRef.current !== change && change !== undefined) {
    animKey.current++;
  }
  prevChangeRef.current = change;

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
