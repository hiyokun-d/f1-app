/**
 * useRaceSession — single unified hook covering all 15 OpenF1 data categories.
 *
 * Inputs: sessionKey, optional sessionDateEnd (ISO), optional driverNumber
 *
 * Criticality:
 *   CRASH  → sessions, drivers, positions, intervals, laps, carData, location
 *   NULL   → weather, stints, pits, raceControl, teamRadio (UI must handle null)
 *
 * Crash boundary usage:
 *   const race = useRaceSession(sessionKey, session.date_end, selectedDriver);
 *   if (race.error === "Crash") return <CrashScreen />;
 *
 * Sync key: race.lastSync — max date timestamp across all live records.
 *
 * Poll cadence (live only):
 *   8 s  → positions, intervals, carData, locations
 *   15 s → laps, stints, pits, raceControl, weather, teamRadio
 */

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { openF1 } from "../api/openf1";
import type {
  Meeting,
  Session,
  Driver,
  Position,
  Interval,
  Lap,
  Stint,
  Pit,
  CarData,
  Location,
  RaceControl,
  TeamRadio,
  Weather,
  Overtake,
  SessionResult,
  StartingGrid,
  ChampionshipDriver,
  ChampionshipTeam,
  OvertakeEvent,
} from "../types";

// ── Derived types ─────────────────────────────────────────────────────────────

/** Speed trap readings extracted from the latest completed lap per driver. */
export interface SpeedTrap {
  driver_number: number;
  lap_number: number;
  /** Speed at first intermediate detector (km/h) */
  i1_speed: number | null;
  /** Speed at second intermediate detector (km/h) */
  i2_speed: number | null;
  /** Speed at speed trap (km/h) */
  st_speed: number | null;
  date_start: string;
}

