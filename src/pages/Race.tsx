import { useMemo, useState, useEffect, useRef } from "react";
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

// Fixed layout heights (px) — REPLAY_H / TICKER_H are stable; header is measured dynamically
const REPLAY_H = 53;
const TICKER_H = 32;

export default function Race() {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const key = Number(sessionKey);

  if (!key || isNaN(key)) return <Navigate to="/" replace />;

  // ── Panel widths (resizable) ─────────────────────────────────────────────
  const [leftW, setLeftW] = useState(200);
  const [rightW, setRightW] = useState(290);

  // ── Header height — measured dynamically so panels never overlap it ───────
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(64); // 64px initial estimate
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeaderH(Math.ceil(entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Derive position changes from replayPositions so the rail animation works in replay
  const prevReplayPositionsRef = useRef<Position[]>([]);
  const [replayPositionChanges, setReplayPositionChanges] = useState<
    Record<number, "up" | "down">
  >({});
  const changeClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prev = prevReplayPositionsRef.current;
    if (prev.length > 0) {
      const prevMap = new Map(prev.map((p) => [p.driver_number, p.position]));
      const changes: Record<number, "up" | "down"> = {};
      for (const p of replayPositions) {
        const old = prevMap.get(p.driver_number);
        if (old !== undefined && old !== p.position)
          changes[p.driver_number] = p.position < old ? "up" : "down";
      }
      if (Object.keys(changes).length > 0) {
        if (changeClearTimer.current) clearTimeout(changeClearTimer.current);
        setReplayPositionChanges(changes);
        changeClearTimer.current = setTimeout(
          () => setReplayPositionChanges({}),
          2000,
        );
      }
    }
    prevReplayPositionsRef.current = replayPositions;
  }, [replayPositions]);

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

  const bestSectors = useMemo(() => {
    let s1: number | null = null,
      s2: number | null = null,
      s3: number | null = null;
    replayLaps.forEach((l) => {
      if (
        l.duration_sector_1 !== null &&
        (s1 === null || l.duration_sector_1 < s1)
      )
        s1 = l.duration_sector_1;
      if (
        l.duration_sector_2 !== null &&
        (s2 === null || l.duration_sector_2 < s2)
      )
        s2 = l.duration_sector_2;
      if (
        l.duration_sector_3 !== null &&
        (s3 === null || l.duration_sector_3 < s3)
      )
        s3 = l.duration_sector_3;
    });
    return { s1, s2, s3 };
  }, [replayLaps]);

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
  const panelBottom = REPLAY_H + TICKER_H;

  // ── Loading / error states ───────────────────────────────────────────────
  if (race.loading) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center"
        style={{ background: "#06070a" }}
      >
        {/* Injecting a small custom animation for the telemetry scanner */}
        <style>
          {`
          @keyframes scan {
            0% { transform: translateX(0); }
            50% { transform: translateX(288px); }
            100% { transform: translateX(0); }
          }
          .animate-scan {
            animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
        `}
        </style>

        {/* The Telemetry Oscilloscope */}
        <div className="relative w-72 h-32 border-b border-l border-[#1a1a24] overflow-hidden">
          {/* Technical Grid Background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, #1a1a24 1px, transparent 1px), linear-gradient(to bottom, #1a1a24 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />

          {/* Fake Data Traces (Speed & Brake) */}
          <svg
            className="absolute w-full h-full opacity-40"
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
          >
            {/* Smooth Speed Trace */}
            <path
              d="M0,40 C10,40 15,10 25,10 C35,10 40,30 50,30 C60,30 65,5 75,5 C85,5 90,35 100,35"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            {/* Stepped Gear/Brake Trace */}
            <path
              d="M0,45 L15,45 L15,35 L30,35 L30,25 L50,25 L50,40 L70,40 L70,20 L100,20"
              fill="none"
              stroke="#e8002d"
              strokeWidth="0.5"
            />
          </svg>

          {/* The Scanning Playhead (Looks like it's reading live data) */}
          <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-[#B15BE0] shadow-[0_0_12px_#B15BE0] animate-scan z-10" />
        </div>

        {/* Terminal Readouts */}
        <div
          className="mt-4 flex w-72 justify-between"
          style={{
            fontFamily: "var(--font-data)", // Make sure to use your monospace/tech font here
            fontSize: 10,
            letterSpacing: "0.05em",
          }}
        >
          <div className="flex flex-col text-left gap-1">
            <span className="text-[#00D2FF] font-bold">
              RX: RECEIVING PACKETS
            </span>
            <span className="text-[#4b5563]">OPENF1 API SYNC</span>
          </div>

          <div className="flex flex-col text-right gap-1">
            <span className="text-[#e8002d] animate-pulse">
              AWAITING TELEMETRY
            </span>
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

      {/* ── Layer 3: Header — no fixed height; measured by ResizeObserver ── */}
      <div ref={headerRef} className="relative z-30">
        <Header
          sessionName={sessionName}
          sessionType={sessionType}
          location={sessionLocation}
          currentLap={currentLap}
          totalLaps={race.totalLaps}
          weather={race.weather}
          raceControl={replayRaceControl}
          sessionDateStart={sessionDateStart}
          sessionDateEnd={sessionDateEnd}
          replayTime={replay.replayTime}
          bestSectors={bestSectors}
        />
      </div>

      {/* ── Layer 4: Overtake banner ──────────────────────────────────── */}
      {activeBannerOvertake &&
        bannerOvertakingDriver &&
        bannerOvertakenDriver && (
          <OvertakeBanner
            overtake={activeBannerOvertake}
            overtakingDriver={bannerOvertakingDriver}
            overtakenDriver={bannerOvertakenDriver}
            headerHeight={headerH}
            onDismiss={() => setActiveBannerOvertake(null)}
          />
        )}

      {/* ── Layer 2: Left panel — Standings ──────────────────────────── */}
      <StandingsPanel
        top={headerH}
        bottom={panelBottom}
        width={leftW}
        onWidthChange={setLeftW}
        sessionKey={key}
        sessionDateEnd={sessionDateEnd}
        positions={replayPositions}
        drivers={race.drivers}
        intervals={replayIntervals}
        laps={replayLaps}
        stints={replayStints}
        pits={replayPits}
        positionChanges={replayPositionChanges}
        selectedDriver={effectiveDriver}
        onSelectDriver={setSelectedDriver}
        hasError={!!race.error}
        recentOvertakes={race.overtakes}
        currentlap={currentLap}
        totalLaps={race.totalLaps}
      />

      {/* ── Layer 2: Right panel — Telemetry + Radio ─────────────────── */}

      <TelemetryPanel
        top={headerH}
        bottom={panelBottom}
        width={rightW}
        onWidthChange={setRightW}
        driver={selectedDriverObj}
        latest={carLatest}
        history={carHistory}
        lastLap={selectedLastLap}
        currentStint={selectedStint}
        radio={replayTeamRadio}
        drivers={race.drivers}
        selectedDriver={effectiveDriver}
      />

      {/* ── Layer 2: Bottom ticker — Race control ─────────────────────── */}
      <RcTickerPanel
        messages={replayRaceControl}
        left={leftW}
        right={0}
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
