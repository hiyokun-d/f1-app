import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const TITLE_LETTERS = ["R", "A", "C", "E", " ", "C", "E", "N", "T", "E", "R"];

const SESSION = {
  key: 9141,
  name: "Belgium Grand Prix",
  subtitle: "Sprint Race · Spa-Francorchamps",
  date: "29 JUL 2023",
  laps: 15,
  country: "BEL",
};

function StartingLights({
  phase,
  litCount,
}: {
  phase: string;
  litCount: number;
}) {
  return (
    <div className="flex items-center gap-3 justify-center">
      {[1, 2, 3, 4, 5].map((i) => {
        const isLit = phase === "lighting" && i <= litCount;
        const isGone = phase === "go";
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            {/* Light housing */}
            <div
              className="w-10 h-10 rounded-full border border-[#2a2a2a] relative overflow-hidden"
              style={{
                background: isGone ? "#0d0008" : isLit ? "#e8002d" : "#1a0008",
                boxShadow: isGone
                  ? "0 0 4px rgba(232,0,45,0.05)"
                  : isLit
                    ? "0 0 24px rgba(232,0,45,0.9), 0 0 48px rgba(232,0,45,0.5)"
                    : "0 0 4px rgba(232,0,45,0.05)",
                transition: isGone ? "all 0.15s ease" : "all 0.25s ease",
              }}
            >
              {isLit && !isGone && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 35%, rgba(255,120,120,0.6), transparent 70%)",
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [lightsPhase, setLightsPhase] = useState<"off" | "lighting" | "go">(
    "off",
  );
  const [litCount, setLitCount] = useState(0);
  const [titleVisible, setTitleVisible] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Staggered intro sequence
    const t1 = setTimeout(() => setLightsPhase("lighting"), 300);
    const t2 = setTimeout(() => setTitleVisible(true), 600);
    const t3 = setTimeout(() => setCardVisible(true), 1800);

    let count = 0;
    const lightTimer = setTimeout(() => {
      const iv = setInterval(() => {
        count++;
        setLitCount(count);
        if (count >= 5) {
          clearInterval(iv);
          setTimeout(() => setLightsPhase("go"), 900);
        }
      }, 500);
      return () => clearInterval(iv);
    }, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(lightTimer);
    };
  }, []);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative speed-lines"
      style={{ background: "var(--f1-dark)" }}
    >
      {/* WIP Status Bar */}
      <div
        className="flex items-center justify-center gap-3 py-1.5 shrink-0"
        style={{
          background: "rgba(255,214,0,0.05)",
          borderBottom: "1px solid rgba(255,214,0,0.12)",
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
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            color: "#7a6e38",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
          }}
        >
          Safety car deployed — still building this
        </span>
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: "var(--f1-accent)",
            boxShadow: "0 0 6px var(--f1-accent)",
            animation: "flag-pulse 1.8s ease-in-out infinite 0.9s",
          }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-7 shrink-0">
        <div className="flex items-center gap-3">
          {/* F1 logo mark */}
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{ background: "var(--f1-red)" }}
          >
            <span
              className="text-white font-black text-xs leading-none"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.05em",
              }}
            >
              F1
            </span>
          </div>
          <div className="h-4 w-px bg-[#2a2d35]" />
          <span
            className="text-[10px] text-[#5a6272] uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Race Center
          </span>
        </div>
        <div
          className="text-[10px] text-[#5a6272] tracking-[0.15em] uppercase"
          style={{ fontFamily: "var(--font-data)" }}
        >
          2023 Season
        </div>
      </div>

      {/* Main content — centred */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8">
        {/* Starting lights */}
        <div
          className="flex flex-col items-center gap-4"
          style={{
            opacity: lightsPhase !== "off" ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <StartingLights phase={lightsPhase} litCount={litCount} />
          <span
            className="text-[10px] uppercase tracking-[0.3em] transition-all duration-500"
            style={{
              fontFamily: "var(--font-display)",
              color: lightsPhase === "go" ? "var(--f1-red)" : "#5a6272",
              letterSpacing: lightsPhase === "go" ? "0.5em" : "0.3em",
            }}
          >
            {lightsPhase === "go" ? "IT'S LIGHTS OUT" : "FORMULA ONE"}
          </span>
        </div>

        {/* Hero title — staggered letter reveal */}
        <div className="relative text-center" aria-label="RACE CENTER">
          <div
            className="flex items-center justify-center gap-0 select-none overflow-hidden"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              lineHeight: 0.88,
              fontSize: "clamp(72px, 12vw, 140px)",
              letterSpacing: "-0.02em",
            }}
          >
            {TITLE_LETTERS.map((letter, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color:
                    letter === " "
                      ? "transparent"
                      : i < 4
                        ? "#ffffff"
                        : "var(--f1-red)",
                  width: letter === " " ? "0.35em" : "auto",
                  animation: titleVisible
                    ? `letter-drop 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms both`
                    : "none",
                  opacity: titleVisible ? undefined : 0,
                }}
              >
                {letter}
              </span>
            ))}
          </div>
          {/* Underline */}
          <div
            className="h-px mt-3 mx-auto"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--f1-red), transparent)",
              width: titleVisible ? "100%" : "0%",
              transition: "width 0.8s cubic-bezier(0.22,1,0.36,1) 600ms",
            }}
          />
        </div>

        {/* Session card */}
        <div
          style={{
            opacity: cardVisible ? 1 : 0,
            transform: cardVisible ? "translateY(0)" : "translateY(16px)",
            transition:
              "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <button
            onClick={() => navigate(`/race/${SESSION.key}`)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group relative overflow-hidden text-left"
            style={{
              background: hovered ? "#13161c" : "#0e1015",
              borderTop: `1px solid ${hovered ? "rgba(232,0,45,0.5)" : "#1f2330"}`,
              borderRight: `1px solid ${hovered ? "rgba(232,0,45,0.5)" : "#1f2330"}`,
              borderBottom: `1px solid ${hovered ? "rgba(232,0,45,0.5)" : "#1f2330"}`,
              borderLeft: "3px solid var(--f1-red)",
              padding: "20px 28px",
              minWidth: 360,
              transition: "all 0.2s ease",
              boxShadow: hovered ? "0 0 40px rgba(232,0,45,0.12)" : "none",
            }}
          >
            {/* Scan line on hover */}
            {hovered && (
              <div
                className="absolute left-0 right-0 h-8 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(232,0,45,0.04), transparent)",
                  animation: "scan 1.2s ease-in-out infinite",
                  top: 0,
                }}
              />
            )}

            {/* Country + date */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold tracking-[0.2em] px-1.5 py-0.5"
                  style={{
                    fontFamily: "var(--font-data)",
                    background: "rgba(232,0,45,0.15)",
                    color: "var(--f1-red)",
                    border: "1px solid rgba(232,0,45,0.3)",
                  }}
                >
                  {SESSION.country}
                </span>
                <span
                  className="text-[10px] text-[#5a6272] tracking-[0.15em] uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {SESSION.date}
                </span>
              </div>
              <span
                className="text-[10px] text-[#5a6272]"
                style={{ fontFamily: "var(--font-data)" }}
              >
                #{SESSION.key}
              </span>
            </div>

            {/* Race name */}
            <div
              className="text-2xl font-black text-white mb-1 leading-none uppercase tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {SESSION.name}
            </div>
            <div
              className="text-[11px] text-[#5a6272] uppercase tracking-[0.15em] mb-5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {SESSION.subtitle}
            </div>

            {/* CTA row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span
                    className="text-[9px] text-[#5a6272] uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Laps
                  </span>
                  <span
                    className="text-lg font-bold text-white tabular-nums leading-none"
                    style={{ fontFamily: "var(--font-data)" }}
                  >
                    {SESSION.laps}
                  </span>
                </div>
                <div className="w-px h-8 bg-[#1f2330]" />
                <div className="flex flex-col">
                  <span
                    className="text-[9px] text-[#5a6272] uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Type
                  </span>
                  <span
                    className="text-lg font-bold text-white leading-none uppercase"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Sprint
                  </span>
                </div>
              </div>

              {/* Arrow CTA */}
              <div
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-200"
                style={{
                  fontFamily: "var(--font-display)",
                  color: hovered ? "var(--f1-red)" : "#5a6272",
                  transform: hovered ? "translateX(4px)" : "translateX(0)",
                }}
              >
                Load Session
                <span className="text-base leading-none">→</span>
              </div>
            </div>
          </button>
        </div>

        {/* Tagline */}
        <div
          className="text-center"
          style={{
            opacity: cardVisible ? 1 : 0,
            transition: "opacity 0.5s ease 0.3s",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-display)", color: "#5a6272" }}
          >
            Made with ♥ by hiyo
          </p>
        </div>
      </div>

      {/* Bottom border accent */}
      <div
        className="h-px w-full shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--f1-red) 40%, transparent)",
        }}
      />
    </div>
  );
}
