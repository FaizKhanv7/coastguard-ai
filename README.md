# CoastGuard AI

A flood-response tool for Kalinaw Island, an isolated coastal town.

The map does not just display a flood — it **predicts** where the water will
go over the next 6, 12 and 24 hours, and then **routes around the prediction**,
excluding roads that are already under water or that the model says will be
under water before you get there.

Two systems do the work, both plain TypeScript under `lib/` with no React
dependency, so they can be run and explained on their own:

| | |
|---|---|
| **`lib/flood.ts`** | Predictive flood modelling — bathtub fill with ocean connectivity |
| **`lib/routing.ts`** | Dynamic safe-route pathfinding — A\* over the still-passable road graph |

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

The two algorithms have standalone harnesses that print their behaviour and
assert the properties that matter. They need no browser and no test runner:

```bash
npm run test:flood
```

```bash
npm run test:routing
```

To rebuild the synthetic town from scratch (deterministic — same bytes every
time):

```bash
npm run generate-data
```

**There are no network calls at runtime.** Every input is a static file in
`data/`, imported directly into the bundle. The only external request the app
makes is for OpenStreetMap basemap tiles, and the app is fully functional
without them — the flood overlay, roads, routes and every number on screen are
computed locally.

---

## Algorithm 1 — Flood model

Given a time `t`, which cells of the town are under water?

**Step 1 — water level.**

```
h(t) = tide(t) + surge(t) + rainAccumulation(t)
```

Tide and surge come straight from the forcing series. Rainfall is *not* added
directly, because rain that falls has to accumulate and then drain away. It is
integrated as a leaky bucket:

```
acc(t) = acc(t − dt) · e^(−dt/τ) + rate(t) · dt · runoffGain
```

with `τ = 5 h`. So the level keeps climbing while the storm sits over the town
and recedes over the following several hours, instead of snapping back the
moment the rain stops. `runoffGain = 4` accounts for a catchment concentrating
runoff into the low ground rather than each millimetre of rain raising the
water by exactly one millimetre.

**Step 2 — connectivity.** A cell floods only if **both**:

1. its elevation is below `h(t)`, **and**
2. it can be reached from the open ocean through other flooded cells.

Condition 2 is the part that matters, and it is why this is not just a
threshold. A naive `elevation < waterLevel` test floods every inland hollow
that happens to sit below the water line, including ones with no path to the
sea. Kalinaw Island's **Old Quarry Basin** is exactly that case: its floor is
1.9 m *below* sea level, but it is ringed by ~20 m of high ground, so it must
stay dry. We enforce this with a breadth-first search seeded from every flooded
cell on the grid boundary, spreading through 4-connected neighbours.

At the storm peak the model reports **95 cells that sit below the water level
but are correctly left dry** — that number is on screen in the status panel.

**Step 3 — projection.** `projectFlood(tNow, [6, 12, 24])` evaluates steps 1–2
at future timesteps. The forcing series is a forecast, so "projected flood
extent at +6 h" is the model run against the forecast tide and rainfall for
that hour.

### A useful property

The flood mask is **monotonic in water level**: if level A < level B then
mask(A) ⊆ mask(B). *Proof:* take any cell flooded at level A. It is below A,
and the BFS reached it through a chain of cells all below A. Every one of those
is therefore also below B, so the same chain is open at B.

This means the union of masks across a time window is exactly the mask of the
**highest** level in that window. Finding what "safest" routing must avoid is
therefore a scan over ~50 numbers rather than OR-ing ~50 arrays of 25,600
cells — the difference between routing in 28 ms and routing in 0.1 ms, which is
what lets the timeline scrub smoothly.

### Assumptions and limitations

Judges will ask, so these are stated plainly:

- **Water is level and arrives instantaneously.** There is no hydrodynamics —
  no flow velocity, no momentum, no lag for water to travel inland. Over a 4 km
  town at multi-hour timesteps that is reasonable; for a dam break it would not
  be.
- **Drainage is one global time constant**, not a real sewer network.
- **The DEM is 27 m per cell**, so features narrower than ~30 m (a sea wall, a
  raised kerb) are invisible to the model.
- **4-connectivity is deliberately conservative** — water will not squeeze
  through a diagonal-only gap between two dry cells.
- The terrain is synthetic. It is built to be *plausible and legible*, not to
  match any real place.

---

## Algorithm 2 — Safe routing

**Graph.** Nodes are road intersections, edges are the segments between them,
edge weight is length in metres. The road GeoJSON carries explicit `from`/`to`
node ids, so the graph is exact — no coordinate-snapping heuristics.

**Elevation sampling.** At graph-build time each edge is sampled every ~15 m
and the DEM cell index of each sample is cached on the edge. Testing whether a
road is flooded is then a handful of array lookups. Doing this once is what
keeps recomputation cheap.

**When is a road closed?** When any sampled point along it is standing in more
than **30 cm** of water — not merely when it is wet. Thirty centimetres is the
figure emergency services use: at about a foot, a typical car loses traction
and begins to float. Without that threshold every road that gets its toes damp
at high tide would close and the network would be severed from hour zero.

**A\*** over the passable subgraph, with a haversine straight-line heuristic.
That heuristic is *admissible* because edge weights are ground distances, so it
never overestimates the remaining cost and A\* returns the true shortest path.

**Risk tolerance.** Both modes minimise distance; they differ in which edges
they may use.

- **`fastest`** excludes only edges flooded *right now*. Shorter, but it may
  run through ground that is about to go under.
