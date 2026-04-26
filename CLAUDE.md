# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev      # start dev server (hot reload)
bun run build    # tsc + vite build
bun run lint     # eslint
```

No test suite exists. Type-check only: `npx tsc --noEmit`.

## Architecture

### Data flow

`Race.tsx` is the orchestration layer. It:
1. Fetches session metadata, then delegates to four hooks
2. Filters every data array through `replayISO` (a timestamp from `useRaceReplay`) before passing to panels
3. Passes filtered slices down to `StandingsPanel` → `DriverTable` and the other panel components

All data comes from the OpenF1 public API (`src/api/openf1.ts`):
- Serial request queue with 800ms gap to stay under the 30 req/min limit
- 60s response cache to survive React Strict Mode double-mounts and back-navigation

### Hooks

| Hook | Purpose | Poll interval |
|---|---|---|
| `useRaceData` | All race state (positions, laps, stints, pits, intervals, overtakes, RC, radio, weather) | 15s live / 0 historical |
| `useCarData` | High-freq telemetry (speed, RPM, gear, DRS, throttle, brake) for selected driver | 8s live / once historical |
| `useTrackMap` | Track outline (sampled from `/location`) + live driver positions | 10s live / once historical |
| `useRaceReplay` | Playback clock — `replayTime: Date` advances at configurable speed (1×–60×) via 250ms tick | n/a |

"Historical" = `sessionDateEnd` more than 1 hour ago. Historical sessions fetch a fixed time window (e.g. first 10 min for track outline, last 15s for positions) and don't re-poll.

### Replay filtering

`Race.tsx` derives `replayISO` from `replay.replayTime.toISOString()`. Every data array (`replayPositions`, `replayLaps`, `replayPits`, etc.) is filtered inside `useMemo` blocks to only include records where `record.date <= replayISO`. The panels receive these filtered slices — they are unaware of replay mode.

### Overtake detection

`detectOvertakes()` in `useRaceData` compares previous vs. new `Position[]` snapshots on each poll, emits `OvertakeEvent[]` that accumulate in `state.overtakes` (capped at 50). `Race.tsx` watches `race.overtakes.length` and surfaces the latest event in `activeBannerOvertake` state, which drives `OvertakeBanner`.

### Animation system (AnimeJS v4.3.6)

All animations use AnimeJS. Key patterns in this codebase:

- **`createScope({ root })`** — scopes class-selector queries to a subtree; call `.revert()` in `useEffect` cleanup
- **`createLayout(root, options)`** — FLIP-style layout animation; `layout.update(callback)` mutates the DOM (e.g. class toggle) and animates between pre/post positions. Used in `DriverTable` for compact→expanded grid transition via `ResizeObserver` at 380px breakpoint
- **`animate(el, { ... })`** — direct element animation. Use explicit `[from, to]` arrays for `backgroundColor` — `"transparent"` is not parseable, use `"rgba(0,0,0,0)"`
- **`stagger(ms)`** — delays across multiple elements

`DriverTable` runs its pit/overtake/DRS animation effects on every render (no dep array or length-based dep) and diffs against `prevPitRef`/`prevOvertakesLenRef`/`prevDrsRef` to fire only on transitions.

### CSS grid layout

`index.css` owns the driver table grid. Two modes toggled by `.driver-table-expanded` on the container:
- Compact: `28px 42px 1fr 72px` (pos, tyre, name, gap)
- Expanded: `28px 42px 1fr 28px 68px 56px 72px 26px` (+ tyre age, interval, last lap, pit count)

Columns tagged `.driver-detail` are `display: none` until `.driver-table-expanded` is present.

Row overlay stacking uses `isolation: isolate` on each row + `z-index: -1` on the pit/overtake color overlay divs, placing them behind content but above the row's own gradient background.

### Pit detection (two paths)

- **Live**: `pit_duration === null` in the pits array
- **Replay/historical**: pit entry on a recent lap (`lap_number >= maxLap - 1`) with a non-null duration AND the driver's latest lap does NOT have `is_pit_out_lap: true`

### DRS values

`CarData.drs`: `0` = off, `8` = available (detection zone), `10` / `12` = open/active. `drsActive = carLatest?.drs >= 10`.

### Vite proxy

Team radio audio files are served via `/f1-audio` proxy (`vite.config.ts`) to bypass CORS from `livetiming.formula1.com`.

### Currently commented-out components

`Header` and `TelemetryPanel` are wired up in `Race.tsx` but JSX-commented out. Their props and data derivation are still present.

### Coming-soon / WIP screen

`Race.tsx` currently returns `<ComingSoon />` from `src/components/race/ComingSoon.tsx` — the full race UI panels are not yet assembled. `ComingSoon` is a standalone screen (canvas sparks, glitch title, fake telemetry, radio cycler, standings + sector side panels, bottom ticker). When the real race layout is ready, replace the single `return <ComingSoon />;` line at the bottom of `Race.tsx`.

### TODO tracking

`TODO.md` at repo root tracks what is done, in progress, and next. Update it when finishing features or discovering new work.
