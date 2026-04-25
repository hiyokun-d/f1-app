import { useMemo, useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useRaceData } from "../hooks/useRaceData";
import { useCarData } from "../hooks/useCarData";
import { useTrackMap } from "../hooks/useTrackMap";
import { useRaceReplay } from "../hooks/useRaceReplay";
import { openF1 } from "../api/openf1";
import type { Session, Position, Interval, OvertakeEvent } from "../types";

import Header from "../components/race/Header";
import TrackMap from "../components/race/TrackMap";
import ReplayControls from "../components/race/ReplayControls";
import StandingsPanel from "../components/race/panels/StandingsPanel";
import TelemetryPanel from "../components/race/panels/TelemetryPanel";
import RcTickerPanel from "../components/race/panels/RcTickerPanel";
import OvertakeBanner from "../components/race/panels/OvertakeBanner";

// Fixed layout heights (px)
const HEADER_H = 48;
const REPLAY_H = 53;
const TICKER_H = 32;

export default function Race() {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const key = Number(sessionKey);

  if (!key || isNaN(key)) return <Navigate to="/" replace />;

  // ── Panel widths (resizable) ─────────────────────────────────────────────
  const [leftW, setLeftW] = useState(340);
  const [rightW, setRightW] = useState(290);

  // ── Session ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    openF1
      .sessions({ session_key: key })
      .then((res) => {
        if (res[0]) setSession(res[0]);
      })
      .catch(() => {});
  }, [key]);

  const sessionDateEnd = session?.date_end ?? null;
  const sessionDateStart = session?.date_start ?? null;

  // ── Data hooks ───────────────────────────────────────────────────────────
  const race = useRaceData(key, sessionDateEnd);

  // ── Overtake banner state ────────────────────────────────────────────────
  const [activeBannerOvertake, setActiveBannerOvertake] =
    useState<OvertakeEvent | null>(null);
  useEffect(() => {
    if (race.overtakes.length > 0)
      setActiveBannerOvertake(race.overtakes[race.overtakes.length - 1]);
  }, [race.overtakes.length]);

  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const effectiveDriver =
    selectedDriver ?? race.positions[0]?.driver_number ?? null;

  const { latest: carLatest, history: carHistory } = useCarData(
    key,
    effectiveDriver,
    sessionDateEnd,
  );

  const driverNumbers = useMemo(
    () => race.drivers.map((d) => d.driver_number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [race.drivers.map((d) => d.driver_number).join(",")],
  );

  const trackMap = useTrackMap(
    key,
    driverNumbers,
    sessionDateStart,
    sessionDateEnd,
  );
  const replay = useRaceReplay(sessionDateStart, sessionDateEnd);
  const replayISO = replay.replayTime?.toISOString() ?? null;

  // ── Replay-filtered data ─────────────────────────────────────────────────
  const replayPositions = useMemo((): Position[] => {
    if (!replayISO || !race.allPositions.length) return race.positions;
    const map: Record<number, Position> = {};
    for (const p of race.allPositions) {
      if (
        p.date <= replayISO &&
        (!map[p.driver_number] || p.date > map[p.driver_number].date)
      )
        map[p.driver_number] = p;
    }
    return Object.values(map).sort((a, b) => a.position - b.position);
  }, [replayISO, race.allPositions, race.positions]);

  const replayIntervals = useMemo((): Interval[] => {
    if (!replayISO) return race.intervals;
    const map: Record<number, Interval> = {};
    for (const iv of race.intervals) {
      if (
        iv.date <= replayISO &&
        (!map[iv.driver_number] || iv.date > map[iv.driver_number].date)
      )
        map[iv.driver_number] = iv;
    }
    return Object.values(map);
  }, [replayISO, race.intervals]);

  const replayLaps = useMemo(
    () =>
      replayISO
        ? race.laps.filter((l) => l.date_start <= replayISO)
        : race.laps,
    [replayISO, race.laps],
  );

  const replayPits = useMemo(
    () =>
      replayISO ? race.pits.filter((p) => p.date <= replayISO) : race.pits,
    [replayISO, race.pits],
  );

  const replayStints = useMemo(
    () =>
      replayISO
        ? race.stints.filter((s) =>
            replayLaps.some(
              (l) =>
                l.driver_number === s.driver_number &&
                l.lap_number >= s.lap_start,
            ),
          )
        : race.stints,
    [replayISO, race.stints, replayLaps],
  );

  const replayRaceControl = useMemo(
    () =>
      replayISO
        ? race.raceControl.filter((r) => r.date <= replayISO)
        : race.raceControl,
    [replayISO, race.raceControl],
  );

  const replayTeamRadio = useMemo(
    () =>
      replayISO
        ? race.teamRadio.filter((r) => r.date <= replayISO)
        : race.teamRadio,
    [replayISO, race.teamRadio],
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const currentLap = replayLaps.reduce((m, l) => Math.max(m, l.lap_number), 0);

  const bannerOvertakingDriver = activeBannerOvertake
    ? race.drivers.find(
        (d) => d.driver_number === activeBannerOvertake.overtakingDriver,
      )
    : null;
  const bannerOvertakenDriver = activeBannerOvertake
    ? race.drivers.find(
        (d) => d.driver_number === activeBannerOvertake.overtakenDriver,
      )
    : null;

  const drsActive = (carLatest?.drs ?? 0) >= 10;

  const selectedDriverObj = race.drivers.find(
    (d) => d.driver_number === effectiveDriver,
  );

  const selectedStint = useMemo(() => {
    if (!effectiveDriver) return undefined;
    return replayStints
      .filter((s) => s.driver_number === effectiveDriver)
      .reduce<
        (typeof race.stints)[0] | undefined
      >((best, s) => (!best || s.stint_number > best.stint_number ? s : best), undefined);
  }, [replayStints, effectiveDriver]);

  const selectedLastLap = useMemo(() => {
    if (!effectiveDriver) return undefined;
    return replayLaps
      .filter((l) => l.driver_number === effectiveDriver)
      .reduce<
        (typeof race.laps)[0] | undefined
      >((best, l) => (!best || l.lap_number > best.lap_number ? l : best), undefined);
  }, [replayLaps, effectiveDriver]);

  // ── Panel geometry ───────────────────────────────────────────────────────
  const panelTop = HEADER_H;
  const panelBottom = REPLAY_H + TICKER_H;

  // ── Loading / error states ───────────────────────────────────────────────
  if (race.loading) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "#06070a" }}
      >
        <div className="w-8 h-8 border-2 border-[#e8002d] border-t-transparent rounded-full animate-spin" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            color: "#4b5563",
            letterSpacing: "0.2em",
          }}
        >
          LOADING SESSION {key}
        </span>
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
        <Link to="/" className="text-[#4b5563] text-xs underline">
          ← Back
        </Link>
      </div>
    );
  }

  const sessionName = session
    ? `${session.country_name} — ${session.session_name}`
    : `Session ${key}`;
  const sessionType = session?.session_type ?? "";
  const sessionLocation =
    session?.circuit_short_name ?? session?.location ?? "";

  return (
    <div
      className="h-screen overflow-hidden relative"
      style={{ background: "#06070a" }}
    >
      {/* ── Layer 0: Full-screen track map ────────────────────────────── */}
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

      {/* ── Layer 3: Header ───────────────────────────────────────────── */}
      {/* <div className="relative z-30" style={{ height: HEADER_H }}> */}
      {/*   <Header */}
      {/*     sessionName={sessionName} */}
      {/*     sessionType={sessionType} */}
      {/*     location={sessionLocation} */}
      {/*     currentLap={currentLap} */}
      {/*     totalLaps={0} */}
      {/*     weather={race.weather} */}
      {/*     raceControl={replayRaceControl} */}
      {/*   /> */}
      {/* </div> */}

      {/* ── Layer 4: Overtake banner ──────────────────────────────────── */}
      {activeBannerOvertake &&
        bannerOvertakingDriver &&
        bannerOvertakenDriver && (
          <OvertakeBanner
            overtake={activeBannerOvertake}
            overtakingDriver={bannerOvertakingDriver}
            overtakenDriver={bannerOvertakenDriver}
            headerHeight={HEADER_H}
            onDismiss={() => setActiveBannerOvertake(null)}
          />
        )}

      {/* ── Layer 2: Left panel — Standings ──────────────────────────── */}
      <StandingsPanel
        top={panelTop}
        bottom={panelBottom}
        width={leftW}
        onWidthChange={setLeftW}
        positions={replayPositions}
        drivers={race.drivers}
        intervals={replayIntervals}
        laps={replayLaps}
        stints={replayStints}
        pits={replayPits}
        positionChanges={race.positionChanges}
        selectedDriver={effectiveDriver}
        onSelectDriver={setSelectedDriver}
        hasError={!!race.error}
        recentOvertakes={race.overtakes}
        drsDriver={effectiveDriver}
        drsActive={drsActive}
      />

      {/* ── Layer 2: Right panel — Telemetry + Radio ─────────────────── */}
      {/* <TelemetryPanel */}
      {/*   top={panelTop} */}
      {/*   bottom={panelBottom} */}
      {/*   width={rightW} */}
      {/*   onWidthChange={setRightW} */}
      {/*   driver={selectedDriverObj} */}
      {/*   latest={carLatest} */}
      {/*   history={carHistory} */}
      {/*   lastLap={selectedLastLap} */}
      {/*   currentStint={selectedStint} */}
      {/*   radio={replayTeamRadio} */}
      {/*   drivers={race.drivers} */}
      {/*   selectedDriver={effectiveDriver} */}
      {/* /> */}

      {/* ── Layer 2: Bottom ticker — Race control ─────────────────────── */}
      <RcTickerPanel
        messages={replayRaceControl}
        left={leftW}
        right={rightW}
        bottom={REPLAY_H}
        height={TICKER_H}
      />

      {/* ── Layer 3: Replay controls ──────────────────────────────────── */}
      <div className="absolute z-30 bottom-0 left-0 right-0">
        <ReplayControls {...replay} />
      </div>
    </div>
  );
}
