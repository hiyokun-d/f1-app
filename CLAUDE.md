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

**React/AnimeJS ownership rule**: Never put animated CSS properties in React's `style` prop. Use a CSS class for base/resting state (e.g. `.rail-arrow { opacity: 0 }`) and let AnimeJS own the inline style. If React's `style={}` includes the same property, every re-render resets what AnimeJS set.

### Left-rail event system (DriverTable)

Each driver row has a `data-team-rail` div (2px wide, team color) that expands temporarily to signal events. AnimeJS owns `width`. Never set width in React style prop.

| `data-*` attribute | Event | Color | Animation |
|---|---|---|---|
| `data-rail-pos` | Position change ▲▼ | green/red | expand 40px, icon fade in at 80ms, out at 1320ms, shrink at 1500ms |
| `data-rail-pit` | Pit in lane P | amber | (wired up, not yet animated — TODO) |
| `data-rail-out` | Pit exit ↑ | green | (wired up, not yet animated — TODO) |
| `data-rail-fl` | Fastest lap ★ | purple | expand 22px, star fades, shrink at 3000ms |
| `data-rail-drs` | DRS open | green sweep | scaleY 0→1 from bottom, CSS breathe pulse while active |

Rail contents stack: team-color bg → `rgba(0,0,0,0.4)` dark overlay → DRS sweep → icons (icons always on top, dark textShadow ensures readability on any team color).

### Position changes — replay vs live

`race.positionChanges` (from `useRaceData`) only fires during live polling. For replay mode, `Race.tsx` derives `replayPositionChanges` by diffing `replayPositions` on each update and passes it as `positionChanges` to `StandingsPanel` → `DriverTable`. The clear timer runs for 2000ms.

### FLIP row reorder animation

When `positionChanges` has entries, `DriverTable` delays `setDisplayPositions` by 400ms (shows rail/arrow first). Before the delay fires, it snapshots each row's `getBoundingClientRect().top` into `rowPositionsRef`. A `useLayoutEffect` on `displayPositions` reads the new positions, computes `delta = prevTop - newTop`, and animates `translateY: [delta, 0]` so rows appear to slide from their old position.

### CSS grid layout

`index.css` owns the driver table grid. Two modes toggled by `.driver-table-expanded` on the container:
- Compact: `28px 38px 1fr 76px` (pos, tyre, name, gap)
- Expanded: `28px 38px 42px 62px 48px 58px 20px 42px` (+ gap, int, lap, age, pit_dur)

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
