# CoastGuard AI

A flood-response tool for **Miami-Dade County, Florida**, built on real elevation, tide and road data.

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

## Two surfaces

The project ships as two front ends **running on one engine**:

| Surface | Who it is for | Where |
|---|---|---|
| **Operations dashboard** | The emergency operations centre. A desk, a big screen, the whole town at once. | `/` |
| **Field app** | Residents and volunteers on the ground, on a phone, possibly offline. | `/mobile.html` |

The **Mobile app** button in the dashboard header opens the field app in a new
tab.

### They share everything that matters

`lib/engine.ts` is the single API both surfaces drive. The dashboard imports it
directly; the field app — a static HTML page with no build step of its own —
loads the *same compiled module* as `window.CoastGuard`, bundled by
`npm run build:engine`. There is no second implementation to drift.

| | Dashboard | Field app |
|---|---|---|
| Flood model, projections, map overlay | ✅ | ✅ |
| 48 h timeline + Now/+6/+12/+24 horizons | ✅ | ✅ |
| Road closures from the model | ✅ | ✅ |
| A\* safe routing, safest vs fastest | ✅ | ✅ |
| Shelters, incidents, resources, volunteers | ✅ | ✅ |
| Report a hazard | ✅ | ✅ |
| Reserve a resource / post one | ✅ | ✅ |
| Join / dispatch volunteer jobs | ✅ | ✅ |
| Assistant | ✅ grounded in the model | ✅ hosted LLM + offline fallback |
| Photo hazard analysis | — | ✅ |
| Side-by-side risk-mode comparison | ✅ | — |

The last two rows are form-factor differences, not gaps: photo analysis needs
a camera in your hand, and comparing two routes side by side needs a screen
wide enough to see both.

The dashboard is laid out like the field app on purpose — the same sections in
the same order, so someone who has used one can use the other:

| Page | What it is |
|---|---|
| `/` | Landing page — what the project is, the two algorithms, the two surfaces. Its headline figures are read live from the engine so they cannot drift from the dashboard. |
| `/overview` | Operations overview: conditions, 24 h outlook, safety score, where to send people, live incidents |
| `/map` | The forecast map, 48 h timeline, horizons and the router |
| `/report` | Hazard intake, corroborated against the model at the reported location |
| `/resources` | Shared inventory with live road distances; reserve or log items |
| `/volunteer` | Dispatch board; jobs whose site is cut off cannot be assigned |
| `/assistant` | Answers questions from the flood model and router, offline |

Simulation state lives in one provider (`lib/store.tsx`) mounted in the root
layout, so the flood model is precomputed once and scrubbing to the storm peak
on `/map` then walking to `/resources` shows you resources at the storm peak.

### The assistant is not a chatbot

`lib/assistant.ts` matches a question to something the engine can actually
answer — a route, a water depth, a shelter recommendation — and generates the
reply from the result. Every answer names its source. It needs no API key, so
it works with the network down, which is when a flood response needs it, and
it cannot invent a road that does not exist.

`data/community.json` is the other half of the sync. Shelters, incidents,
resources and volunteer jobs used to be hardcoded arrays inside the field app
with hand-picked coordinates that had no relationship to the DEM or the road
graph — so the two surfaces disagreed about where everything was, and none of
it could be routed to. Every entry now sits on a real road-network node, which
is what lets both surfaces say "1.9 km by road" or "cut off" instead of a
static distance that was true when someone typed it.

Regenerate it with `npm run generate-community`.

Two guards keep them in sync, both in `npm test`:

- the browser bundle must expose every name the field app calls;
- the bundle and the directly-imported module must compute **identical**
  conditions for the same moment.

The second one has already caught a stale bundle in practice.

`coastguard-ai.html` at the repo root is the single source of truth for the
field app — that is the file to edit. `npm run sync-mobile` mirrors it to
`public/mobile.html`, which is what actually gets served, and it runs
automatically on `npm run dev` and `npm run build` so the two cannot drift.

