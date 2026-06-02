# Race Center — F1 Live Tracker

Real-time Formula 1 race viewer built with React + TypeScript + Vite.  
Live standings, driver telemetry, track map, team radio playback, and full replay — all sourced from the [OpenF1 public API](https://openf1.org).

---

## Features

- **Live standings** — driver positions, gaps, intervals, tyre compounds, pit counts
- **Replay mode** — scrub through any historical session at 1×–60× speed
- **Track map** — live driver positions on the circuit outline
- **Telemetry** — speed, RPM, gear, DRS, throttle, brake for selected driver
- **Team radio** — audio playback per driver
- **Overtake banner** — animated callout on position changes
- **Race control ticker** — stewards messages and flags

---

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Routing | React Router v7 (View Transitions) |
| Animations | AnimeJS v4.3.6 |
| HTTP | Axios (serial queue, 60s cache) |
| Build | Vite 8, Bun |
| Data | [OpenF1 API](https://openf1.org) |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0 (or Node ≥ 20 + npm/pnpm)

### Install & run

```bash
git clone https://github.com/hiyokun-d/f1-app.git
cd f1-app
bun install
bun run dev        # http://localhost:5173
```

### Other commands

```bash
bun run build      # production build → dist/
bun run lint       # ESLint
npx tsc --noEmit   # type-check only (no test suite)
```

---

## Project Structure

```
src/
├── api/
│   └── openf1.ts          # API client — serial queue + 60s cache
├── components/
│   ├── race/
│   │   ├── DriverTable/   # Standings table (index, DriverRow, animations, badges)
│   │   ├── StandingsPanel.tsx
│   │   ├── TrackMap.tsx
│   │   ├── TelemetryPanel.tsx
│   │   ├── ReplayControls.tsx
│   │   ├── OvertakeBanner.tsx
│   │   ├── RcTicker.tsx
│   │   └── TeamRadioPlayer.tsx
│   └── ui/
│       ├── AnimatedValue.tsx   # Slot-machine number flip
│       └── GapDisplay.tsx      # Gap/interval formatting
├── hooks/
│   ├── useRaceData.ts     # All race state — positions, laps, stints, pits, intervals
│   ├── useCarData.ts      # High-freq telemetry for selected driver
│   ├── useTrackMap.ts     # Track outline + live driver positions
│   └── useRaceReplay.ts   # Playback clock (1×–60×, 250ms tick)
├── pages/
│   ├── Home.tsx
│   └── Race.tsx           # Orchestrator — fetches, filters by replayTime, passes to panels
├── utils/
│   └── prefetch.ts        # Warms API cache before Race page mounts
└── styles/
```

---

## Architecture Notes

**Data flow:** `Race.tsx` orchestrates everything. It fetches session metadata, runs the four hooks, filters every data array through `replayISO` (from `useRaceReplay`) in `useMemo` blocks, and passes filtered slices to panels. Panels are replay-unaware — they only see data up to the current replay time.

**API rate limit:** OpenF1 caps at 30 req/min. The client serializes all requests with an 800ms gap and caches responses for 60s to survive React Strict Mode double-mounts.

**Animation ownership:** AnimeJS owns any CSS property it animates. Never put an animated property in React's `style={}` prop — every re-render will overwrite what AnimeJS set.

**Prefetching:** `prefetchRaceData()` is called on Home mount during the lights animation so the Race page gets cache hits instead of network waterfalls.

---

## Contributing

1. Fork and create a feature branch off `main`
2. Run `bun run lint` and `npx tsc --noEmit` before opening a PR — no test suite exists, so type safety and lint are the primary guards
3. Follow the **AnimeJS ownership rule** above — animated props must not appear in React `style={}`
4. Check `src/components/ui/` before writing new UI — if a pattern already exists there, import it
5. API calls go through `src/api/openf1.ts` only — don't add raw `axios` calls in components or hooks

---

## Data Source

All race data comes from [OpenF1](https://openf1.org) — a free, open-source API for Formula 1 data.  
This project is unofficial and not affiliated with Formula 1 or the FIA.

---

## License

MIT
