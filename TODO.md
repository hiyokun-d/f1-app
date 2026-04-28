# TODO

## DriverTable — remaining

- [ ] Wire `data-rail-pit` and `data-rail-out` into the pit effect (background/label animates, rail does not yet)
- [ ] Extract `<RailIndicator />` sub-component — the `data-team-rail` subtree with all its data-slots

### Completed ✅
- [x] Refactor monolith `DriverTable.tsx` (1355 lines) → `DriverTable/` folder (7 files)
- [x] Extract `<DriverRow />` — `DriverTable/DriverRow.tsx`
- [x] All derived maps into `useMemo` (no rebuild on every 250ms replay tick)
- [x] All animation effects consolidated into `useDriverTableAnimations` (intro, rail, FLIP, layout, pit, overtake, DRS, FL, hover, click)
- [x] `overallBest` safe — `Math.min(...[])` returns `Infinity`, guarded by `!isFinite()` in hook
- [x] FLIP row reorder fires on every position change via `commitPositions` + `prevOrderRef`
- [x] Fix animation flickering during replay (rail, pit overlay, pos-number CSS anim)
- [x] Fix PIT STOP banner stuck visible after stop completes
- [x] Hover animation (translateX nudge + team-color glow overlay)
- [x] Click/select animation (spring slide-in + team-color flash)
- [x] Position number punch-in: scale bounce on pos-up/pos-down keyframes
- [x] Arrow indicator (▲▼) pops in with CSS spring animation

## Race.tsx — Medium priority

- [ ] `replayPositionChanges` cleared after 2000ms shares logic with DriverTable — consider single source of truth
- [ ] Commented-out `<Header />` and `<TelemetryPanel />` — decide: delete or restore

## Future rail events (nice to have)
- [ ] Safety car / VSC — yellow rail pulse across all drivers
- [ ] Blue flag — blue rail flash (driver being lapped)
- [ ] Race start / formation lap — staggered rail burst by grid position
- [ ] Fastest sector — sector-colored micro-pulse

## Architecture (longer term)
- [ ] Move all `data-*` attribute queries behind a `useDriverTableRefs()` helper that returns typed getters
- [ ] Consider splitting `useRaceData` — it fetches 9 endpoints serially; could parallelize more aggressively with a smarter cache
