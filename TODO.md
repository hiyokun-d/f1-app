# TODO

---

## 🏁 CONCEPT: First-Timer Intro Experience — "LIGHTS OUT"

> **Goal**: One shot. User lands. WOW. Then comfort. Then racing.
> Push AnimeJS v4 to its absolute limit. Every trick, every API. Music-synced, cinematic, unskippable (briefly).

---

### Philosophy

Not a tutorial. Not a tooltip tour. A **cinematic cold open** that:
1. Makes the user feel something before they interact with anything
2. Organically reveals every feature by showing it alive
3. Flexes the entire AnimeJS API — this is the AnimeJS showcase
4. Ends with the user already oriented, already excited, already inside the app

---

### Trigger & Persistence

- `localStorage.getItem("f1app_intro_seen")` — show once, never again unless cleared
- `?intro=1` query param forces replay (dev/demo mode)
- **Skip button** appears after 3s — `Esc` also skips (fade out 400ms)
- Mobile: same sequence, slightly compressed layout

---

### Audio Layer

```
src/intro/audio/
  intro-engine.mp3      # F1 engine revving (royalty-free / self-recorded)
  intro-music.mp3       # Electronic ambient — builds to a drop at lights sequence
```

- `<audio>` tag, `autoplay` blocked by browsers → play on first user gesture (Enter key / click / touch)
- If autoplay blocked: subtle "▶ SOUND ON" pulse appears, plays on first interaction
- Music tempo map (hardcoded BPM markers) drives AnimeJS timeline `seek()` calls so animations snap to beats
- Volume: engine layer fades in, music layer crossfades at Phase 3
- Spatial: `AudioContext` + `StereoPannerNode` — engine sound pans left→right at lights sequence

---

### Phase Sequence (total ≈ 18s, skip-able after 3s)

#### Phase 0 — Black (0–0.8s)
- Pure `#000` fullscreen overlay
- `createTimeline()` starts, holds context for entire sequence
- Font preloads silently

#### Phase 1 — "THE GRID" (0.8–3.5s)
- 20 thin horizontal lines `stagger(40ms)` slide in from left (like a timing screen booting)
- Each line: team color, driver number — actual 2024 grid data hardcoded in intro
- Lines animate `scaleX: [0, 1]`, eased `easeOutExpo`
- After all lines in: `scaleY` collapses each line to 1px simultaneously
- Transition: grid lines morph position to form the **app wordmark / logo**
  - AnimeJS `morphTo` on SVG paths if feasible, else translate each line to letter bounding box
- Text "F1 LIVE" assembles letter-by-letter from the grid lines via `translateX/Y` spring

#### Phase 2 — "THE MACHINE" (3.5–7s) — *Tech Stack Reveal*
- Background: dark, subtle carbon-fiber CSS pattern fades in
- Animated data-flow diagram spawns node by node:
  ```
  [OpenF1 API] ──→ [Serial Queue 800ms] ──→ [60s Cache]
                                                   ↓
  [useRaceData] ──→ [Race.tsx] ──→ [replayISO filter] ──→ [StandingsPanel]
       ↓                                                         ↓
  [useCarData]                                             [DriverTable]
       ↓                              ↓
  [useTrackMap]              [useRaceReplay ×250ms tick]
  ```
- Each node: `scale: [0, 1]` + `opacity: [0, 1]` with `stagger(120ms)`
- Edges (SVG `<line>` / `<path>`): `strokeDashoffset` animation — classic "drawing" effect
- Node labels use scramble-text effect (custom util: cycles random chars before settling)
- At end: entire diagram `scale: [1, 0.6]` + `translateY: [-40px]` — pushes up to make room for Phase 3
- Small "Powered by AnimeJS v4.3.6" badge fades in bottom-right, immediately fades — easter egg

