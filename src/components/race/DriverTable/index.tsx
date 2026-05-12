import { useMemo, useRef, useState } from "react";
import { useCarData } from "../../../hooks/useCarData";
import type {
  Driver,
  Position,
  Interval,
  Lap,
  Stint,
  Pit,
  OvertakeEvent,
} from "../../../types";
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
  currentlap: number | null;
  totalLaps: number | null;
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
  currentlap,
  totalLaps,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayPositions, setDisplayPositions] =
    useState<Position[]>(positions);

  const { latest: carLatest } = useCarData(
    sessionKey,
    selectedDriver,
    sessionDateEnd,
  );
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
      if (!existing || s.stint_number > existing.stint_number)
        m.set(s.driver_number, s);
    });
    return m;
  }, [stints]);

  const lapMap = useMemo(() => {
    const m = new Map<number, Lap>();
    laps.forEach((l) => {
      const existing = m.get(l.driver_number);
      if (!existing || l.lap_number > existing.lap_number)
        m.set(l.driver_number, l);
    });
    return m;
  }, [laps]);

  const bestLapMap = useMemo(() => {
    const m = new Map<number, number>();
    laps.forEach((l) => {
      if (l.lap_duration === null) return;
      const current = m.get(l.driver_number);
      if (current === undefined || l.lap_duration < current)
        m.set(l.driver_number, l.lap_duration);
    });
    return m;
  }, [laps]);

  // Best S1/S2/S3 per driver across all laps
  const bestSectorMap = useMemo(() => {
    const m = new Map<
      number,
      { s1: number | null; s2: number | null; s3: number | null }
    >();
    laps.forEach((l) => {
      const cur = m.get(l.driver_number) ?? { s1: null, s2: null, s3: null };
      m.set(l.driver_number, {
        s1:
          l.duration_sector_1 !== null &&
          (cur.s1 === null || l.duration_sector_1 < cur.s1)
            ? l.duration_sector_1
            : cur.s1,
        s2:
          l.duration_sector_2 !== null &&
          (cur.s2 === null || l.duration_sector_2 < cur.s2)
            ? l.duration_sector_2
            : cur.s2,
        s3:
          l.duration_sector_3 !== null &&
          (cur.s3 === null || l.duration_sector_3 < cur.s3)
            ? l.duration_sector_3
            : cur.s3,
      });
    });
    return m;
  }, [laps]);

  // Overall fastest sector times across all drivers
  const overallBestSectors = useMemo(() => {
    let s1: number | null = null,
      s2: number | null = null,
      s3: number | null = null;
    bestSectorMap.forEach((v) => {
      if (v.s1 !== null && (s1 === null || v.s1 < s1)) s1 = v.s1;
      if (v.s2 !== null && (s2 === null || v.s2 < s2)) s2 = v.s2;
      if (v.s3 !== null && (s3 === null || v.s3 < s3)) s3 = v.s3;
    });
    return { s1, s2, s3 };
  }, [bestSectorMap]);

  const lastPitMap = useMemo(() => {
    const m = new Map<number, Pit>();
    pits.forEach((p) => {
      if (p.pit_duration === null) return;
      const cur = m.get(p.driver_number);
      if (!cur || p.lap_number > cur.lap_number) m.set(p.driver_number, p);
    });
    return m;
  }, [pits]);

  const pitCountMap = useMemo(() => {
    const m = new Map<number, number>();
    pits.forEach((p) => {
      if (p.pit_duration === null) return;
      m.set(p.driver_number, (m.get(p.driver_number) ?? 0) + 1);
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
      if (lap.is_pit_out_lap && lap.lap_number >= maxLap - 1)
        m.set(dn, "just_out");
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
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-auto min-h-0"
      >
        <div className="driver-table-wrapper">
          <div
            className="driver-row driver-header-row"
            style={{ padding: "4px 8px 4px 12px" }}
          >
            <div />
            {/* <div className="driver-name-cell driver-col-label">p</div> */}
            <div className="driver-col-label" style={{ textAlign: "center" }}>
              TYR
            </div>
            <div className="driver-name-cell driver-col-label">DRIVER</div>
            <div className="driver-col-label driver-gap-cell">
              GAP
            </div>
            <div className="driver-detail driver-col-label justify-end">
              INT
            </div>
            <div className="driver-detail driver-col-label justify-end">
              TIME
            </div>
            <div className="driver-detail driver-col-label justify-end">
              PIT
            </div>
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
              pitCountMap={pitCountMap}
              positionChanges={positionChanges}
              overallBest={overallBest}
              overallBestSectors={overallBestSectors}
              bestSectorMap={bestSectorMap}
              maxLap={maxLap}
              selectedDriver={selectedDriver}
              drsDriver={drsDriver}
              drsActive={drsActive}
              onSelectDriver={onSelectDriver}
              currentlap={currentlap}
              totalLaps={totalLaps}
              isLast={idx === displayPositions.length - 1}
            />
          ))}
        </div>
        {/* end inline-block wrapper */}

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
