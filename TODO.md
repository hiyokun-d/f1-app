# F1 Race Center — TODO

> Read this before starting work. Tracks what's done, in progress, and next.

## Status: 🟡 Building

---

## ✅ Done

- [x] Home page — starting lights sequence, session card, "Safety Car Deployed" banner
- [x] App routing (Home → Race by session key)
- [x] OpenF1 API client with serial request queue (800ms gap) + 60s cache
- [x] `useRaceData` hook — positions, laps, stints, pits, intervals, overtakes, RC, radio, weather
- [x] `useCarData` hook — high-freq telemetry for selected driver
- [x] `useTrackMap` hook — track outline + live driver positions
- [x] `useRaceReplay` hook — replay clock with configurable speed (1×–60×)
- [x] `Race.tsx` orchestration layer — session fetch, all hooks wired, replay filtering
- [x] `StandingsPanel` + `DriverTable` — compact/expanded grid, AnimeJS FLIP layout
- [x] `OvertakeBanner` — detects position swaps, shows banner
- [x] `RcTickerPanel` — race control messages ticker
- [x] `ReplayControls` — playback scrubber + speed selector
- [x] `TrackMap` — SVG track outline + live driver dots
- [x] `TeamRadioPlayer` — audio playback with Vite CORS proxy
- [x] `ComingSoon` page — spectacular F1-themed WIP screen with canvas sparks, glitch title, fake telemetry, radio chatter, standings/sector panels

---

## 🔧 In Progress

- [ ] `Race.tsx` — replace `<ComingSoon />` with the actual race UI layout once panels are stable
- [ ] `Header` component — currently JSX-commented out in Race.tsx; needs to be wired in
- [ ] `TelemetryPanel` — currently JSX-commented out in Race.tsx; needs wiring

---

## 📋 Next Up

### Race UI layout
- [ ] Assemble the three-panel race layout (left: standings, center: track map, right: telemetry)
- [ ] Connect `Header` with session info + live lap counter
- [ ] Connect `TelemetryPanel` with `carLatest` / `carHistory` + `selectedDriverObj`
- [ ] Panel resize handles (ResizeHandle component exists, needs integration)
- [ ] Mobile responsive layout fallback

### Features
- [ ] Session picker on Home — list all available sessions from OpenF1 instead of hardcoded `SESSION` constant
- [ ] Weather overlay on track map
- [ ] Stint compound color coding on track map dots
- [ ] Lap delta chart in TelemetryPanel
- [ ] "Best lap" highlighting in DriverTable

### Polish
- [ ] Loading skeleton while session metadata fetches
- [ ] Error boundary for failed API calls
- [ ] Keyboard shortcuts (space = play/pause replay, arrow keys = scrub)
- [ ] Dark/light theme toggle (currently always dark)

---

## 🐛 Known Issues / Notes

- `Race.tsx` has all hook/data logic wired but renders `<ComingSoon />` — actual layout panels are not assembled yet
- `Header` and `TelemetryPanel` are imported but JSX-commented out; their prop derivations are still in Race.tsx
- Historical session detection threshold: `sessionDateEnd` > 1 hour ago → no re-polling
- Pit detection differs live vs. replay (two separate code paths, see CLAUDE.md)
- AnimeJS `animate()` with `backgroundColor: "transparent"` will fail — always use `"rgba(0,0,0,0)"`