#### Phase 3 — "LIGHTS OUT AND AWAY WE GO" (7–13s) — *Feature Showcase*
- 5 feature panels materialize one at a time, each auto-playing a live-data snippet
- Layout: center stage (large panel) + 4 thumbnail orbit around it, like a pit wall monitor array
- Panel transitions use AnimeJS `createLayout()` FLIP — panels physically move to their orbit positions

**Panel 1 — Standings** (center, 1.8s)
- Actual `DriverTable` mounted with mock data — 3 position swaps happen live
- FLIP row reorder plays (the spring slide)
- Rail indicators fire (green ▲ red ▼) with real rail animation
- Caption: `"LIVE STANDINGS — 20 drivers, real positions"` typewriter in at 60ms/char

**Panel 2 — Track Map** (orbit, 1.2s)
- SVG track outline draws itself (`strokeDashoffset`)
- Driver dots appear `stagger(30ms)` and begin orbiting the track at 4× speed
- Caption: `"TRACK MAP — sampled from /location"`

**Panel 3 — Telemetry** (orbit, 1.2s)
- Speed bar animates 180 → 340 → 285 km/h
- RPM ring fills like a tachometer
- DRS badge: off → available → active with color transition
- Caption: `"CAR TELEMETRY — 8s live, per driver"`

**Panel 4 — Replay** (orbit, 1.2s)
- Scrubber thumb slides left→right with easeInOutSine
- Timestamp ticks up beside it
- Positions in mini standings shuffle as replay advances
- Caption: `"TIME TRAVEL — 1× to 60×"`

**Panel 5 — Pit Stop** (orbit, 1.2s)
- Amber rail expands, `P` icon fades in
- "PIT STOP — 2.4s" banner slides down
- Timer counts up, then row returns, timer fades
- Caption: `"PIT DETECTION — live + historical"`

At 11.5s: **5 panels collapse** simultaneously into center via `createLayout()` FLIP
At 12s: 5 circles (like F1 start lights) appear `stagger(200ms)` — **RED → RED → RED → RED → RED**
At 13s: all 5 lights off simultaneously — flash of white across screen (CSS `::after` pseudo overlay, `opacity: [0.8, 0]`, 120ms)

#### Phase 4 — "ENTER" (13–15s)
- App UI slides up from below (`translateY: [100vh, 0]`, spring `stiffness: 200, damping: 20`)
- Intro overlay fades out (`opacity: [1, 0]`, 600ms)
- Music fades to 10% volume, engine sound crossfades to silence
- `localStorage.setItem("f1app_intro_seen", "true")`
- `onComplete` callback unmounts intro entirely from DOM

#### Phase 5 — "SETTLE IN" (15–18s, post-mount)
- First time main app appears: each major panel section does a subtle `translateY: [12px, 0]` + `opacity: [0, 1]` stagger reveal — not jarring, just graceful
- DriverTable rows stagger in `stagger(30ms)` from top
- This uses existing intro animation slot in `useDriverTableAnimations` (already wired)

---

### AnimeJS APIs Used (the full showcase)

| API | Where |
|---|---|
| `createTimeline()` | Master sequence controller |
| `animate()` | Every individual element |
| `stagger()` | Grid lines, nodes, rows, panels |
| `createLayout()` FLIP | Panel orbit → center collapse |
| `createScope({ root })` | Scoped queries inside each panel |
| `spring()` easing | App UI slide-up, row reorder |
| `strokeDashoffset` SVG | Track outline draw, edge draw |
| `morphTo` SVG | Grid lines → wordmark (stretch goal) |
| `timeline.seek()` | Beat-sync to music BPM markers |
| `onComplete` / `onUpdate` | Phase transitions, cleanup |

---

### File Structure

