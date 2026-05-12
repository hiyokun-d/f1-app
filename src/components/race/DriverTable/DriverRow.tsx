import { useEffect, useRef } from "react";
import type {
  Driver,
  Position,
  Interval,
  Lap,
  Stint,
  Pit,
} from "../../../types";
import {
  formatLapTime,
  formatInterval,
  teamHex,
  countryToFlag,
} from "../../../utils/format";
import { TYRE_COLORS, TYRE_LIFE_LAPS, type BadgeVariant } from "./constants";
import { StatusBadge } from "./StatusBadge";
import { TyreBadge } from "./TyreBadge";
import { PositionNumber } from "./PositionNumber";
import AnimatedValue from "../../common/AnimatedValue";
import { animate } from "animejs";

// ── GapDisplay: animated slot-machine number + proximity glow ─────────────
// gap = gap_to_leader (null during live races); intervalGap = gap to car ahead (fallback)
function GapDisplay({
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

interface DriverRowProps {
  pos: Position;
  idx: number;
  driverMap: Map<number, Driver>;
  intervalMap: Map<number, Interval>;
  stintMap: Map<number, Stint>;
  lapMap: Map<number, Lap>;
  bestLapMap: Map<number, number>;
  lastPitMap: Map<number, Pit>;
  pitStatusMap: Map<number, "pitting" | "just_out">;
  pitCountMap: Map<number, number>;
  positionChanges: Record<number, "up" | "down">;
  overallBest: number;
  overallBestSectors: {
    s1: number | null;
    s2: number | null;
    s3: number | null;
  };
  bestSectorMap: Map<
    number,
    { s1: number | null; s2: number | null; s3: number | null }
  >;
  maxLap: number;
  selectedDriver: number | null;
  drsDriver: number | null;
  drsActive: boolean;
  onSelectDriver: (dn: number) => void;
}

export function DriverRow({
  pos,
  idx,
  driverMap,
  intervalMap,
  stintMap,
  lapMap,
  bestLapMap,
  lastPitMap,
  pitStatusMap,
  pitCountMap,
  positionChanges,
  overallBest,
  overallBestSectors,
  bestSectorMap,
  maxLap,
  selectedDriver,
  drsDriver,
  drsActive,
  onSelectDriver,
}: DriverRowProps) {
  const driver = driverMap.get(pos.driver_number);
  const interval = intervalMap.get(pos.driver_number);
  const stint = stintMap.get(pos.driver_number);
  const lastLap = lapMap.get(pos.driver_number);
  const bestLap = bestLapMap.get(pos.driver_number);
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
  const isBestForDriver = lapDuration !== null && lapDuration === bestLap;
  const lastPit = lastPitMap.get(pos.driver_number);
  const pitDuration = lastPit?.pit_duration;
  const pitLap = lastPit?.lap_number;
  const hasDrs = drsDriver === pos.driver_number && drsActive;
  const pitCount = pitCountMap.get(pos.driver_number) ?? 0;
  const driverBestSectors = bestSectorMap.get(pos.driver_number);
  const s1 = lastLap?.duration_sector_1 ?? null;
  const s2 = lastLap?.duration_sector_2 ?? null;
  const s3 = lastLap?.duration_sector_3 ?? null;
  const s1Color =
    s1 !== null && s1 === overallBestSectors.s1
      ? "#c084fc"
      : s1 !== null &&
          driverBestSectors?.s1 !== null &&
          s1 === driverBestSectors?.s1
        ? "#22c55e"
        : "#4b5563";
  const s2Color =
    s2 !== null && s2 === overallBestSectors.s2
      ? "#c084fc"
      : s2 !== null &&
          driverBestSectors?.s2 !== null &&
          s2 === driverBestSectors?.s2
        ? "#22c55e"
        : "#4b5563";
  const s3Color =
    s3 !== null && s3 === overallBestSectors.s3
      ? "#c084fc"
      : s3 !== null &&
          driverBestSectors?.s3 !== null &&
          s3 === driverBestSectors?.s3
        ? "#22c55e"
        : "#4b5563";
  const miniSegs = [
    ...(lastLap?.segments_sector_1 ?? []),
    ...(lastLap?.segments_sector_2 ?? []),
    ...(lastLap?.segments_sector_3 ?? []),
  ];

  const compound = stint?.compound ?? "UNKNOWN";
  const expectedLife = TYRE_LIFE_LAPS[compound] ?? 30;
  const tyreWear =
    tyreAge !== null && !isPitting && !isJustOut ? tyreAge / expectedLife : 0;
  const pitSoon = tyreWear > 0.8 && tyreWear <= 1.0;
  const pitNow = tyreWear > 1.0;

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
      className="driver-row relative cursor-pointer"
      style={{
        padding: "3px 8px 3px 12px",
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
      {/* Animated overlays — initial state via CSS, never React style */}
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
      <div
        data-select-bg={pos.driver_number}
        className="select-overlay absolute inset-0 pointer-events-none"
        style={{ zIndex: -1 }}
      />
      <div
        data-hover-bg={pos.driver_number}
        className="hover-overlay absolute inset-0 pointer-events-none"
        style={{ zIndex: -1 }}
      />

      {/* Tyre wear fill strip */}
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

      {/* PIT STOP flash — animated by createTimeline in the hook */}
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

      {/* DRS strip */}
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

      {/* Left team-color rail — AnimeJS owns width */}
      <div
        data-team-rail={pos.driver_number}
        data-team-color={teamColor}
        className="absolute left-0 top-0 bottom-0 w-[2px] overflow-hidden"
        style={{ background: teamColor }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: change ? "rgba(0,0,0, 0.5)" : "rgba(0,0,0, 0)",
            transition: "background .2s",
          }}
        />
        <div
          data-rail-drs={pos.driver_number}
          className="rail-drs absolute inset-0 pointer-events-none"
        />
      </div>

      {/* Position number */}
      <div className="flex items-center pl-1.5 z-10 gap-1">
        <PositionNumber pos={pos.position} change={change} />
        {change && (
          <span
            className="change-arrow"
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

      {/* Tyre compound badge + age sub-label (age only visible in expanded) */}
      <div className="flex flex-col items-center justify-center">
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
        {tyre && tyreAge !== null && (
          <span
            className="driver-tyre-age"
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 7,
              fontWeight: 700,
              lineHeight: 1,
              color:
                tyreAge > 28 ? "#f97316" : tyreAge > 16 ? "#eab308" : "#4b5563",
            }}
          >
            {tyreAge}L
          </span>
        )}
      </div>

      {/* Driver name + badges + headshot + country (headshot/country only in expanded) */}
      <div className="driver-name-cell flex items-center gap-1.5 min-w-0">
        {driver?.headshot_url && (
          <img
            src={driver.headshot_url}
            alt={driver.name_acronym}
            className="driver-headshot"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            style={{ borderColor: `${teamColor}55` }}
          />
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
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
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="driver-team-sub truncate"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 7,
                letterSpacing: "0.08em",
                lineHeight: 1,
                marginTop: 1,
                color: `${teamColor}60`,
              }}
            >
              {driver?.team_name?.toUpperCase() ?? ""}
            </span>
            {driver?.country_code && (
              <span className="driver-country-flag" style={{ marginTop: 1 }}>
                {countryToFlag(driver.country_code)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gap to leader — animated; crossfades with pit duration on pit exit */}
      <div className="text-right" style={{ position: "relative" }}>
        <span data-gap-text={pos.driver_number} style={{ display: "block" }}>
          <GapDisplay
            gap={interval?.gap_to_leader ?? null}
            intervalGap={isLeader ? null : (interval?.interval ?? null)}
            isLeader={isLeader}
          />
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

      {/* Interval + current lap# [expanded] */}
      <div
        className="driver-detail"
        style={{ flexDirection: "column", alignItems: "flex-end", gap: 0 }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            color: "#6b7280",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {isLeader ? "—" : formatInterval(interval?.interval ?? null)}
        </span>
        {lastLap?.lap_number ? (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 7,
              lineHeight: 1,
              marginTop: 2,
              letterSpacing: "-0.01em",
              color: "#2e3444",
            }}
          >
            L{lastLap.lap_number}
          </span>
        ) : null}
      </div>

      {/* Last lap + personal best sub-label [expanded] */}
      <div
        className="driver-detail"
        style={{ flexDirection: "column", alignItems: "flex-end", gap: 0 }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            fontWeight: isFastestLap || isBestForDriver ? 700 : 400,
            color: isFastestLap
              ? "#c084fc"
              : isBestForDriver
                ? "#22c55e"
                : "#6b7280",
            letterSpacing: "-0.02em",
            lineHeight: 1,
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
              EXIT PIT
            </span>
          ) : (
            formatLapTime(lapDuration)
          )}
        </span>
        {bestLap !== undefined &&
          lapDuration !== null &&
          lapDuration !== bestLap &&
          !lastLap?.is_pit_out_lap && (
            <span
              className="driver-lap-sub"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 7,
                lineHeight: 1,
                marginTop: 1,
                letterSpacing: "-0.01em",
                color: isFastestLap
                  ? "rgba(192,132,252,0.5)"
                  : "rgba(34,197,94,0.6)",
              }}
            >
              {formatLapTime(bestLap)}
            </span>
          )}

        {/* Sector times S1/S2/S3 */}
        {(s1 !== null || s2 !== null || s3 !== null) &&
          !lastLap?.is_pit_out_lap && (
            <div
              className="driver-detail"
              style={{ display: "flex", gap: 3, marginTop: 2 }}
            >
              {[
                { v: s1, c: s1Color },
                { v: s2, c: s2Color },
                { v: s3, c: s3Color },
              ].map((sec, i) =>
                sec.v !== null ? (
                  <span
                    key={i}
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 6,
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                      color: sec.c,
                    }}
                  >
                    {sec.v.toFixed(3)}
                  </span>
                ) : null,
              )}
            </div>
          )}

        {/* Speed trap */}
        {lastLap?.st_speed != null && !lastLap?.is_pit_out_lap && (
          <div
            className="driver-detail"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginTop: 2,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 6,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#2e3444",
              }}
            >
              ST
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 6,
                letterSpacing: "-0.01em",
                color:
                  lastLap.st_speed >= 320
                    ? "#f97316"
                    : lastLap.st_speed >= 300
                      ? "#eab308"
                      : "#4b5563",
              }}
            >
              {lastLap.st_speed}
            </span>
          </div>
        )}
      </div>

      {/* Pit duration + lap number sub-label [expanded] */}
      <div
        className="driver-detail"
        style={{ flexDirection: "column", alignItems: "flex-end", gap: 0 }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: isJustOut ? "#22c55e" : "#6b7280",
          }}
        >
          {pitDuration != null ? `${pitDuration.toFixed(1)}s` : "—"}
        </span>
        {pitLap != null && (
          <span
            className="driver-pit-sub"
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 7,
              lineHeight: 1,
              marginTop: 1,
              color: "#2e3444",
            }}
          >
            L{pitLap}
            {pitCount > 0 ? ` · S${pitCount}` : ""}
          </span>
        )}
      </div>

      {/* Mini-sector strip */}
      {/* {miniSegs.length > 0 && ( */}
      {/*   <div */}
      {/*     className="absolute bottom-0 left-0 right-0 pointer-events-none flex" */}
      {/*     style={{ height: 3, zIndex: 5 }} */}
      {/*   > */}
      {/*     {miniSegs.map((seg, i) => { */}
      {/*       const bg = */}
      {/*         seg === 2051 */}
      {/*           ? "#c084fc" */}
      {/*           : seg === 2049 */}
      {/*             ? "#22c55e" */}
      {/*             : seg === 2048 */}
      {/*               ? "#eab308" */}
      {/*               : seg === 2052 */}
      {/*                 ? "#f97316" */}
      {/*                 : "transparent"; */}
      {/*       return ( */}
      {/*         <div */}
      {/*           key={i} */}
      {/*           style={{ */}
      {/*             flex: 1, */}
      {/*             background: bg, */}
      {/*             opacity: bg === "transparent" ? 0 : 0.7, */}
      {/*           }} */}
      {/*         /> */}
      {/*       ); */}
      {/*     })} */}
      {/*   </div> */}
      {/* )} */}
    </div>
  );
}
