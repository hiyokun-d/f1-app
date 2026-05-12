import {
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  animate,
  createLayout,
  createScope,
  createTimeline,
  cubicBezier,
  spring,
  stagger,
} from "animejs";
import type { AutoLayout } from "animejs";
import type { Position, OvertakeEvent } from "../../../types";

const currentEasing = cubicBezier(0.683, 0.284, 0.28, 1.289);

interface AnimationProps {
  containerRef: RefObject<HTMLDivElement | null>;
  positions: Position[];
  positionChanges: Record<number, "up" | "down">;
  pitStatusMap: Map<number, "pitting" | "just_out">;
  recentOvertakes?: OvertakeEvent[];
  drsActive: boolean;
  drsDriver: number | null;
  bestLapMap: Map<number, number>;
  overallBest: number;
  displayPositions: Position[];
  setDisplayPositions: Dispatch<SetStateAction<Position[]>>;
  selectedDriver: number | null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function useDriverTableAnimations({
  containerRef,
  positions,
  positionChanges,
  pitStatusMap,
  recentOvertakes,
  drsActive,
  drsDriver,
  bestLapMap,
  overallBest,
  displayPositions,
  setDisplayPositions,
  selectedDriver,
}: AnimationProps): void {
  // ── Internal refs ─────────────────────────────────────────────────────────
  const hasAnimated = useRef(false);
  const layout = useRef<AutoLayout | null>(null);
  const prevPitRef = useRef(new Map<number, string>());
  const prevOvertakesLenRef = useRef(-1);
  const prevDrsRef = useRef<{
    active: boolean;
    driver: number | null | undefined;
  }>({
    active: false,
    driver: null,
  });
  const pendingPosTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowPositionsRef = useRef<Map<number, number>>(new Map());
  const prevFastestLapRef = useRef<number | null>(null);
  const railAnimRef = useRef<Map<number, ReturnType<typeof createTimeline>>>(
    new Map(),
  );
  const pitAnimRef = useRef<Map<number, ReturnType<typeof createTimeline>>>(
    new Map(),
  );
  // Guards rail animation from re-firing every 250ms tick when only `positions`
  // ref changed but `positionChanges` content did not.
  const lastPosChangesAnimRef = useRef<Record<number, "up" | "down"> | null>(
    null,
  );
  // Always holds the latest positions so timers never capture stale closures.
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  // Tracks the last rendered rank order so FLIP fires on any reorder.
  const prevOrderRef = useRef<number[]>([]);
  // Tracks last selected driver to fire click animation only on change.
  const prevSelectedRef = useRef<number | null>(null);

  // ── commitPositions ───────────────────────────────────────────────────────
  // Snapshots row Y positions before any order change so the FLIP
  // useLayoutEffect can animate rows sliding to their new spots.
  function commitPositions(next: Position[]) {
    const nextOrder = next.map((p) => p.driver_number);
    const orderChanged = nextOrder.some(
      (dn, i) => prevOrderRef.current[i] !== dn,
    );

    if (orderChanged && containerRef.current) {
      const snap = new Map<number, number>();
      containerRef.current
        .querySelectorAll<HTMLElement>("[data-driver-row]")
        .forEach((row) => {
          const dn = row.getAttribute("data-driver-row");
          if (dn) snap.set(Number(dn), row.getBoundingClientRect().top);
        });
      rowPositionsRef.current = snap;
    }

    prevOrderRef.current = nextOrder;
    setDisplayPositions(next);
  }

  // ── 1. Intro stagger slide-in ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || hasAnimated.current || positions.length === 0)
      return;
    hasAnimated.current = true;
    const s = createScope({ root: containerRef.current });
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
  }, [positions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Rail animation + delayed row reorder ───────────────────────────────
  useEffect(() => {
    if (pendingPosTimer.current) clearTimeout(pendingPosTimer.current);
    const entries = Object.entries(positionChanges) as [
      string,
      "up" | "down",
    ][];

    // Only fire rail animation when positionChanges is a genuinely new object.
    // `positions` gets a new array ref every 250ms replay tick even when no
    // changes occurred — without this guard the rail would reset+restart every tick.
    const shouldAnimate =
      entries.length > 0 && lastPosChangesAnimRef.current !== positionChanges;

    if (shouldAnimate) {
      lastPosChangesAnimRef.current = positionChanges;
      const c = containerRef.current;
      if (c) {
        entries.forEach(([dnStr]) => {
          const dn = Number(dnStr);
          const rail = c.querySelector<HTMLElement>(
            `[data-team-rail="${dnStr}"]`,
          );
          if (!rail) return;

          const prevTl = railAnimRef.current.get(dn);
          if (prevTl) prevTl.pause();
          rail.style.width = "2px";

          const W = 47;
          const tl = createTimeline();
          railAnimRef.current.set(dn, tl);
          tl.add(
            rail,
            {
              width: [2, W],
              duration: 200,
              ease: cubicBezier(0.683, 0.284, 0.28, 1.289),
            },
            0,
          );
          tl.add(
            rail,
            {
              width: [W, 2],
              duration: 480,
              ease: spring({ stiffness: 300, damping: 16, mass: 0.85 }),
            },
            1500,
          );
        });
      }
      // Snapshot + reorder after rail has had 280ms to expand.
      // Use positionsRef so the closure always holds the latest positions.
      pendingPosTimer.current = setTimeout(() => {
        commitPositions(positionsRef.current);
      }, 280);
    } else {
      commitPositions(positions);
    }

    return () => {
      if (pendingPosTimer.current) clearTimeout(pendingPosTimer.current);
    };
  }, [positions, positionChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. FLIP — slide rows from old Y to new Y after reorder ───────────────
  useLayoutEffect(() => {
    if (!containerRef.current || rowPositionsRef.current.size === 0) return;
    const c = containerRef.current;
    c.querySelectorAll<HTMLElement>("[data-driver-row]").forEach((row) => {
      const dn = Number(row.getAttribute("data-driver-row"));
      const prevTop = rowPositionsRef.current.get(dn);
      if (prevTop === undefined) return;
      const delta = prevTop - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      animate(row, {
        translateY: [delta, 0],
        duration: 520,
        ease: cubicBezier(0.434, -0.022, 0.519, 0.923),
      });
    });
    rowPositionsRef.current = new Map();
  }, [displayPositions]);

  // ── 4. Layout + ResizeObserver for compact/expanded breakpoint ────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const c = containerRef.current;

    // Pre-apply expanded class without animation if already wide enough on mount.
    // Must happen before createLayout so the layout lib sees elements already
    // visible and skips the enterFrom animation for initial render.
    const initialExpand = c.getBoundingClientRect().width >= 380;
    let expanded = initialExpand;
    if (initialExpand) c.classList.add("driver-table-expanded");

    layout.current = createLayout(c, {
      children: ".driver-detail",
      enterFrom: { opacity: 0, x: -10 },
      leaveTo: { opacity: 0, x: -10 },
      duration: 380,
      ease: "inOut(3)",
    });

    const ro = new ResizeObserver(([entry]) => {
      const shouldExpand = entry.contentRect.width >= 380;
      if (shouldExpand === expanded || !layout.current) return;
      expanded = shouldExpand;
      layout.current.update(({ root }) => {
        root.classList.toggle("driver-table-expanded", shouldExpand);
      });
    });
    ro.observe(c);
    return () => {
      ro.disconnect();
      layout.current?.revert();
      layout.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Pit overlay animation ──────────────────────────────────────────────
  // No dep array: runs every render so it catches pit state changes immediately.
  // prevPitRef guards against re-triggering the same status.
  useEffect(() => {
    if (!containerRef.current) return;
    const c = containerRef.current;

    pitStatusMap.forEach((status, dn) => {
      if (prevPitRef.current.get(dn) === status) return;

      const prevTl = pitAnimRef.current.get(dn);
      if (prevTl) prevTl.pause();

      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const label = c.querySelector<HTMLElement>(`[data-pit-label="${dn}"]`);
      const gapText = c.querySelector<HTMLElement>(`[data-gap-text="${dn}"]`);
      const pitInline = c.querySelector<HTMLElement>(
        `[data-pit-inline="${dn}"]`,
      );

      if (status === "pitting") {
        const tl = createTimeline({ defaults: { ease: "outQuart" } });
        pitAnimRef.current.set(dn, tl);
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
        if (pitInline) tl.add(pitInline, { opacity: 0, duration: 120 }, 0);
      } else if (status === "just_out") {
        const tl = createTimeline({ defaults: { ease: "outCubic" } });
        pitAnimRef.current.set(dn, tl);
        // Animate from current values — previous tl may have been paused mid-flight.
        if (bg)
          tl.add(
            bg,
            { backgroundColor: "rgba(34,197,94,0.20)", duration: 750 },
            0,
          );
        if (label) tl.add(label, { opacity: 0, duration: 150 }, 0);
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

    // Drivers leaving pit status entirely — restore gap text, hide overlays + label.
    prevPitRef.current.forEach((_, dn) => {
      if (pitStatusMap.has(dn)) return;
      const prevTl = pitAnimRef.current.get(dn);
      if (prevTl) prevTl.pause();
      pitAnimRef.current.delete(dn);
      const bg = c.querySelector<HTMLElement>(`[data-pit-bg="${dn}"]`);
      const label = c.querySelector<HTMLElement>(`[data-pit-label="${dn}"]`);
      const gapText = c.querySelector<HTMLElement>(`[data-gap-text="${dn}"]`);
      const pitInline = c.querySelector<HTMLElement>(
        `[data-pit-inline="${dn}"]`,
      );
      // Single-target form: animates from current paused state — avoids snapping
      // if the bg was yellow rather than green when the timeline was paused.
      if (bg)
        animate(bg, {
          backgroundColor: "rgba(0,0,0,0)",
          duration: 500,
          ease: "inQuart",
        });
      if (label) animate(label, { opacity: 0, duration: 200 });
      if (gapText) animate(gapText, { opacity: 1, duration: 200 });
      if (pitInline) animate(pitInline, { opacity: 0, duration: 200 });
    });

    prevPitRef.current = new Map(pitStatusMap);
  });

  // ── 6. Overtake flash ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !recentOvertakes) return;
    const c = containerRef.current;

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

  // ── 7. DRS strip + rail ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const c = containerRef.current;
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

  // ── 8. Fastest lap — purple rail flash ───────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !isFinite(overallBest) || overallBest <= 0)
      return;
    let dn: number | null = null;
    bestLapMap.forEach((time, driver) => {
      if (time === overallBest) dn = driver;
    });
    if (dn === null || dn === prevFastestLapRef.current) return;
    prevFastestLapRef.current = dn;
    const c = containerRef.current;
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

  // ── 9. Hover — translateX nudge + team-color glow ────────────────────────
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;

    const onOver = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-driver-row]",
      );
      if (!row) return;
      if (row.contains(e.relatedTarget as Node | null)) return;
      const teamColor =
        row
          .querySelector<HTMLElement>("[data-team-color]")
          ?.getAttribute("data-team-color") ?? "#888888";
      const hoverBg = row.querySelector<HTMLElement>(`[data-hover-bg]`);
      animate(row, { x: 4, duration: 160, ease: "outExpo" });
      if (hoverBg)
        animate(hoverBg, {
          backgroundColor: ["rgba(255,255,255,0)", hexToRgba(teamColor, 0.57)],
          duration: 200,
          ease: currentEasing,
        });
    };

    const onOut = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-driver-row]",
      );
      if (!row) return;
      if (row.contains(e.relatedTarget as Node | null)) return;
      const hoverBg = row.querySelector<HTMLElement>(`[data-hover-bg]`);
      animate(row, {
        x: 0,
        duration: 300,
        ease: spring({ stiffness: 260, damping: 22, mass: 1 }),
      });
      if (hoverBg)
        animate(hoverBg, {
          backgroundColor: "rgba(255,255,255,0)",
          duration: 250,
          ease: "outQuart",
        });
    };

    c.addEventListener("mouseover", onOver);
    c.addEventListener("mouseout", onOut);
    return () => {
      c.removeEventListener("mouseover", onOver);
      c.removeEventListener("mouseout", onOut);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 10. Click / select — team-color flash + spring slide-in ──────────────
  useEffect(() => {
    if (selectedDriver === null || selectedDriver === prevSelectedRef.current) {
      prevSelectedRef.current = selectedDriver;
      return;
    }
    prevSelectedRef.current = selectedDriver;
    const c = containerRef.current;
    if (!c) return;
    const row = c.querySelector<HTMLElement>(
      `[data-driver-row="${selectedDriver}"]`,
    );
    if (!row) return;
    const selectBg = c.querySelector<HTMLElement>(
      `[data-select-bg="${selectedDriver}"]`,
    );
    const teamColor =
      row
        .querySelector<HTMLElement>("[data-team-color]")
        ?.getAttribute("data-team-color") ?? "#888888";

    animate(row, {
      x: [10, 0],
      duration: 460,
      ease: currentEasing,
    });

    if (selectBg) {
      animate(selectBg, {
        backgroundColor: [
          "rgba(255,255,255,0)",
          hexToRgba(teamColor, 0.52),
          "rgba(255,255,255,0)",
        ],
        duration: 450,
        ease: currentEasing,
      });
    }
  }, [selectedDriver]); // eslint-disable-line react-hooks/exhaustive-deps
}