```
src/intro/
  IntroOverlay.tsx        # Root: mounts/unmounts, audio context, skip logic
  IntroTimeline.ts        # Master AnimeJS timeline builder (pure, no JSX)
  phases/
    Phase1Grid.tsx        # Grid lines → wordmark
    Phase2Machine.tsx     # Architecture diagram
    Phase3Showcase.tsx    # 5 feature panels
    Phase3Panels/
      StandingsPanel.tsx  # Live mock standings
      TrackPanel.tsx      # SVG track + dots
      TelemetryPanel.tsx  # Speed/RPM/DRS
      ReplayPanel.tsx     # Scrubber
      PitPanel.tsx        # Pit animation
    Phase4Enter.tsx       # Lights sequence + transition
  audio/
    useIntroAudio.ts      # AudioContext setup, beat markers, volume control
    intro-engine.mp3
    intro-music.mp3
  scrambleText.ts         # Utility: random char scramble → settle
  mockData.ts             # Hardcoded 2024 grid, mock positions, mock telemetry
```

---

### Comfort Layer (post-intro)

Once app is loaded for the first time (intro done), three subtle comfort touches:
- **Tooltip pulse**: First interactive element (replay scrubber) has a 3s pulsing ring — `border-radius` + `box-shadow` AnimeJS breathe loop — disappears on first interaction
- **"What's this?" ghost**: Hovering the track map first time shows a 1.5s tooltip fade-in "Driver positions update every 10s" — single-fire via ref flag
- **Keyboard hint bar**: Bottom of screen, `translateY: [40px, 0]` slide up after 2s, shows `Space = play/pause` `← → = scrub` `Esc = close`. Auto-dismisses after 6s or on keypress.

---

### Stretch Goals
- [ ] SVG path morph: grid lines physically reshape into app logo glyphs
- [ ] WebGL canvas backdrop in Phase 1 — particle field shaped like an F1 car silhouette
- [ ] Beat-detection from audio buffer instead of hardcoded BPM markers
- [ ] Phase 2 diagram is interactive — hover a node, tooltip explains it
- [ ] Intro replay button in app header (⟳ icon) — for users who want to show friends

---

## 🏎 Main Menu — Three.js Car Silhouette

> Three.js scoped **only** to main menu. One canvas, one mesh, nothing else. Heavy lib justified by a single WOW moment — rest of app untouched.

### Scope — keep it lean
- Dynamic import `() => import('three')` — zero cost until menu mounts
- Single `WebGLRenderer` canvas, transparent bg, placed behind menu UI
- Dispose renderer + geometries on menu unmount — no leak into race view

### The Car
- **Silhouette only** — flat `MeshBasicMaterial` black/dark, no lighting needed
- Source: low-poly F1 car GLB (< 500KB) loaded via `GLTFLoader` (Three.js addon, no extra deps)
- Orthographic camera, side-on view — car fills ~60% of horizontal space
- Idle animation: very slow `rotation.y` drift (±3°) + subtle `position.y` float sine wave
- On hover: camera slowly pulls back + car rotates to 3/4 front view (`TWEEN`-less, just `lerp` in `requestAnimationFrame`)
- On race select: car accelerates off-screen right (`position.x` eases to `+4`), canvas fades — transition to race UI

### What sits on top (normal React/CSS)
- Session picker, race selector, settings — all regular DOM, `z-index` above canvas
- Menu text/buttons animate in after car settles (300ms delay)

### Files
```
src/menu/
  MainMenu.tsx            # Menu shell, lazy-loads ThreeCar
  ThreeCar.tsx            # Canvas mount, Three.js lifecycle
  useThreeCar.ts          # Renderer, scene, animation loop, cleanup
  assets/f1-car.glb       # < 500KB low-poly silhouette mesh
```

### Stretch
- [ ] Particle trail behind car on entry (simple `Points` geometry, 200 particles max)
- [ ] Team color tint on car material when a team is hovered in race list
- [ ] Headlight cone (`SpotLight`, low intensity) for night-race sessions

---

## 🖥 Race UI — Header (restore + complete)

> Currently JSX-commented out in `Race.tsx`. Design and wire it properly.