/** Transient position change fired on each poll; auto-clears after 2 s. */
export interface PositionChange {
  driver_number: number;
  from: number;
  to: number;
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface RaceSessionState {
  // ── Category 10 · Meetings & Sessions ─────────────────────────────────────
  // meeting_name, meeting_official_name, circuit_short_name, country_code,
  // country_name, location, gmt_offset, year
  meeting: Meeting | null;
  // session_name, location, session_type, date_start, date_end,
  // country_code, country_name, circuit_short_name, circuit_key
  session: Session | null;

  // ── Category 8 · Drivers ──────────────────────────────────────────────────
  // broadcast_name, driver_number, name_acronym, team_name, team_colour,
  // headshot_url, full_name, first_name, last_name, country_code
  drivers: Driver[];

  // ── Category 4 · Position & Intervals ─────────────────────────────────────
  positions: Position[];       // latest per driver (P1-P20)
  allPositions: Position[];    // full history — feed through replayISO filter
  intervals: Interval[];       // latest per driver (gap_to_leader, interval)
  allIntervals: Interval[];    // full history — feed through replayISO filter

  // ── Category 3 · Laps ─────────────────────────────────────────────────────
  // lap_number, lap_duration, duration_sector_1/2/3,
  // segments_sector_1/2/3, is_pit_out_lap, date_start
  laps: Lap[];                 // latest lap per driver
  allLaps: Lap[];              // all laps (strategy, replay, PB comparison)

  // ── Category 1 · Car Data ─────────────────────────────────────────────────
  // speed (km/h), rpm, n_gear, throttle (%), brake (%), drs
  carData: CarData | null;     // latest telemetry for driverNumber
  carDataHistory: CarData[];   // last 60 samples for driverNumber

  // ── Category 2 · Location ─────────────────────────────────────────────────
  // x, y, z — latest per driver (track map)
  locations: Location[];

  // ── Category 6 · Weather ─── non-essential ──────────────────────────────
  // air_temperature, track_temperature, rainfall, humidity, pressure,
  // wind_speed, wind_direction
  weather: Weather | null;

  // ── Category 5 · Pit & Stints ─── non-essential ─────────────────────────
  // pit: date, pit_duration, lap_number
  // stint: compound, tyre_age_at_start, lap_start, lap_end, stint_number
  stints: Stint[];
  pits: Pit[];

  // ── Category 7 · Race Control ─── non-essential ──────────────────────────
  // flag, track status, message, category, scope, sector, lap_number
  raceControl: RaceControl[];

  // ── Category 9 · Team Radio ─── non-essential ────────────────────────────
  // recording_url, date, driver_number
  teamRadio: TeamRadio[];

  // ── Session Result ─── non-essential ─────────────────────────────────────
  // final position, gap_to_leader, sector times — populated post-session
  sessionResult: SessionResult[];

  // ── Starting Grid ─── non-essential ──────────────────────────────────────
  // grid position, team_name per driver
  startingGrid: StartingGrid[];

  // ── Championship Standings ─── non-essential ─────────────────────────────
  // driver/team points and position in standings at time of this session
  championshipDrivers: ChampionshipDriver[];
  championshipTeams: ChampionshipTeam[];

  // ── Native Overtakes ─── non-essential ───────────────────────────────────
  // OpenF1 native overtake records (fastest vs slower driver_number, date)
  nativeOvertakes: Overtake[];

  // ── Category 11 · Speed Traps ─── derived from laps ──────────────────────
  // i1_speed (ID1), i2_speed (ID2), st_speed (ST) — latest per driver
  speedTraps: SpeedTrap[];

  // ── Category 12-13 · Advanced Strategy & Detailed RC ─────────────────────
  // is_pit_out_lap → in allLaps
  // tyre_age_at_start, stint_number, lap_start, lap_end → in stints
  // category, scope, sector → in raceControl

  // ── Computed ──────────────────────────────────────────────────────────────
  overtakes: OvertakeEvent[];         // accumulated, capped at 50
  positionChanges: PositionChange[];  // auto-clears after 2 s

  // ── Category 14 · Identity & Broadcast ───────────────────────────────────
  // country_code (3-letter) → session.country_code / driver.country_code
  // broadcast_name → driver.broadcast_name
  // circuit_short_name → session.circuit_short_name
  // All exposed via session + meeting + drivers above — no separate state needed.

  // ── Category 15 · Synchronization ────────────────────────────────────────
  /** Max date timestamp across all live records — master sync key. */
  lastSync: Date | null;

  // ── Meta ──────────────────────────────────────────────────────────────────
  loading: boolean;
  /** "Crash" = at least one critical endpoint hard-failed. Render crash UI. */
  error: "Crash" | string | null;
  isHistorical: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function sessionIsHistorical(sessionDateEnd?: string): boolean {
  if (!sessionDateEnd) return false;
  return Date.now() - new Date(sessionDateEnd).getTime() > 60 * 60 * 1000;
}

function latestPerDriver<T extends { driver_number: number; date: string }>(
  arr: T[]
): T[] {
  const map = new Map<number, T>();
  for (const item of arr) {
    const prev = map.get(item.driver_number);
    if (!prev || item.date > prev.date) map.set(item.driver_number, item);
  }
  return Array.from(map.values());
}

function latestLapPerDriver(laps: Lap[]): Lap[] {
  const map = new Map<number, Lap>();
  for (const lap of laps) {
    const prev = map.get(lap.driver_number);
    if (!prev || lap.lap_number > prev.lap_number) map.set(lap.driver_number, lap);
  }
  return Array.from(map.values());
}

function deriveSpeedTraps(laps: Lap[]): SpeedTrap[] {
  return latestLapPerDriver(laps).map((l) => ({
    driver_number: l.driver_number,
    lap_number: l.lap_number,
    i1_speed: l.i1_speed,
    i2_speed: l.i2_speed,
    st_speed: l.st_speed,
    date_start: l.date_start,
  }));
}

function detectOvertakes(
  prev: Position[],
  next: Position[],
  lapMap: Map<number, number>
): OvertakeEvent[] {
  if (!prev.length) return [];
  const prevMap = new Map(prev.map((p) => [p.driver_number, p.position]));
  const nextMap = new Map(next.map((p) => [p.driver_number, p]));
  const events: OvertakeEvent[] = [];

  for (const p of next) {
    const prevPos = prevMap.get(p.driver_number);
    if (prevPos !== undefined && prevPos > p.position) {
      // Find driver who now occupies the old position
      const displaced = next.find(
        (x) => x.driver_number !== p.driver_number && x.position === prevPos
      );
      if (displaced && nextMap.has(displaced.driver_number)) {
        events.push({
          overtakingDriver: p.driver_number,
          overtakenDriver: displaced.driver_number,
          newPosition: p.position,
          lapNumber: lapMap.get(p.driver_number) ?? 0,
          timestamp: p.date,
        });
      }
    }
  }
  return events;
}

function maxDateFromRecords(
  ...groups: Array<Array<{ date: string }>>
): Date | null {
  let max = "";
  for (const group of groups) {
    for (const item of group) {
      if (item.date > max) max = item.date;
    }
  }
  return max ? new Date(max) : null;
}

function isCriticalError(err: unknown): boolean {
  // Any network or HTTP error on a critical endpoint → Crash
  return axios.isAxiosError(err) || err instanceof Error;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const BLANK: RaceSessionState = {
  meeting: null,
  session: null,
  drivers: [],
  positions: [],
  allPositions: [],
  intervals: [],
  allIntervals: [],
  laps: [],
  allLaps: [],
  carData: null,
  carDataHistory: [],
  locations: [],
  weather: null,
  stints: [],
  pits: [],
  raceControl: [],
  teamRadio: [],
  sessionResult: [],
  startingGrid: [],
  championshipDrivers: [],
  championshipTeams: [],
  nativeOvertakes: [],
  speedTraps: [],
  overtakes: [],
  positionChanges: [],
  lastSync: null,
  loading: true,
  error: null,
  isHistorical: false,
};

// ── Poll cadence ──────────────────────────────────────────────────────────────

const FAST_MS = 8_000;     // positions, intervals, carData, locations
const STD_MS = 15_000;     // laps + all non-essential

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRaceSession(
  sessionKey: number,
  sessionDateEnd?: string,
  driverNumber?: number | null
): RaceSessionState {
  const [state, setState] = useState<RaceSessionState>(BLANK);
  const prevPositionsRef = useRef<Position[]>([]);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    const historical = sessionIsHistorical(sessionDateEnd);

    setState({ ...BLANK, isHistorical: historical });
    prevPositionsRef.current = [];

    // ── Date window builders ─────────────────────────────────────────────────

    function liveAfter(seconds: number) {
      return new Date(Date.now() - seconds * 1000).toISOString();
    }

    function historicalRange(offsetFromEndS: number, windowS: number) {
      if (!sessionDateEnd) return {};
      const end = new Date(sessionDateEnd).getTime();
      return {
        "date>": new Date(end - (offsetFromEndS + windowS) * 1000).toISOString(),
        "date<": new Date(end - offsetFromEndS * 1000).toISOString(),
      };
    }

    // ── Critical fetch ───────────────────────────────────────────────────────

    async function fetchCritical(fastOnly = false) {
      const base = { session_key: sessionKey };
      const posParams = historical ? historicalRange(0, 30) : { "date>": liveAfter(30) };
      const locParams = historical ? historicalRange(0, 15) : { "date>": liveAfter(5) };
      const carParams = historical ? historicalRange(0, 60) : { "date>": liveAfter(60) };

      try {
        if (fastOnly) {
          // Only high-frequency data
          const [posData, intData, carRaw, locData] = await Promise.all([
            openF1.positions({ ...base, ...posParams }),
            openF1.intervals({ ...base, ...posParams }),
            driverNumber != null
              ? openF1.carData({ ...base, driver_number: driverNumber, ...carParams })
              : Promise.resolve<CarData[]>([]),
            openF1.location({ ...base, ...locParams }),
          ]);

          if (!mounted) return;

          const nextPositions = latestPerDriver(posData);
          const lapMap = new Map(
            (prevPositionsRef.current.length
              ? prevPositionsRef.current
              : nextPositions
            ).map((p) => [p.driver_number, 0])
          );

          const newOvertakes = detectOvertakes(prevPositionsRef.current, nextPositions, lapMap);
          const changes: PositionChange[] = [];
          const prevMap = new Map(prevPositionsRef.current.map((p) => [p.driver_number, p.position]));
          for (const p of nextPositions) {
            const prev = prevMap.get(p.driver_number);
            if (prev !== undefined && prev !== p.position) {
              changes.push({ driver_number: p.driver_number, from: prev, to: p.position });
            }
          }
          if (changes.length) {
            if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
            changeTimerRef.current = setTimeout(() => {
              if (mounted) setState((s) => ({ ...s, positionChanges: [] }));
            }, 2000);
          }
          prevPositionsRef.current = nextPositions;

          const lastSync = maxDateFromRecords(posData, intData, locData, carRaw);

          setState((s) => ({
            ...s,
            positions: nextPositions,
            allPositions: posData,
            intervals: latestPerDriver(intData),
            allIntervals: intData,
            carData: carRaw.at(-1) ?? null,
            carDataHistory: carRaw.slice(-60),
            locations: latestPerDriver(locData),
            overtakes: newOvertakes.length
              ? [...s.overtakes, ...newOvertakes].slice(-50)
              : s.overtakes,
            positionChanges: changes.length ? changes : s.positionChanges,
            lastSync: lastSync ?? s.lastSync,
          }));
          return;
        }

        // Full critical fetch
        const [sessionData, driversData, posData, intData, lapsData, carRaw, locData] =
          await Promise.all([
            openF1.sessions({ session_key: sessionKey }),
            openF1.drivers(base),
            openF1.positions({ ...base, ...posParams }),
            openF1.intervals({ ...base, ...posParams }),
            openF1.laps(base),
            driverNumber != null
              ? openF1.carData({ ...base, driver_number: driverNumber, ...carParams })
              : Promise.resolve<CarData[]>([]),
            openF1.location({ ...base, ...locParams }),
          ]);

        if (!mounted) return;

        // Sessions and drivers are the two hard-crash guards
        if (!sessionData.length || !driversData.length) {
          setState((s) => ({ ...s, loading: false, error: "Crash" }));
          return;
        }

        // Fetch meeting metadata (non-blocking, uses session's meeting_key)
        const meetingKey = sessionData[0].meeting_key;
        openF1.meetings({ meeting_key: meetingKey })
          .then((m) => {
            if (mounted && m.length) setState((s) => ({ ...s, meeting: m[0] }));
          })
          .catch(() => {});

        const nextPositions = latestPerDriver(posData);
        const latestLaps = latestLapPerDriver(lapsData);
        const lapMap = new Map(latestLaps.map((l) => [l.driver_number, l.lap_number]));
        const newOvertakes = detectOvertakes(prevPositionsRef.current, nextPositions, lapMap);
        const changes: PositionChange[] = [];
        const prevMap = new Map(prevPositionsRef.current.map((p) => [p.driver_number, p.position]));
        for (const p of nextPositions) {
          const prev = prevMap.get(p.driver_number);
          if (prev !== undefined && prev !== p.position) {
            changes.push({ driver_number: p.driver_number, from: prev, to: p.position });
          }
        }
        if (changes.length) {
          if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
          changeTimerRef.current = setTimeout(() => {
            if (mounted) setState((s) => ({ ...s, positionChanges: [] }));
          }, 2000);
        }
        prevPositionsRef.current = nextPositions;

        const lastSync = maxDateFromRecords(posData, intData, locData, carRaw);

        setState((s) => ({
          ...s,
          session: sessionData[0],
          drivers: driversData,
          positions: nextPositions,
          allPositions: posData,
          intervals: latestPerDriver(intData),
          allIntervals: intData,
          laps: latestLaps,
          allLaps: lapsData,
          carData: carRaw.at(-1) ?? null,
          carDataHistory: carRaw.slice(-60),
          locations: latestPerDriver(locData),
          speedTraps: deriveSpeedTraps(lapsData),
          overtakes: newOvertakes.length
            ? [...s.overtakes, ...newOvertakes].slice(-50)
            : s.overtakes,
          positionChanges: changes.length ? changes : s.positionChanges,
          lastSync: lastSync ?? s.lastSync,
          loading: false,
          error: null,
          isHistorical: historical,
        }));
      } catch (err) {
        if (!mounted) return;
        if (isCriticalError(err)) {
          setState((s) => ({ ...s, loading: false, error: "Crash" }));
        }
      }
    }

    // ── Non-essential fetch ──────────────────────────────────────────────────

    async function fetchOptional() {
      const base = { session_key: sessionKey };

      async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
        try {
          return await fn();
        } catch {
          return [];
        }
      }

      const [
        weatherData,
        stintsData,
        pitsData,
        rcData,
        radioData,
        sessionResultData,
        startingGridData,
        champDriversData,
        champTeamsData,
        nativeOvertakesData,
      ] = await Promise.all([
        safe(() => openF1.weather(base)),
        safe(() => openF1.stints(base)),
        safe(() => openF1.pits(base)),
        safe(() => openF1.raceControl(base)),
        safe(() => openF1.teamRadio(base)),
        safe(() => openF1.sessionResult(base)),
        safe(() => openF1.startingGrid(base)),
        safe(() => openF1.championshipDrivers(base)),
        safe(() => openF1.championshipTeams(base)),
        safe(() => openF1.overtakes(base)),
      ]);

      if (!mounted) return;

      setState((s) => ({
        ...s,
        weather: weatherData.at(-1) ?? null,
        stints: stintsData,
        pits: pitsData,
        raceControl: rcData,
        teamRadio: radioData,
        sessionResult: sessionResultData,
        startingGrid: startingGridData,
        championshipDrivers: champDriversData,
        championshipTeams: champTeamsData,
        nativeOvertakes: nativeOvertakesData,
      }));
    }

    // ── Initial load ─────────────────────────────────────────────────────────

    fetchCritical(false).then(() => fetchOptional());

    if (historical) {
      return () => {
        mounted = false;
        if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      };
    }

    // ── Live polling ─────────────────────────────────────────────────────────

    fastRef.current = setInterval(() => fetchCritical(true), FAST_MS);
    stdRef.current = setInterval(() => {
      fetchCritical(false);
      fetchOptional();
    }, STD_MS);

    return () => {
      mounted = false;
      if (fastRef.current) clearInterval(fastRef.current);
      if (stdRef.current) clearInterval(stdRef.current);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    };
  }, [sessionKey, sessionDateEnd, driverNumber]);

  return state;
}