- **`safest`** excludes any edge flooded at *any* point between now and the
  horizon. Longer, but it will still be there when you need it.

**Arrival-time check.** For a `fastest` route the router walks the path
accumulating travel time, works out which timestep you would reach each segment
at, and flags any segment the model says is under water *by then*. That is the
"this route floods before you finish driving it" warning.

**No route.** `findRoute` never throws. It returns a discriminated union, and
on failure distinguishes *the origin is stranded* ("shelter in place and
request water rescue") from *the destination is cut off*, in which case it runs
a Dijkstra pass and suggests the nearest landmark you **can** still reach — the
origin and the failed destination both excluded, because suggesting the place
you are already standing in is useless.

---

## The town

Everything is generated by `scripts/generate-data.ts` from a single seeded PRNG
(mulberry32, seed `20260830`), so re-running it reproduces identical output.

Kalinaw Island is fictional but sits on real coordinates (9.8756 N, 126.0892 E)
so the OpenStreetMap basemap has coverage under it.

### `data/dem.json`

A 160 × 160 elevation grid over a 4.4 km square, ~27 m per cell, in metres
relative to mean sea level. Row 0 is the **southern** edge, column 0 the
**western** edge; the array is row-major.

Built as a base ramp away from a curved shoreline, blended toward a low
harbour plateau, with a river channel carved in and fBm noise for texture.
Range −26 m to +54 m; **19% of the land sits below 3 m**, which is what makes a
2–3 m surge genuinely dangerous rather than cosmetic.

Four features are deliberate rather than emergent, because the demo turns on
them:

| Feature | Why it exists |
|---|---|
| **Old Quarry Basin** | Floor 1.9 m below sea level, ringed by ~20 m of high ground. Proves the connectivity model — a threshold model floods it, ours does not. |
| **Tidal river** | Splits the map. The hospital and quarry are on the east bank, everything else on the west, so crossing it is unavoidable. |
| **Salt Flat Causeway** | The low crossing (road bed 1.6 m). Short and direct, and it goes under once the water passes ~1.9 m. |
| **Upper Ford Bridge** | The high crossing, far upstream on the ridge. Never floods, but reaching it is a long way round. |

Two crossings with different elevations is the whole reason `fastest` and
`safest` disagree. Road segments that would ford the river anywhere else are
suppressed at generation time.

### `data/roads.json` and `data/landmarks.json`

GeoJSON `FeatureCollection`s (`.json` extension so they import directly through
the bundler without extra loader configuration). 97 road segments over 66
nodes, forming one connected graph, plus five named landmarks:

| Landmark | Ground level | Role in the demo |
|---|---|---|
| Kalinaw District Hospital | 32.8 m | Destination. Safe itself; the roads *to* it are not. |
| Bayanihan School & Shelter | 11.2 m | The fallback when somewhere else is cut off. |
| Town Center Plaza | 4.0 m | Floods around, not under. |
| Kalinaw Marina | 4.6 m | Origin. On the raised west quay, so it stays usable throughout. |
| Ferry Dock | 2.5 m | Low enough to be cut off completely at the peak. |

Each landmark gets two access spurs — the nearest intersection, and the one
whose approach stays on the highest ground. Without the second, every access
road runs through the same low dip and the landmark is severed at the first
high tide with no alternative for the router to offer.

### `data/forcing.json`

48 hours at 15-minute resolution (193 samples):

- **Tide** — M2 (12.42 h principal lunar semidiurnal) plus a smaller S2
  (12.00 h solar) constituent. The two beat against each other, which is why
  successive high tides are not identical.
- **Surge** — a Gaussian storm surge peaking at **hour 26** at 2.35 m.
- **Rainfall** — baseline drizzle plus a heavy burst peaking at hour 23.5, so
  the rain band leads the surge by about 2.5 hours, as a real storm's would.

Combined peak water level: **3.66 m at hour 27.75**, which puts 24% of the
town's land area under water and closes 38 of 97 road segments.

---

## Performance

All 193 flood states are computed **once**, on load, behind a loading state —
about 250 ms. After that, scrubbing the timeline is an array index and a route
recomputes in ~0.1 ms, so playback stays smooth with no throttling or
debouncing anywhere in the UI.

---

## Accessibility

- The time scrubber is a real `<input type="range">`, so it works with the
  keyboard and touch for free; `aria-valuetext` announces the clock time and
  water level rather than a raw step number.
- Segmented controls are `radiogroup`s with arrow-key navigation.
- Every map control and landmark pin carries an `aria-label` describing its
  state ("cut off", "selected as origin").
- The status and route panels are `aria-live` regions, so the situation is
  announced as the timeline plays.
- **Nothing critical is encoded in colour alone.** Flooded ground is coloured
  *and* diagonally hatched; closed roads are coloured *and* dashed; the two
  route modes are distinguished by solid vs. dashed as well as by hue; cut-off
  landmarks carry a ⚠ glyph and a text label. The legend shows the actual mark
  used, not a colour chip.
- All text passes WCAG AA contrast against its real composited background.

---

## Layout

Desktop-first: the map takes the space, panels sit in a rail beside it, the
timeline runs underneath. Below the `lg` breakpoint everything stacks into one
scrolling column.

The visual language — palette, Fraunces/Inter type pairing, card shapes,
tinted pill badges, the navy segmented control — is ported from
`coastguard-ai.html`, the original design mockup, which is kept in the repo for
reference.