### Content
| Slot | Data | Source |
|---|---|---|
| Session name | `"BAHRAIN GP — RACE"` | `session.session_name + circuit_short_name` |
| Round badge | `R4` | `session.round_number` |
| Live / Historical pill | green pulse or grey | `isHistorical` flag from `useRaceData` |
| Replay clock | `+1:23:45` elapsed or actual time | `replay.replayTime` formatted |
| Replay speed badge | `32×` | `replay.speed` |
| Weather strip | 🌡 24°C 💨 18 km/h 🌧 0% | `race.weather` latest entry |
| Safety car / VSC banner | slides down when active | `race.raceControl` filtered for SC/VSC messages |

### Behavior
- Sticky top, `backdrop-filter: blur` — doesn't scroll away
- Weather strip auto-hides if no weather data (historical sessions often missing)
- Safety car banner: AnimeJS `translateY: [-40px, 0]` slide-down, auto-dismiss after RC message clears
- Header collapse: on scroll down > 60px → shrinks to 32px bar (session name only); scroll up → expands. AnimeJS `createLayout()` FLIP handles height change smoothly

### Files
```
src/components/race/Header/
  index.tsx         # Shell, layout, sticky behavior
  WeatherStrip.tsx  # Weather icons + values
  ReplayClock.tsx   # Formatted elapsed time, speed badge
  SCBanner.tsx      # Safety car / VSC slide-down banner
```

---

## 📻 Team Radio — Mid-Race Playback + Alert System

> Auto-play incoming team radio during the session, with a non-intrusive alert the user can skip.

### Feature 1 — Random pick & auto-play

- Poll `race.teamRadio` (already in `useRaceData`) for new entries since last check
- On new entry: pick one at random if multiple arrive simultaneously
- Play via `<audio>` tag through the `/f1-audio` Vite proxy (already wired for CORS)
- Respect a cooldown: don't start a new clip if one is still playing + 5s gap between clips
- Live only: disable auto-play when `isHistorical` (replay mode) to avoid spamming old clips

### Feature 2 — Header driver visualization panel

A new panel inside the header (right zone, or sliding overlay) that appears while a clip is playing:

| Element | Details |
|---|---|
| Driver full name | `driver.full_name` — large display font |
| Team name | `driver.team_name` — smaller, team color tint |
| Team color bar | Left accent strip in `teamHex(driver.team_colour)` |
| Waveform / pulse | Animated bars (CSS keyframe) simulating audio activity while playing |
| Duration counter | Elapsed time of clip, e.g. `0:08` |

- Panel slides in from right when clip starts (AnimeJS `translateX: [120px, 0]`), slides out on finish
- Waveform bars: 5–7 bars, heights randomized each 120ms via `setInterval` while `audio.currentTime` advances
- Fades out gracefully when clip ends or user skips

### Feature 3 — Skip alert

- Alert appears as a fixed toast (bottom-right, above replay controls) when a new clip starts
- Shows: driver name + `"TEAM RADIO"` label + `[SKIP ▶]` button
- Auto-dismisses after clip finishes
- Skip button: pauses `audio.currentTime`, hides panel, logs skip (for cooldown logic)
- Keyboard shortcut: `S` key skips current clip (only when alert is visible)

### Files to create / modify

```
src/components/race/TeamRadio/
  useTeamRadioPlayer.ts   # Hook: tracks queue, plays clips, exposes skip()
  TeamRadioAlert.tsx      # Toast alert with skip button
  TeamRadioPanel.tsx      # Animated driver visualization panel (header zone)
```

Modify:
- `Race.tsx` — mount `<TeamRadioAlert>` and pass player state to Header
- `Header.tsx` — render `<TeamRadioPanel>` in right zone while clip is active
- `useRaceData.ts` — confirm `teamRadio` already updated on each poll (it is)

### Open questions
- [ ] Should replay mode play radios in chronological order as `replayTime` advances? (Nice-to-have)
- [ ] Volume control — inherit system or expose a UI slider?
- [ ] If multiple new radios arrive: queue them in order or just pick the latest?

---

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