> The field app's AI assistant calls the Groq API from the browser. The key in
> the source is the placeholder `"nah"`, deliberately: this file is served to
> the client, so a real credential here would be readable by anyone who views
> source. With no key set the assistant short-circuits to its offline
> responses instead of making a request that would fail. If you want the live
> assistant for a demo, put a real key in a local copy only — never in a
> deployed or committed one.

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
npm test
```

That runs both; `npm run test:flood` and `npm run test:routing` run them
individually.

To rebuild the synthetic town from scratch (deterministic — same bytes every
time):

```bash
npm run generate-data
```

`npm run dev` and `npm run build` first run `build:engine` (compiles
`lib/engine.ts` into `public/coastguard-engine.js`) and `sync-mobile` (mirrors
`coastguard-ai.html` into `public/mobile.html`), so neither can go stale.

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
sea. Miami-Dade is full of them: quarry lakes and borrow pits sit below the water
line but have no channel to Biscayne Bay, so they must stay dry. We enforce this with a breadth-first search seeded from every flooded
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

## The data

Everything is regenerated by `npm run generate-data`, which pulls from three
public sources. Nothing is invented except the storm, and that is labelled.

| File | Source | Status |
|---|---|---|
| `data/dem.json` | USGS 3DEP bare-earth elevation, via The National Map | **measured** |
| `data/forcing.json` | NOAA CO-OPS tide predictions, Virginia Key (8723214) | **measured** tide, **modelled** storm |
| `data/roads.json` | OpenStreetMap, via Overpass | **measured** |
| `data/landmarks.json` | Operational sites, snapped to the road graph | measured placement |
| `data/community.json` | Shelters, incidents, resources, jobs | exercise fixtures, measured placement |

Grid: **300 × 300 over a 13 × 11 km bbox** (−80.25, 25.72 to −80.12, 25.82), about
40 m per cell, elevations in metres **NAVD88**. Road network: **4,659
junction-to-junction segments** across 4,138 nodes.

```bash
npm run generate-data       # DEM + tide + roads   (add REUSE_DEM=1 to skip the DEM)
npm run generate-community  # shelters, incidents, resources, jobs
```

### The storm is a scenario, and says so

NOAA gives the real astronomical tide, which at Virginia Key runs about −0.6 to
+0.2 m NAVD88. Against ground that sits between 0 and 16 m, that floods
nothing — and a flood tool that never shows a flood is not a tool.

So the tide is measured and the storm is modelled: a Gaussian surge peaking at
**2.2 m** with a rainfall band ahead of it, of the scale Miami-Dade plans
against. Combined peak: **2.96 m**, which closes 3,643 of 4,659 road segments.

`data_status` in every generated file records which parts are observed and
which are modelled. This is how coastal flood risk is actually planned —
FEMA and NOAA both design against a storm rather than wait to measure one.

### Real data is messy, and most of the work was handling that

Four defects in the raw sources would each have produced confident, wrong
answers. They are worth knowing about because they are not specific to Miami:

**No-data fills.** 3DEP is bare earth and has no bare earth under Biscayne
Bay, so it returns constants there — this extract came back 44% fill values
(22% exactly `0`, 15% exactly `-0.5`). Left in, they read as land a few
centimetres below datum, flooding at the first high tide. Real LiDAR
elevations are effectively continuous, so any single float repeated across
more than 1% of the grid is detected as fill and marked no-data.

**Bridges.** Under a causeway the DEM records the bay floor, so sampling it
naively reports every bridge in the county as permanently submerged and severs
the causeways at low tide. Bridges are tagged from OSM and judged against a
deck estimated from their abutments, floored at MHHW + 1.5 m.

**Waterside roads.** At 40 m per cell a road beside a canal picks up the canal.
Cells that never emerge even at the lowest water level in the forecast are
dropped from road sampling — they are water, not carriageway.

**Disconnected fragments.** An OSM extract clipped to a bbox always contains
pieces whose only real connection is outside it. Only the largest connected
component is kept, so every node is genuinely routable.

Before these: 874 road segments "impassable" at low tide and 8 of 9 landmarks
unreachable. After: 31.

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

## Deploying

It is a static Next.js app with no database, no auth, no server state and no
environment variables, so any Node host works; on Vercel it deploys from the
repo with no configuration.

```bash
npm run build && npm start
```

`prebuild` syncs the field app into `public/` first, so `public/mobile.html`
is always present and current in the deployed bundle. The only runtime network
request is for OpenStreetMap basemap tiles — if those fail, the flood overlay,
roads, routes and every figure on screen still render, because all of it is
computed locally from the bundled data.

---

## Layout

Desktop-first: the map takes the space, panels sit in a rail beside it, the
timeline runs underneath. Below the `lg` breakpoint everything stacks into one
scrolling column.

The visual language — palette, Fraunces/Inter type pairing, card shapes,
tinted pill badges, the navy segmented control — is ported from
`coastguard-ai.html`, the original design mockup, which is kept in the repo for
reference.
