# CoastGuard AI — 3-minute demo script

**Before you start:** `npm run dev`, open <http://localhost:3000>.

The dashboard is six pages sharing one simulation clock — Home, Map, Report,
Resources, Volunteer, Assistant. Whatever moment you scrub to on **Map** is the
moment every other page describes.

| Control | Value |
|---|---|
| Page | **Home** |
| Time | Day 1 · 04:00 |
| Horizon | **Now** |

Beats 1–2 want the horizon on **Now**; beat 4 switches it to **+12h**.

---|---|
| Time | Day 1 · 04:00 |
| Horizon | **+12h** |
| From → To | **Kalinaw Marina → Kalinaw District Hospital** |
| Risk tolerance | **Fastest** |

**One thing to understand before you present.** The horizon toggle shifts what
the *map and the panels* show. With `+12h` selected, the header and status
panel describe the moment twelve hours after wherever the scrubber sits — the
header chip says **Forecast +12 h** and the scrubber shows both times, so you
can always tell which is which. Beats 1 and 2 below want **Now**; beat 3 wants
**+12h**. The script says when to switch.

Have a second tab ready with `npm run test:flood` output if the judges want to
see the model verified outside the UI.

---

## 0:00 — 0:20 · The overview

Start on **Home**.

> "Kalinaw Island, a calm morning. Water about a metre, five of 97 road
> segments closed, everything reachable, safety score 97. The outlook strip
> already knows what's coming though — look at +24 h."

Point at the outlook: 1.1 m now, then **3.6 m at +24 h, 38 roads cut**.

---

## 0:00 — 0:30 · Normal conditions

**Set the horizon to `Now`.**

> "This is Kalinaw Island, an isolated coastal town. Right now it's a calm
> morning — water level about a metre, five of the 97 road segments closed,
> everything reachable."

Point at the map:

- The hatched blue is the sea and the flooded fringe. It's hatched as well as
  coloured so it reads without relying on colour.
- The green line is the route from the marina to the hospital: **3.37 km,
  5 minutes**, straight across the **Salt Flat Causeway**.

> "The causeway is the short way to the hospital. Hold that thought."

---

## 0:30 — 1:15 · Scrub into the storm surge

*(Horizon still on `Now`, so the numbers describe the moment you scrub to.)*

**Drag the timeline to about hour 26–28** (or press play and let it run — the
storm peak is marked on the scrubber).

Watch, and narrate what's happening:

- Water level climbs to **3.66 m** at hour 27.75 — tide, plus a 2.35 m storm
  surge, plus rainfall that accumulated over six hours and is draining away
  slowly.
- The flood spreads *inland along the river channel*, not uniformly from the
  coast.
- Closed segments jump from 5 to **38 of 97**. They go coral and dashed.
- The header counter flips: **Ferry Dock is cut off.**

> "Nothing here is being replayed from a recording. Every frame is the flood
> model run against the forecast for that hour — 193 timesteps, all computed
> once when the page loaded, which is why scrubbing is instant."

**The point to land — the Old Quarry Basin.** In the status panel:

> "See this line: *95 cells sit below the water level but have no path to the
> sea*. That's the Old Quarry Basin inland — its floor is two metres below sea
> level, but it's ringed by twenty metres of high ground. A model that just
> thresholds elevation floods it. We flood-fill from the ocean instead, so it
> stays dry. That's the difference between a map that looks right and a map
> that *is* right."

---

## 1:15 — 2:10 · The hospital route gets cut off

**Set the origin to Ferry Dock** (still at the storm peak).

The route panel turns coral:

> **No safe route** — "Every road out of the starting point is under water.
> Shelter in place and request water rescue."

> "The router doesn't throw an error or draw a broken line. The ferry dock is
> at 2.5 metres and the water is at 3.66 — it is genuinely unreachable, and the
> answer a dispatcher needs is *don't send a vehicle*."

**Now set From back to Kalinaw Marina and To to Ferry Dock.**

> "Different failure, different answer. The marina can still move; it's the
> destination that's gone. So the router runs a second pass and tells you where
> you *can* get to — Bayanihan School & Shelter, 1.93 km — and draws it as a
> dashed blue line."

---

## 2:10 — 3:00 · Safest mode reroutes around the *projected* flood

**Set To back to Kalinaw District Hospital, the horizon to `+12h`, and drag the
timeline back to hour 20.**

