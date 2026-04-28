# TODO / Refactor Plan

## DriverTable.tsx — High priority

### Animation cleanup
- [ ] Wire `data-rail-pit` and `data-rail-out` into the pit effect (currently only the background/label animates, not the rail)
- [ ] Extract all rail animations into a `useRailAnimations(containerRef, ...)` hook
- [ ] Extract pit animations into `usePitAnimations(containerRef, pitStatusMap, prevPitRef)`
- [ ] Extract overtake animations into `useOvertakeAnimations(containerRef, recentOvertakes, prevOvertakesLenRef)`
- [ ] Extract DRS animations into `useDrsAnimations(containerRef, drsActive, drsDriver, prevDrsRef)`
- [ ] Extract fastest lap animation into `useFastestLapAnimation(containerRef, overallBest, bestLapMap, prevFastestLapRef)`

### Component extraction
- [ ] Extract `<DriverRow />` component — currently all render logic is inline in `.map()`
- [ ] Extract `<RailIndicator />` — the `data-team-rail` subtree with all its slots

### Code quality
- [ ] Audit: find any remaining React `style` props that include properties AnimeJS also animates (ownership conflict)
- [ ] All derived maps (`driverMap`, `stintMap`, `lapMap`, etc.) re-created on every render — move into `useMemo`
- [ ] `overallBest` uses `Math.min(...Array.from(...))` which throws on empty — guard with `Infinity` fallback

## Race.tsx — Medium priority

- [ ] `replayPositionChanges` is cleared after 2000ms but `positionChanges` in DriverTable uses the same timeout — consider a single source of truth
- [ ] Commented-out `<Header />` and `<TelemetryPanel />` — decide: delete or restore

## Future rail events (nice to have)
- [ ] Safety car / VSC — yellow rail pulse across all drivers
- [ ] Blue flag — blue rail flash (driver being lapped)
- [ ] Race start / formation lap — staggered rail burst by grid position
- [ ] Fastest sector — sector-colored micro-pulse

## Architecture (longer term)
- [ ] Move all `data-*` attribute queries behind a `useDriverTableRefs()` helper that returns typed getters
- [ ] Consider splitting `useRaceData` — it fetches 9 endpoints serially; could parallelize more aggressively with a smarter cache
- [ ] `DriverTable` re-renders on every race poll (15s) — profile whether animation effects cause layout thrash
