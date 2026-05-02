import { useEffect, useRef, useState, type CSSProperties } from "react";
import { animate, spring } from "animejs";

interface Props {
  value: string | number;
  fallback?: string;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

function isNumericValue(v: string | number): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  const s = String(v).trim();
  return s !== "" && Number.isFinite(Number(s)) && !s.includes(" ");
}

// ─── Numeric: directional slot-machine slide + spring bounce + glow ──────────
function NumericValue({
  value,
  fallback,
  style,
  className,
}: {
  value: number;
  fallback: string;
  style?: CSSProperties;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);
  const exitAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    const old = prevRef.current;
    if (old === value) return;
    prevRef.current = value;

    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) {
      setDisplay(value);
      return;
    }

    exitAnimRef.current?.pause();

    const goUp = value > old;

    // Phase 1 — exit fast, directional
    exitAnimRef.current = animate(inner, {
      translateY: [0, goUp ? "-130%" : "130%"],
      opacity: [1, 0],
      filter: ["blur(0px)", "blur(4px)"],
      duration: 90,
      ease: "inQuart",
      onComplete: () => {
        setDisplay(value);
        // Phase 2 — enter from opposite side, spring + glow
        requestAnimationFrame(() => {
          animate(inner, {
            translateY: [goUp ? "130%" : "-130%", "0%"],
            opacity: [0, 1],
            filter: ["blur(4px)", "blur(0px)"],
            duration: 600,
            ease: spring({ stiffness: 260, damping: 18, mass: 0.9 }),
          });

          // Outer: scale pop + drop-shadow glow
          animate(outer, {
            scale: [1, 1.2, 0.95, 1.02, 1],
            duration: 560,
            ease: "outElastic(1, 0.65)",
          });

          animate(outer, {
            filter: [
              "drop-shadow(0 0 0px rgba(255,255,255,0))",
              "drop-shadow(0 0 14px rgba(255,255,255,0.85))",
              "drop-shadow(0 0 4px rgba(255,255,255,0.3))",
              "drop-shadow(0 0 0px rgba(255,255,255,0))",
            ],
            duration: 650,
            ease: "outExpo",
          });
        });
      },
    });
  }, [value]);

  return (
    <span
      ref={outerRef}
      className={className}
      style={{
        display: "inline-block",
        willChange: "transform, filter",
        ...style,
      }}
    >
      {/* Clip wrapper — contains the flying digit but doesn't scale with it */}
      <span style={{ display: "inline-block", overflow: "hidden" }}>
        <span
          ref={innerRef}
          style={{ display: "inline-block", willChange: "transform, opacity, filter" }}
        >
          {display !== 0 ? display || fallback : 0}
        </span>
      </span>
    </span>
  );
}

// ─── Text: blur cross-fade with subtle vertical drift ────────────────────────
function TextValue({
  value,
  fallback,
  style,
  className,
  duration,
}: {
  value: string;
  fallback: string;
  style?: CSSProperties;
  className?: string;
  duration: number;
}) {
  const [display, setDisplay] = useState(value || fallback);
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value || fallback);

  useEffect(() => {
    const next = value || fallback;
    if (prevRef.current === next) return;
    prevRef.current = next;

    const el = ref.current;
    if (!el) {
      setDisplay(next);
      return;
    }

    // Out
    animate(el, {
      translateY: [0, -5],
      opacity: [1, 0],
      filter: ["blur(0px)", "blur(7px)"],
      duration: Math.round(duration * 0.65),
      ease: "outQuad",
      onComplete: () => {
        setDisplay(next);
        requestAnimationFrame(() => {
          // In
          animate(el, {
            translateY: [5, 0],
            opacity: [0, 1],
            filter: ["blur(7px)", "blur(0px)"],
            duration: Math.round(duration * 1.8),
            ease: "outExpo",
          });
        });
      },
    });
  }, [value, fallback, duration]);

  return (
    <span
      ref={ref}
      className={className}
      style={{
        display: "inline-block",
        willChange: "transform, opacity, filter",
        ...style,
      }}
    >
      {display}
    </span>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────
export default function AnimatedValue({
  value,
  fallback = "-",
  duration = 120,
  className,
  style,
}: Props) {
  if (isNumericValue(value)) {
    return (
      <NumericValue
        value={Number(value)}
        fallback={fallback}
        className={className}
        style={style}
      />
    );
  }

  return (
    <TextValue
      value={String(value)}
      fallback={fallback}
      className={className}
      style={style}
      duration={duration}
    />
  );
}
