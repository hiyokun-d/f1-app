import { useMemo, useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useRaceData } from "../hooks/useRaceData";
import { useCarData } from "../hooks/useCarData";
import { useTrackMap } from "../hooks/useTrackMap";
import { useRaceReplay } from "../hooks/useRaceReplay";
import { useSession } from "../hooks/useSession";
import { useReplayFilter } from "../hooks/useReplayFilter";
import { useDriverTelemetryPrefetch } from "../hooks/useDriverTelemetryPrefetch";
import type { OvertakeEvent } from "../types";

import Header from "../components/race/Header";
import TrackMap from "../components/race/TrackMap";
import ReplayControls from "../components/race/ReplayControls";
import StandingsPanel from "../components/race/StandingsPanel";
import TelemetryPanel from "../components/race/TelemetryPanel";
import RcTicker from "../components/race/RcTicker";
import OvertakeBanner from "../components/race/OvertakeBanner";

export default function Race() {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const key = Number(sessionKey);

  if (!key || isNaN(key)) return <Navigate to="/" replace />;

  // ── Panel widths (resizable) ─────────────────────────────────────────────
  const [leftW, setLeftW] = useState(200);
  const [rightW, setRightW] = useState(290);

  // ── Session + data hooks ─────────────────────────────────────────────────
  const session = useSession(key);
  const sessionDateEnd = session?.date_end ?? null;
  const sessionDateStart = session?.date_start ?? null;

  const race = useRaceData(key, sessionDateEnd);
  const replay = useRaceReplay(sessionDateStart, sessionDateEnd);
  const replayISO = replay.replayTime?.toISOString() ?? null;
  const filtered = useReplayFilter(race, replayISO);

  // ── Overtake banner ──────────────────────────────────────────────────────
  const [activeBannerOvertake, setActiveBannerOvertake] =
    useState<OvertakeEvent | null>(null);
  useEffect(() => {
    if (race.overtakes.length > 0)
      setActiveBannerOvertake(race.overtakes[race.overtakes.length - 1]);
  }, [race.overtakes.length]);

  // ── Selected driver + car data ───────────────────────────────────────────
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const effectiveDriver =
    selectedDriver ?? race.positions[0]?.driver_number ?? null;
  const { latest: carLatest, history: carHistory, bufferEnd: carBufferEnd } = useCarData(
    key,
    effectiveDriver,
    sessionDateEnd,
    replay.replayTime,
  );

  useDriverTelemetryPrefetch(key, driverNumbers, effectiveDriver, sessionDateEnd, carBufferEnd);

  const bufferProgress = useMemo(() => {
    if (!carBufferEnd || !sessionDateStart || !sessionDateEnd) return 0
    const start = new Date(sessionDateStart).getTime()
    const end = new Date(sessionDateEnd).getTime()
    return Math.min(1, Math.max(0, (carBufferEnd.getTime() - start) / (end - start)))
  }, [carBufferEnd, sessionDateStart, sessionDateEnd])

  // ── Track map ─────────────────────────────────────────────────────────────
  const driverNumbers = useMemo(
    () => race.drivers.map((d) => d.driver_number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [race.drivers.map((d) => d.driver_number).join(",")],
  );
  const trackMap = useTrackMap(key, driverNumbers, sessionDateStart, sessionDateEnd);

  // ── Derived values ───────────────────────────────────────────────────────
  const currentLap = filtered.laps.reduce((m, l) => Math.max(m, l.lap_number), 0);

  const bestSectors = useMemo(() => {
    let s1: number | null = null, s2: number | null = null, s3: number | null = null;
    for (const l of filtered.laps) {
      if (l.duration_sector_1 !== null && (s1 === null || l.duration_sector_1 < s1)) s1 = l.duration_sector_1;
      if (l.duration_sector_2 !== null && (s2 === null || l.duration_sector_2 < s2)) s2 = l.duration_sector_2;
      if (l.duration_sector_3 !== null && (s3 === null || l.duration_sector_3 < s3)) s3 = l.duration_sector_3;
    }
    return { s1, s2, s3 };
  }, [filtered.laps]);

  const bannerOvertakingDriver = activeBannerOvertake
    ? race.drivers.find((d) => d.driver_number === activeBannerOvertake.overtakingDriver)
    : null;
  const bannerOvertakenDriver = activeBannerOvertake
    ? race.drivers.find((d) => d.driver_number === activeBannerOvertake.overtakenDriver)
    : null;

  const selectedDriverObj = race.drivers.find((d) => d.driver_number === effectiveDriver);

  const selectedStint = useMemo(() => {
    if (!effectiveDriver) return undefined;
    return filtered.stints
      .filter((s) => s.driver_number === effectiveDriver)
      .reduce<typeof race.stints[0] | undefined>(
        (best, s) => (!best || s.stint_number > best.stint_number ? s : best),
        undefined,
      );
  }, [filtered.stints, effectiveDriver]);

  const selectedLastLap = useMemo(() => {
    if (!effectiveDriver) return undefined;
    return filtered.laps
      .filter((l) => l.driver_number === effectiveDriver)
      .reduce<typeof race.laps[0] | undefined>(
        (best, l) => (!best || l.lap_number > best.lap_number ? l : best),
        undefined,
      );
  }, [filtered.laps, effectiveDriver]);

  const sessionName = session
    ? `${session.country_name} — ${session.session_name}`
    : `Session ${key}`;
  const sessionType = session?.session_type ?? "";
  const sessionLocation = session?.circuit_short_name ?? session?.location ?? "";

  // ── Loading / error states ───────────────────────────────────────────────
  if (race.loading) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center"
        style={{ background: "#06070a" }}
      >
        <div className="relative w-72 h-32 border-b border-l border-[#1a1a24] overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, #1a1a24 1px, transparent 1px), linear-gradient(to bottom, #1a1a24 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />
          <svg
            className="absolute w-full h-full opacity-40"
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
          >
            <path
              d="M0,40 C10,40 15,10 25,10 C35,10 40,30 50,30 C60,30 65,5 75,5 C85,5 90,35 100,35"
              fill="none" stroke="#ffffff" strokeWidth="0.5"
            />
            <path
              d="M0,45 L15,45 L15,35 L30,35 L30,25 L50,25 L50,40 L70,40 L70,20 L100,20"
              fill="none" stroke="#e8002d" strokeWidth="0.5"
            />
          </svg>
          <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-[#B15BE0] shadow-[0_0_12px_#B15BE0] animate-scan-load z-10" />
        </div>

        <div
          className="mt-4 flex w-72 justify-between"
          style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.05em" }}
        >
          <div className="flex flex-col text-left gap-1">
            <span className="text-[#00D2FF] font-bold">RX: RECEIVING PACKETS</span>
            <span className="text-[#4b5563]">OPENF1 API SYNC</span>
          </div>
          <div className="flex flex-col text-right gap-1">
            <span className="text-[#e8002d] animate-pulse">AWAITING TELEMETRY</span>
            <span className="text-[#4b5563]">SESSION {key}</span>
          </div>
        </div>
      </div>
    );
  }

  if (race.error && !race.drivers.length) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "#06070a" }}
      >
        <span className="text-[#e8002d] text-sm font-mono">{race.error}</span>
        <Link to="/" viewTransition className="text-[#4b5563] text-xs underline">← Back</Link>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: "#06070a" }}
    >
      {/* Background: full-screen track map */}
      <div className="absolute inset-0 z-0">
        <TrackMap
          outline={trackMap.outline}
          livePositions={trackMap.livePositions}
          drivers={race.drivers}
          selectedDriver={effectiveDriver}
          onSelectDriver={setSelectedDriver}
          sessionName={sessionName}
          ready={trackMap.ready}
        />
      </div>

      {/* Header */}
      <div className="relative z-30 shrink-0">
        <Header
          sessionName={sessionName}
          sessionType={sessionType}
          location={sessionLocation}
          currentLap={currentLap}
          totalLaps={race.totalLaps}
          weather={race.weather}
          raceControl={filtered.raceControl}
          sessionDateStart={sessionDateStart}
          sessionDateEnd={sessionDateEnd}
          replayTime={replay.replayTime}
          bestSectors={bestSectors}
        />
      </div>

      {/* Main row: panels flanking the track map */}
      <div className="relative z-20 flex flex-1 min-h-0">
        {/* Left: Standings */}
        <StandingsPanel
          width={leftW}
          onWidthChange={setLeftW}
          sessionKey={key}
          sessionDateEnd={sessionDateEnd}
          positions={filtered.positions}
          drivers={race.drivers}
          intervals={filtered.intervals}
          laps={filtered.laps}
          stints={filtered.stints}
          pits={filtered.pits}
          positionChanges={filtered.positionChanges}
          selectedDriver={effectiveDriver}
          onSelectDriver={setSelectedDriver}
          hasError={!!race.error}
          recentOvertakes={race.overtakes}
          currentlap={currentLap}
          totalLaps={race.totalLaps}
        />

        {/* Center spacer — track map shows through */}
        <div className="flex-1 relative">
          {activeBannerOvertake && bannerOvertakingDriver && bannerOvertakenDriver && (
            <OvertakeBanner
              overtake={activeBannerOvertake}
              overtakingDriver={bannerOvertakingDriver}
              overtakenDriver={bannerOvertakenDriver}
              onDismiss={() => setActiveBannerOvertake(null)}
            />
          )}
        </div>

        {/* Right: Telemetry + Radio */}
        <TelemetryPanel
          width={rightW}
          onWidthChange={setRightW}
          driver={selectedDriverObj}
          latest={carLatest}
          history={carHistory}
          lastLap={selectedLastLap}
          currentStint={selectedStint}
          radio={filtered.teamRadio}
          drivers={race.drivers}
          selectedDriver={effectiveDriver}
        />
      </div>

      {/* Bottom bar: RC ticker + replay controls */}
      <div className="relative z-30 shrink-0">
        <RcTicker messages={filtered.raceControl} />
        <ReplayControls {...replay} bufferProgress={bufferProgress} />
      </div>
    </div>
  );
}
