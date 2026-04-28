import type { Driver, Position, Interval, Lap, Stint, Pit } from "../../../types";
import { formatLapTime, formatGap, formatInterval, teamHex } from "../../../utils/format";
import { TYRE_COLORS, TYRE_LIFE_LAPS, type BadgeVariant } from "./constants";
import { StatusBadge } from "./StatusBadge";
import { TyreBadge } from "./TyreBadge";
import { PositionNumber } from "./PositionNumber";

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
  positionChanges: Record<number, "up" | "down">;
  overallBest: number;
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
  positionChanges,
  overallBest,
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
  const tyre = stint ? (TYRE_COLORS[stint.compound] ?? TYRE_COLORS.UNKNOWN) : null;
  const teamColor = teamHex(driver?.team_colour);
  const tyreAge = stint ? maxLap - stint.lap_start + 1 + stint.tyre_age_at_start : null;
  const isFastestLap = bestLap !== undefined && bestLap > 0 && bestLap === overallBest;
  const lapDuration = lastLap?.lap_duration ?? null;
  const isBestForDriver = lapDuration !== null && lapDuration === bestLap;
  const pitDuration = lastPitMap.get(pos.driver_number)?.pit_duration;
  const hasDrs = drsDriver === pos.driver_number && drsActive;

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
        padding: "5px 10px 5px 14px",
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.5em",
              color: "#ffb800",
              textShadow: "0 0 30px rgba(255,185,0,1), 0 0 60px rgba(255,185,0,0.5)",
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

      {/* Tyre compound badge */}
      <div className="flex items-center justify-center">
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
      </div>

      {/* Driver name + badges */}
      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        <span
          className="truncate min-w-0"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.025em",
            color: isLeader ? "#ffd600" : isSelected ? "#ffffff" : "#d1d5db",
          }}
        >
          {driver?.name_acronym ?? "???"}
        </span>
        {activeBadges.map((v) => (
          <StatusBadge key={v} variant={v} />
        ))}
      </div>

      {/* Gap to leader — crossfades with pit duration on pit exit */}
      <div className="text-right" style={{ position: "relative" }}>
        <span
          data-gap-text={pos.driver_number}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            fontWeight: isLeader ? 700 : 400,
            letterSpacing: "-0.03em",
            color: isLeader ? "#ffd600" : "#4b5563",
            display: "block",
          }}
        >
          {isLeader ? "LEAD" : formatGap(interval?.gap_to_leader ?? null)}
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

      {/* Interval [expanded] */}
      <div className="driver-detail justify-end">
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            color: "#6b7280",
            letterSpacing: "-0.02em",
          }}
        >
          {isLeader ? "—" : formatInterval(interval?.interval ?? null)}
        </span>
      </div>

      {/* Last lap [expanded] */}
      <div className="driver-detail justify-end">
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            fontWeight: isFastestLap || isBestForDriver ? 700 : 400,
            color: isFastestLap ? "#c084fc" : isBestForDriver ? "#22c55e" : "#6b7280",
            letterSpacing: "-0.02em",
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
      </div>

      {/* Tyre age [expanded] */}
      <div className="driver-detail justify-end">
        {tyreAge !== null && (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: tyreAge > 28 ? "#f97316" : tyreAge > 16 ? "#eab308" : "#6b7280",
            }}
          >
            {tyreAge}
          </span>
        )}
      </div>

      {/* Pit duration [expanded] */}
      <div className="driver-detail justify-end">
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "-0.02em",
            color: isJustOut ? "#22c55e" : "#6b7280",
          }}
        >
          {pitDuration != null ? `${pitDuration.toFixed(1)}s` : "—"}
        </span>
      </div>
    </div>
  );
}