Conditions look survivable again — water is under a metre, only a handful of
roads closed. The route is back to **3.37 km across the causeway**.

But the panel is showing a warning:

> ⚠ *Salt Flat Causeway is predicted to flood within 12 h.*

> "The road is open right now, and *fastest* is happy to use it. But the model
> says it goes under inside the planning horizon — so taking it means betting
> on getting back before the surge."

**Now click `Safest`.**

The line jumps to the long way round:

- **5.96 km, 10 minutes** — 2.6 km further
- Zero warnings
- It crosses at the **Upper Ford Bridge**, high on the ridge, which never floods

> "Same A\*, same graph, same destination. The only difference is which edges
> it's allowed to use: *fastest* avoids what's flooded now, *safest* avoids
> anything the model says will flood within the horizon. The amber dashed line
> is the other option, so you can see the trade-off rather than just being told
> about it."

**Toggle the horizon between +6h and +24h** to close:

> "And that's a dial, not a constant. It sets both how far ahead the map looks
> and how much risk the router will accept — at +24 h it plans against the
> whole storm."

---

### The sharper version of that warning

If you want one more beat, set the horizon to `Now`, **From: Bayanihan School &
Shelter, To: Town Center Plaza**, and put the timeline at **hour 23.5** — right
as the water crosses the threshold:

> ⚠ *Mill Diagonal goes under while you are still on it — you reach it 2 min in.*

> "That one is not about the horizon. The route is open at the moment you set
> off; the model says the water closes it during the two minutes you would be
> driving it. That is the difference between a snapshot and a forecast."

### Closing beat — one engine, two surfaces

First, switch the rail to **Community** while still at the storm peak.

> "Same shelters, incidents and resources the field app shows — but run through
> the flood model. The Harbor Rd incident isn't just a pin any more, it's
> *under 3.61 m of water*. The generator isn't 240 m away, it's cut off. Every
> distance here is by road through what's still passable."

Now click **Mobile app** in the header.

Go to the **Map** tab and drag its scrubber to the storm peak.

> "That's the same flood model, the same road graph, the same router — on a
> phone. Not a copy: the field app loads the exact compiled module the
> dashboard imports. Look at the numbers: 3.66 metres, 38 of 97 roads cut, 95
> isolated cells. Identical, because there's only one engine.
>
> The dashboard is what the operations centre sees. This is what the people on
> the ground get — plus hazard reporting, resource sharing, a volunteer board,
> and an assistant that still answers when the network is gone."

If someone asks how you keep them in sync: `npm test` fails the build if the
browser bundle stops exposing anything the field app calls, or if the two ever
compute different conditions for the same moment.

## If you have 30 more seconds

- **`npm run test:flood`** — prints the water level and flooded-cell count over
  the whole window and asserts that the quarry stays dry at the peak.
- **`npm run test:routing`** — 22 assertions including "safest is never shorter
  than fastest", "the causeway is open at calm tide and impassable at the peak",
  and a timing check that a route recomputes in under 10 ms (it takes 0.1).
- **`npm run generate-data`** — regenerates the whole town deterministically
  from one seed.

## Questions you should expect

**"Is this real data?"**
No, and deliberately so — a live-judged demo that depends on a weather API is a
demo that fails at the worst moment. Everything is synthetic, generated from a
fixed seed, bundled as static files. The only network call is for basemap
tiles, and the app works without them.

**"Why not just threshold the elevation?"**
Because it floods inland basins that have no connection to the sea. Scrub to
the peak and look at the isolated-cell count — 95 cells the naive model gets
wrong.

**"Is the routing actually optimal?"**
Yes. A\* with a haversine heuristic over ground-distance edge weights — the
heuristic can never overestimate the remaining distance, so it's admissible and
A\* returns the true shortest path through the passable subgraph.

**"Why 30 cm?"**
That's roughly where a car loses traction and starts to float, and it's the
threshold emergency services use. Closing roads the moment they're merely wet
would sever the network at every high tide.

**"How does it stay smooth?"**
All 193 flood states are precomputed on load, about 250 ms. Each road segment's
DEM cells are cached at graph-build time. And because the flood mask is
monotonic in water level, "what floods in the next 12 hours" is the mask of the
highest level in that window — a scan over 50 numbers instead of merging 50
grids of 25,600 cells.
