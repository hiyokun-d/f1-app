import { useMemo, useRef, useState } from "react";
import { useCarData } from "../../../hooks/useCarData";
import type { Driver, Position, Interval, Lap, Stint, Pit, OvertakeEvent } from "../../../types";
import { useDriverTableAnimations } from "./useDriverTableAnimations";
import { DriverRow } from "./DriverRow";

interface Props {
  sessionKey: number;
  sessionDateEnd: string | null;
  positions: Position[];
  drivers: Driver[];
  intervals: Interval[];
  laps: Lap[];
  stints: Stint[];
  pits: Pit[];
  positionChanges: Record<number, "up" | "down">;
  selectedDriver: number | null;
  onSelectDriver: (dn: number) => void;
  recentOvertakes?: OvertakeEvent[];
}

export default function DriverTable({
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
  recentOvertakes,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayPositions, setDisplayPositions] = useState<Position[]>(positions);

  const { latest: carLatest } = useCarData(sessionKey, selectedDriver, sessionDateEnd);
  const drsActive = (carLatest?.drs ?? 0) >= 10;
  const drsDriver = selectedDriver;

  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.driver_number, d])),
    [drivers],
  );

  const intervalMap = useMemo(
    () => new Map(intervals.map((i) => [i.driver_number, i])),
    [intervals],
  );

  const stintMap = useMemo(() => {
    const m = new Map<number, Stint>();
    stints.forEach((s) => {
      const existing = m.get(s.driver_number);
      if (!existing || s.stint_number > existing.stint_number) m.set(s.driver_number, s);
    });
    return m;
  }, [stints]);

  const lapMap = useMemo(() => {
    const m = new Map<number, Lap>();
    laps.forEach((l) => {
      const existing = m.get(l.driver_number);
      if (!existing || l.lap_number > existing.lap_number) m.set(l.driver_number, l);
    });
    return m;
  }, [laps]);

  const bestLapMap = useMemo(() => {
    const m = new Map<number, number>();
    laps.forEach((l) => {
      if (l.lap_duration === null) return;
      const current = m.get(l.driver_number);
      if (current === undefined || l.lap_duration < current) m.set(l.driver_number, l.lap_duration);
    });
    return m;
  }, [laps]);

  const lastPitMap = useMemo(() => {
    const m = new Map<number, Pit>();
    pits.forEach((p) => {
      if (p.pit_duration === null) return;
      const cur = m.get(p.driver_number);
      if (!cur || p.lap_number > cur.lap_number) m.set(p.driver_number, p);
    });
    return m;
  }, [pits]);

  const maxLap = useMemo(
    () => laps.reduce((m, l) => Math.max(m, l.lap_number), 0),
    [laps],
  );

  const overallBest = useMemo(
    () => Math.min(...Array.from(bestLapMap.values()).filter((v) => v > 0)),
    [bestLapMap],
  );

  const pitStatusMap = useMemo(() => {
    const m = new Map<number, "pitting" | "just_out">();
    lapMap.forEach((lap, dn) => {
      if (lap.is_pit_out_lap && lap.lap_number >= maxLap - 1) m.set(dn, "just_out");
    });
    pits.forEach((p) => {
      if (p.lap_number < maxLap - 1) return;
      if (m.get(p.driver_number) === "just_out") return;
      if (p.pit_duration === null) {
        m.set(p.driver_number, "pitting");
      } else {
        const latestLap = lapMap.get(p.driver_number);
        if (!latestLap?.is_pit_out_lap) m.set(p.driver_number, "pitting");
      }
    });
    return m;
  }, [laps, pits, lapMap, maxLap]); // eslint-disable-line react-hooks/exhaustive-deps

  useDriverTableAnimations({
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
  });

  return (
    <div className="h-full flex flex-col" style={{ background: "transparent" }}>
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="driver-row driver-header-row" style={{ padding: "4px 8px 4px 12px" }}>
          <div />
          <div className="driver-col-label" style={{ textAlign: "center" }}>TYR</div>
          <div className="driver-col-label">DRIVER</div>
          <div className="driver-col-label" style={{ textAlign: "right" }}>GAP</div>
          <div className="driver-detail driver-col-label justify-end">INT</div>
          <div className="driver-detail driver-col-label justify-end">TIME</div>
          <div className="driver-detail driver-col-label justify-end">PIT</div>
        </div>

        {displayPositions.map((pos, idx) => (
          <DriverRow
            key={pos.driver_number}
            pos={pos}
            idx={idx}
            driverMap={driverMap}
            intervalMap={intervalMap}
            stintMap={stintMap}
            lapMap={lapMap}
            bestLapMap={bestLapMap}
            lastPitMap={lastPitMap}
            pitStatusMap={pitStatusMap}
            positionChanges={positionChanges}
            overallBest={overallBest}
            maxLap={maxLap}
            selectedDriver={selectedDriver}
            drsDriver={drsDriver}
            drsActive={drsActive}
            onSelectDriver={onSelectDriver}
          />
        ))}

        {positions.length === 0 && (
          <div className="flex items-center justify-center h-24">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                color: "#2a2d35",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              Waiting for data
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
