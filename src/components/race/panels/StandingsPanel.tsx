import type {
  Driver,
  Position,
  Interval,
  Lap,
  Stint,
  Pit,
  OvertakeEvent,
} from "../../../types";
import DriverTable from "../DriverTable/index";
import ResizeHandle from "../ResizeHandle";

interface Props {
  // Layout
  top: number;
  bottom: number;
  width: number;
  onWidthChange: (w: number) => void;
  // Session
  sessionKey: number;
  sessionDateEnd: string | null;
  // Data
  positions: Position[];
  drivers: Driver[];
  intervals: Interval[];
  laps: Lap[];
  stints: Stint[];
  pits: Pit[];
  positionChanges: Record<number, "up" | "down">;
  selectedDriver: number | null;
  onSelectDriver: (dn: number) => void;
  hasError?: boolean;
  recentOvertakes?: OvertakeEvent[];
}

export default function StandingsPanel({
  top,
  bottom,
  width,
  onWidthChange,
  sessionKey,
  sessionDateEnd,
  positions,
  drivers,
  intervals,
  laps,
  stints,
  pits,
  positionChanges,
  selectedDriver,
  onSelectDriver,
  hasError,
  recentOvertakes,
}: Props) {
  return (
    <div
      className="absolute z-20 flex flex-col overflow-hidden"
      style={{
        top,
        bottom,
        left: 0,
        width,
        background: "rgba(5,6,9,0.92)",
        backdropFilter: "blur(6px)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Panel header */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-1.5"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(232,0,45,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-0.5 h-3 rounded-full"
            style={{ background: "#e8002d" }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 9,
              fontWeight: 800,
              color: "#e8002d",
              letterSpacing: "0.25em",
            }}
          >
            STANDINGS
          </span>
        </div>
        {hasError && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 9,
              color: "#f97316",
            }}
          >
            ⚠ polling error
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DriverTable
          sessionKey={sessionKey}
          sessionDateEnd={sessionDateEnd}
          positions={positions}
          drivers={drivers}
          intervals={intervals}
          laps={laps}
          stints={stints}
          pits={pits}
          positionChanges={positionChanges}
          selectedDriver={selectedDriver}
          onSelectDriver={onSelectDriver}
          recentOvertakes={recentOvertakes}
        />
      </div>

      {/* Drag handle on right edge */}
      <ResizeHandle
        side="left"
        currentWidth={width}
        onResize={onWidthChange}
        minWidth={260}
        maxWidth={660}
      />
    </div>
  );
}
