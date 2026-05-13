import "../styles/Home.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, createScope, createTimeline, stagger } from "animejs";
import { usePrefetchOnVisible } from "../hooks/usePrefetchOnVisible";

const TITLE_LETTERS = ["R", "A", "C", "E", " ", "C", "E", "N", "T", "E", "R"];

const SESSION = {
  key: 9165, // SMOOTHHHH OPERATOR
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

const REPO = "hiyokun-d/f1-app";
const AUTHOR = "hiyokun-d";

// Add a login here to get the badge pulse animation + click-delay transition.
// The special popup card design is exclusive to AUTHOR.
const SPECIAL_CONTRIBUTORS: Record<string, { badge: string; role: string }> = {
  [AUTHOR]: { badge: "CREATOR", role: "RACE ENGINEER" },
};

interface Contributor {
  login: string;
  html_url: string;
  avatar_url: string;
  contributions: number;
  name?: string;
  lastCommitMsg?: string;
  lastCommitDate?: string;
}

function relativeTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function useContributors() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=10`)
      .then((r) => (r.ok ? r.json() : []))
      .then(async (data: Contributor[]) => {
        const filtered = data.filter((c) => !c.login.includes("[bot]"));
        setContributors(filtered);
        const enriched = await Promise.all(
          filtered.map(async (c) => {
            const [profile, commits] = await Promise.all([
              fetch(`https://api.github.com/users/${c.login}`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
              fetch(
                `https://api.github.com/repos/${REPO}/commits?author=${c.login}&per_page=1`,
              )
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
            ]);
            return {
              ...c,
              name: profile?.name ?? undefined,
              lastCommitMsg:
                (commits as { commit?: { message?: string } }[] | null)?.[0]
                  ?.commit?.message ?? undefined,
              lastCommitDate:
                (
                  commits as {
                    commit?: { author?: { date?: string } };
                  }[] | null
                )?.[0]?.commit?.author?.date ?? undefined,
            };
          }),
        );
        setContributors(enriched);
      })
      .catch(() => {});
  }, []);
  return contributors;
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
  const cardRef = usePrefetchOnVisible<HTMLButtonElement>(SESSION.key);
  const contributors = useContributors();
  const taglineRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [popupContrib, setPopupContrib] = useState<Contributor | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<{
    bottom: number;
    cx: number;
  }>({ bottom: 80, cx: 0 });

  // Ring draw + commit count-up whenever the author card opens
  useEffect(() => {
    if (!popupContrib || popupContrib.login !== AUTHOR) return;
    const CIRC = 119.4;
    const t = setTimeout(() => {
      if (ringRef.current)
        animate(ringRef.current, {
          strokeDashoffset: [CIRC, 0],
          duration: 720,
          ease: "outExpo",
        });
      if (countRef.current) {
        const c = { v: 0 };
        const el = countRef.current;
        animate(c, {
          v: popupContrib.contributions,
          duration: 950,
          ease: "outExpo",
          onUpdate: () => {
            el.textContent = Math.round(c.v).toString();
          },
        });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [popupContrib]);

  useEffect(() => {
    if (!taglineRef.current || !cardVisible || contributors.length === 0)
      return;

    const root = taglineRef.current;
    let scope: ReturnType<typeof createScope> | null = null;
    const evtCleanups: (() => void)[] = [];
    // tracks every idle anim created so we can cancel them on unmount
    const idleAnims: ReturnType<typeof animate>[] = [];

    const timer = setTimeout(() => {
      if (!root) return;
      scope = createScope({ root });

      const links = Array.from(
        root.querySelectorAll<HTMLElement>(
          ".contributor-link, .contributor-author, .repo-link",
        ),
      );

      scope.add(() => {
        // ── Reveal: materialize each link like incoming telemetry data ──────
        animate(links, {
          opacity: [0, 1],
          y: [10, 0],
          filter: ["blur(5px)", "blur(0px)"],
          duration: 480,
          delay: stagger(130),
          ease: "outExpo",
        });

        // ── Per-link idle + hover — starts after that link's reveal ─────────
        links.forEach((el, i) => {
          const isAuthor = el.classList.contains("contributor-author");
          const login = el.dataset.login ?? "";
          const contrib = contributors.find((c) => c.login === login) ?? null;
          // contributor links get badge treatment; repo-link does not
          const hasBadge = !!contrib;

          const baseColor = isAuthor ? "#8a4454" : "#5a6878";
          const peakColor = isAuthor ? "#d83050" : "#7a8ea8";
          const hoverColor = isAuthor ? "#ff1828" : "#c8d8ec";
          const hoverGlow = isAuthor
            ? "0 0 16px rgba(255,24,40,0.85), 0 0 40px rgba(255,24,40,0.28)"
            : "0 0 10px rgba(200,216,236,0.65)";
          const hoverScale = isAuthor ? 1.09 : 1.04;
          const idleDur = isAuthor ? 2400 : 3000 + i * 200;

          // badge idle colors by contributor type
          const idleBgFrom = isAuthor
            ? "rgba(232,0,45,0.07)"
            : "rgba(58,90,122,0.05)";
          const idleBgTo = isAuthor
            ? "rgba(232,0,45,0.18)"
            : "rgba(58,90,122,0.14)";
          const idleShadowFrom = isAuthor
            ? "inset 0 0 0 1px rgba(232,0,45,0.15), 0 0 0px rgba(232,0,45,0)"
            : "inset 0 0 0 1px rgba(58,90,122,0.1), 0 0 0px rgba(58,90,122,0)";
          const idleShadowTo = isAuthor
            ? "inset 0 0 0 1px rgba(232,0,45,0.4), 0 0 10px rgba(232,0,45,0.2)"
            : "inset 0 0 0 1px rgba(58,90,122,0.28), 0 0 8px rgba(58,90,122,0.15)";

          const startIdle = () => {
            if (hasBadge) {
              const a = animate(el, {
                color: [baseColor, peakColor],
                backgroundColor: [idleBgFrom, idleBgTo],
                boxShadow: [idleShadowFrom, idleShadowTo],
                textShadow: [
                  "0 0 0px rgba(0,0,0,0)",
                  isAuthor
                    ? "0 0 12px rgba(216,48,80,0.55)"
                    : "0 0 8px rgba(122,142,168,0.4)",
                ],
                loop: true,
                alternate: true,
                duration: idleDur,
                ease: "inOutSine",
              });
              idleAnims.push(a);
              return a;
            }
            // repo-link: simple pulse only
            const a = animate(el, {
              color: [baseColor, peakColor],
              textShadow: [
                "0 0 0px rgba(0,0,0,0)",
                "0 0 8px rgba(122,142,168,0.4)",
              ],
              loop: true,
              alternate: true,
              duration: idleDur,
              ease: "inOutSine",
            });
            idleAnims.push(a);
            return a;
          };

          const revealEnd = 480 + i * 130 + 80;
          const idleTimer = setTimeout(() => {
            let idle = startIdle();

            const onEnter = () => {
              idle.pause();
              animate(el, {
                color: hoverColor,
                textShadow: hoverGlow,
                scale: hoverScale,
                ...(hasBadge && {
                  backgroundColor: isAuthor
                    ? "rgba(232,0,45,0.3)"
                    : "rgba(58,90,122,0.25)",
                  boxShadow: isAuthor
                    ? "inset 0 0 0 1px rgba(232,0,45,0.7), 0 0 16px rgba(232,0,45,0.35)"
                    : "inset 0 0 0 1px rgba(90,140,190,0.5), 0 0 12px rgba(58,90,122,0.3)",
                }),
                duration: 200,
                ease: "outQuart",
              });

              if (contrib && popupRef.current) {
                const rect = el.getBoundingClientRect();
                setPopupAnchor({
                  bottom: window.innerHeight - rect.top + 16,
                  cx: rect.left + rect.width / 2,
                });
                setPopupContrib(contrib);
                requestAnimationFrame(() => {
                  if (!popupRef.current) return;
                  if (contrib.login === AUTHOR) {
                    animate(popupRef.current, {
                      opacity: [0, 1],
                      y: [32, 0],
                      scale: [0.5, 1],
                      rotate: [-14, 0],
                      duration: 520,
                      ease: "outBack",
                    });
                  } else {
                    animate(popupRef.current, {
                      opacity: [0, 1],
                      y: [12, 0],
                      scale: [0.88, 1],
                      duration: 280,
                      ease: "outExpo",
                    });
                  }
                  if (scanRef.current) {
                    animate(scanRef.current, {
                      top: ["-4px", "108%"],
                      opacity: [0, 0.9, 0],
                      duration: 460,
                      delay: 140,
                      ease: "inOutQuad",
                    });
                  }
                });
              }
            };

            const onLeave = () => {
              animate(el, {
                color: baseColor,
                textShadow: "0 0 0px rgba(0,0,0,0)",
                scale: 1,
                ...(hasBadge && {
                  backgroundColor: idleBgFrom,
                  boxShadow: idleShadowFrom,
                }),
                duration: 320,
                ease: "outQuart",
                onComplete: () => {
                  idle = startIdle();
                },
              });

              if (contrib && popupRef.current) {
                animate(popupRef.current, {
                  opacity: [1, 0],
                  y: [0, -10],
                  scale: [1, 0.9],
                  duration: 180,
                  ease: "inQuart",
                  onComplete: () => setPopupContrib(null),
                });
              }
            };

            el.addEventListener("mouseenter", onEnter);
            el.addEventListener("mouseleave", onLeave);
            evtCleanups.push(() => {
              el.removeEventListener("mouseenter", onEnter);
              el.removeEventListener("mouseleave", onLeave);
            });

            // ── Click: delay navigation until animation completes ──────────
            if (contrib) {
              let navigating = false;
              const onClick = (e: MouseEvent) => {
                if (navigating) return;
                navigating = true;
                e.preventDefault();
                const href = (el as HTMLAnchorElement).href;
                idle.pause();

                if (popupRef.current) {
                  animate(popupRef.current, {
                    scale: [1, 1.05, 0.7],
                    opacity: [1, 1, 0],
                    filter: ["blur(0px)", "blur(0px)", "blur(10px)"],
                    duration: 380,
                    ease: "inBack",
                    onComplete: () => setPopupContrib(null),
                  });
                }

                const flashBg = isAuthor
                  ? "rgba(232,0,45,0.7)"
                  : "rgba(58,106,154,0.65)";
                const flashShadow = isAuthor
                  ? "inset 0 0 0 1px rgba(232,0,45,1), 0 0 22px rgba(232,0,45,0.6)"
                  : "inset 0 0 0 1px rgba(90,140,190,0.9), 0 0 18px rgba(58,106,154,0.5)";

                const tl = createTimeline();
                tl.add(el, {
                  backgroundColor: flashBg,
                  boxShadow: flashShadow,
                  color: "#ffffff",
                  scale: 1.14,
                  duration: 130,
                  ease: "outQuad",
                }).add(el, {
                  scale: 0,
                  opacity: 0,
                  filter: "blur(8px)",
                  duration: 360,
                  ease: "inBack",
                  onComplete: () => {
                    window.open(href, "_blank");
                    navigating = false;
                    el.style.filter = "";
                    animate(el, {
                      scale: 1,
                      opacity: 1,
                      color: baseColor,
                      ...(hasBadge && {
                        backgroundColor: idleBgFrom,
                        boxShadow: idleShadowFrom,
                      }),
                      duration: 220,
                      ease: "outQuart",
                      onComplete: () => { idle = startIdle(); },
                    });
                  },
                });
              };

              el.addEventListener("click", onClick);
              evtCleanups.push(() =>
                el.removeEventListener("click", onClick),
              );
            }
          }, revealEnd);

          evtCleanups.push(() => clearTimeout(idleTimer));
        });
      });
    }, 700);

    return () => {
      clearTimeout(timer);
      evtCleanups.forEach((fn) => fn());
      idleAnims.forEach((a) => a.cancel());
      scope?.revert();
    };
  }, [contributors, cardVisible]);

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
            ref={cardRef}
            onClick={() =>
              navigate(`/race/${SESSION.key}`, { viewTransition: true })
            }
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
          ref={taglineRef}
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
            Made with ♥ by{" "}
            {contributors.length > 0 ? (
              contributors.map((c, i) => {
                const isAuthor = c.login === AUTHOR;
                return (
                  <span key={c.login}>
                    {i > 0 && (i === contributors.length - 1 ? " and " : ", ")}
                    <a
                      href={c.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        isAuthor ? "contributor-author" : "contributor-link"
                      }
                      data-login={c.login}
                    >
                      {c.login}
                    </a>
                  </span>
                );
              })
            ) : (
              <a
                href={`https://github.com/${REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="contributor-link"
              >
                the team
              </a>
            )}
            {" · "}
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="repo-link"
            >
              view repo
            </a>
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

      {/* ── Contributor popup — fixed, outside any opacity-animated ancestor ── */}
      <div
        ref={popupRef}
        className="contrib-popup"
        style={{
          bottom: popupAnchor.bottom,
          left: popupAnchor.cx,
          transform: "translateX(-50%)",
        }}
      >
        {popupContrib &&
          (popupContrib.login === AUTHOR ? (
            /* ── Author card — main character ─────────────────────────────── */
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                background: "rgba(4,5,16,0.97)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(232,0,45,0.25)",
                borderRadius: 4,
                overflow: "hidden",
                position: "relative",
                minWidth: 220,
                boxShadow: [
                  "0 0 0 1px rgba(232,0,45,0.06)",
                  "0 0 28px rgba(232,0,45,0.18)",
                  "0 16px 40px rgba(0,0,0,0.9)",
                ].join(", "),
              }}
            >
              {/* scan line */}
              <div
                ref={scanRef}
                style={{
                  position: "absolute",
                  inset: "0 0 auto 0",
                  height: 2,
                  background:
                    "linear-gradient(90deg, transparent, #e8002d, transparent)",
                  opacity: 0,
                  zIndex: 20,
                  pointerEvents: "none",
                }}
              />
              {/* left red stripe */}
              <div style={{ width: 3, background: "#e8002d", flexShrink: 0 }} />
              {/* avatar + animated ring */}
              <div
                style={{
                  padding: "10px 10px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div style={{ position: "relative", width: 44, height: 44 }}>
                  <img
                    src={popupContrib.avatar_url}
                    alt={popupContrib.login}
                    width={40}
                    height={40}
                    style={{
                      borderRadius: "50%",
                      display: "block",
                      margin: 2,
                      border: "1.5px solid rgba(232,0,45,0.45)",
                    }}
                  />
                  <svg
                    width={44}
                    height={44}
                    style={{ position: "absolute", top: 0, left: 0 }}
                  >
                    <circle
                      cx={22}
                      cy={22}
                      r={19}
                      fill="none"
                      stroke="rgba(232,0,45,0.1)"
                      strokeWidth={1.5}
                    />
                    <circle
                      ref={ringRef}
                      cx={22}
                      cy={22}
                      r={19}
                      fill="none"
                      stroke="#e8002d"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray={119.4}
                      strokeDashoffset={119.4}
                      style={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                      }}
                    />
                  </svg>
                </div>
              </div>
              {/* divider */}
              <div
                style={{
                  width: 1,
                  background: "rgba(232,0,45,0.15)",
                  margin: "8px 0",
                }}
              />
              {/* info column */}
              <div
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 5,
                  flex: 1,
                }}
              >
                {/* name */}
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  {popupContrib.login}
                </div>
                {/* role badges */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 8,
                      color: "#e8002d",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      background: "rgba(232,0,45,0.14)",
                      padding: "2px 5px",
                      borderRadius: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    CREATOR
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 8,
                      color: "rgba(255,255,255,0.45)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      background: "rgba(255,255,255,0.06)",
                      padding: "2px 5px",
                      borderRadius: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    RACE ENGINEER
                  </span>
                </div>
                {/* divider */}
                <div
                  style={{ height: 1, background: "rgba(232,0,45,0.12)" }}
                />
                {/* commits + joke */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 4 }}
                  >
                    <span
                      ref={countRef}
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#e8002d",
                        lineHeight: 1,
                      }}
                    >
                      0
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 8,
                        color: "rgba(255,255,255,0.4)",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                      }}
                    >
                      commits
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 7,
                      color: "rgba(232,0,45,0.5)",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}
                  >
                    DRS: OPEN
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ── Contributor card — supporting cast ────────────────────────── */
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                background: "rgba(4,6,16,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4,
                overflow: "hidden",
                position: "relative",
                minWidth: 220,
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div
                ref={scanRef}
                style={{
                  position: "absolute",
                  inset: "0 0 auto 0",
                  height: 2,
                  background:
                    "linear-gradient(90deg, transparent, #3a6a9a, transparent)",
                  opacity: 0,
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />
              <div style={{ width: 3, background: "#3a5a7a", flexShrink: 0 }} />
              <div
                style={{
                  padding: "10px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <img
                  src={popupContrib.avatar_url}
                  alt={popupContrib.login}
                  width={40}
                  height={40}
                  style={{
                    borderRadius: "50%",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    display: "block",
                  }}
                />
              </div>
              <div
                style={{
                  width: 1,
                  background: "rgba(255,255,255,0.06)",
                  margin: "8px 0",
                }}
              />
              <div
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 4,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {/* display name or login */}
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {popupContrib.name ?? popupContrib.login}
                </div>
                {/* handle (only if display name differs) */}
                {popupContrib.name && (
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 8,
                      color: "rgba(255,255,255,0.28)",
                      letterSpacing: "0.14em",
                      lineHeight: 1,
                    }}
                  >
                    @{popupContrib.login}
                  </div>
                )}
                <div
                  style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
                />
                {/* last commit message */}
                {popupContrib.lastCommitMsg && (
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 9,
                      color: "rgba(255,255,255,0.5)",
                      letterSpacing: "0.04em",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {popupContrib.lastCommitMsg.split("\n")[0].slice(0, 38)}
                    {popupContrib.lastCommitMsg.split("\n")[0].length > 38
                      ? "…"
                      : ""}
                  </div>
                )}
                {/* commits + date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 4 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#5a8ab0",
                        lineHeight: 1,
                      }}
                    >
                      {popupContrib.contributions}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 8,
                        color: "rgba(255,255,255,0.3)",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                      }}
                    >
                      commits
                    </span>
                  </div>
                  {popupContrib.lastCommitDate && (
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 8,
                        color: "rgba(255,255,255,0.25)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {relativeTime(popupContrib.lastCommitDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        {/* caret */}
        {popupContrib && (
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `6px solid ${popupContrib.login === AUTHOR ? "rgba(232,0,45,0.18)" : "rgba(255,255,255,0.07)"}`,
            }}
          />
        )}
      </div>
    </div>
  );
}
