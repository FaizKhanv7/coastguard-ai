/**
 * ============================================================================
 * Community layer generator — Miami-Dade
 * ============================================================================
 * The field app originally carried its incidents, resources, volunteer jobs
 * and shelters as hardcoded arrays with hand-picked coordinates that had no
 * relationship to the DEM or the road graph, so the two surfaces disagreed
 * about where everything was and nothing in that layer could be routed to.
 *
 * This script places every one of those items on a real road-network node
 * drawn from the OSM road graph, with its elevation read from the USGS 3DEP
 * DEM. The output is `data/community.json`, read by BOTH surfaces, so:
 *
 *   - a shelter's elevation is measured, not guessed;
 *   - the router can path to any of these points;
 *   - the dashboard and the field app cannot drift apart.
 *
 * The records themselves are operational fixtures for the exercise, not a
 * feed of real incidents — `data_status` says so in the output.
 *
 * Deterministic: node choices are driven by position and elevation, not by
 * randomness, so re-running produces identical output for a given dataset.
 * ============================================================================
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { graph, landmarks, type GraphNode } from "../lib/routing";
import { elevationAt, isNoData } from "../lib/dem";

const OUT = join(process.cwd(), "data", "community.json");

const elevOf = (n: GraphNode) => elevationAt(n.lng, n.lat);

/*
 * Ranked by ground elevation, with no-data nodes dropped.
 *
 * A node whose DEM cell is open water reads as -9999, so an unfiltered "lowest
 * node" search puts every flood incident in the middle of Biscayne Bay. Those
 * nodes are still perfectly routable - a causeway crossing the bay is a real
 * road - they just have no ground elevation to rank by.
 */
const byElevation = [...graph.nodes]
  .map((n) => ({ node: n, elev: elevOf(n) }))
  .filter((e) => !isNoData(e.elev))
  .sort((a, b) => b.elev - a.elev);

function claimNearest(lng: number, lat: number, used: Set<string>): GraphNode {
  let best = graph.nodes[0];
  let bestD = Infinity;
  for (const n of graph.nodes) {
    if (used.has(n.id)) continue;
    const d = (n.lng - lng) ** 2 + (n.lat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  used.add(best.id);
  return best;
}

/** Highest unclaimed node — for things that belong on defensible ground. */
function claimHighest(used: Set<string>, minElev = 0): GraphNode {
  for (const { node, elev } of byElevation) {
    if (!used.has(node.id) && elev >= minElev) {
      used.add(node.id);
      return node;
    }
  }
  return claimNearest(graph.nodes[0].lng, graph.nodes[0].lat, used);
}

/** Lowest unclaimed node — for flood incidents. */
function claimLowest(used: Set<string>): GraphNode {
  for (let i = byElevation.length - 1; i >= 0; i--) {
    const { node } = byElevation[i];
    if (!used.has(node.id)) {
      used.add(node.id);
      return node;
    }
  }
  return claimNearest(graph.nodes[0].lng, graph.nodes[0].lat, used);
}

/** Landmark lookup that fails loudly rather than silently mis-placing things. */
function lm(id: string) {
  const found = landmarks.find((l) => l.id === id);
  if (!found) {
    throw new Error(
      `Landmark "${id}" is not in data/landmarks.json. Run "npm run generate-data" first — ` +
        `the community layer is placed relative to the landmarks.`,
    );
  }
  return found;
}

const place = (n: GraphNode) => ({
  nodeId: n.id,
  lng: Math.round(n.lng * 1e6) / 1e6,
  lat: Math.round(n.lat * 1e6) / 1e6,
  elevationM: Math.round(elevOf(n) * 10) / 10,
});

function build() {
  const used = new Set<string>();
  for (const l of landmarks) used.add(l.nodeId);

  const nodeOf = (id: string) =>
    graph.nodes.find((n) => n.id === lm(id).nodeId) ??
    claimNearest(lm(id).lng, lm(id).lat, used);

  // --- Shelters -----------------------------------------------------------
  const shelterSpecs = [
    {
      id: "shelter-convention",
      name: "Miami Beach Convention Center",
      type: "Primary evacuation centre",
      capacityTotal: 1500,
      capacityUsed: 640,
      accessible: true,
      node: nodeOf("miami-beach-convention"),
    },
    {
      id: "shelter-jackson",
      name: "Jackson Memorial Hospital",
      type: "Medical + evacuation",
      capacityTotal: 400,
      capacityUsed: 291,
      accessible: true,
      node: nodeOf("jackson-memorial"),
    },
    {
      id: "shelter-wolfson",
      name: "Miami Dade College, Wolfson Campus",
      type: "Secondary evacuation centre",
      capacityTotal: 900,
      capacityUsed: 210,
      accessible: true,
      node: claimHighest(used, 2),
    },
    {
      id: "shelter-coralway",
      name: "Coral Way K-8 Center",
      type: "Overflow shelter",
      capacityTotal: 350,
      capacityUsed: 44,
      accessible: false,
      node: claimHighest(used, 2),
    },
  ];

  const shelters = shelterSpecs.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    capacityTotal: s.capacityTotal,
    capacityUsed: s.capacityUsed,
    accessible: s.accessible,
    ...place(s.node),
  }));

  // --- Incidents ----------------------------------------------------------
  // Placed on the lowest ground the road graph reaches, so the flood model
  // corroborates them as the surge builds.
  const incidents = [
    {
      id: "inc-brickell",
      title: "Street flooding — Brickell Ave",
      category: "Flood",
      severity: "High" as const,
      icon: "🌊",
      reportedMinutesAgo: 18,
      confirmations: 31,
      ...place(claimLowest(used)),
    },
    {
      id: "inc-macarthur",
      title: "Surge over MacArthur Causeway",
      category: "Flood",
      severity: "High" as const,
      icon: "🌊",
      reportedMinutesAgo: 9,
      confirmations: 47,
      ...place(claimNearest(lm("macarthur-causeway").lng, lm("macarthur-causeway").lat, used)),
    },
    {
      id: "inc-biscayne",
      title: "Storm drain backflow — Biscayne Blvd",
      category: "Flood",
      severity: "Medium" as const,
      icon: "🌧️",
      reportedMinutesAgo: 64,
      confirmations: 12,
      ...place(claimLowest(used)),
    },
    {
      id: "inc-venetian",
      title: "Debris blocking Venetian Causeway",
      category: "Mobility Barrier",
      severity: "High" as const,
      icon: "♿",
      reportedMinutesAgo: 130,
      confirmations: 8,
      ...place(claimNearest(lm("venetian-checkpoint").lng, lm("venetian-checkpoint").lat, used)),
    },
  ];

  // --- Resources ----------------------------------------------------------
  const resources = [
    {
      id: "res-generator",
      name: "Trailer generator, 60 kW",
      category: "Tools",
      icon: "⚡",
      owner: "PortMiami Depot",
      verified: true,
      status: "Available",
      quantity: 2,
      ...place(claimNearest(lm("portmiami-depot").lng, lm("portmiami-depot").lat, used)),
    },
    {
      id: "res-water",
      name: "Bottled water, 4 pallets",
      category: "Water & food",
      icon: "💧",
      owner: "Miami Beach Convention Center",
      verified: true,
      status: "Available",
      quantity: 4,
      ...place(claimNearest(lm("miami-beach-convention").lng, lm("miami-beach-convention").lat, used)),
    },
    {
      id: "res-boats",
      name: "Shallow-water rescue boats (x3)",
      category: "Transport",
      icon: "🛥️",
      owner: "USCG Sector Miami",
      verified: true,
      status: "2 available",
      quantity: 2,
      ...place(claimNearest(lm("uscg-sector-miami").lng, lm("uscg-sector-miami").lat, used)),
    },
    {
      id: "res-medical",
      name: "Field trauma kits",
      category: "Medical",
      icon: "🩹",
      owner: "Jackson Memorial",
      verified: true,
      status: "Available",
      quantity: 12,
      ...place(claimNearest(lm("jackson-memorial").lng, lm("jackson-memorial").lat, used)),
    },
    {
      id: "res-meals",
      name: "Ready meals, 800 units",
      category: "Water & food",
      icon: "🍚",
      owner: "City of Miami Fire Rescue",
      verified: true,
      status: "Low stock",
      quantity: 1,
      ...place(claimNearest(lm("fire-rescue-hq").lng, lm("fire-rescue-hq").lat, used)),
    },
  ];

  // --- Volunteer jobs -----------------------------------------------------
  const volunteerJobs = [
    {
      id: "job-sandbag-brickell",
      title: "Sandbag line — Brickell waterfront",
      needed: 8,
      joined: 3,
      durationHours: 2,
      urgent: true,
      accessibility: false,
      verifiedBy: "City of Miami Fire Rescue",
      ...place(claimNearest(lm("brickell-zone-a").lng, lm("brickell-zone-a").lat, used)),
    },
    {
      id: "job-shelter-intake",
      title: "Shelter intake & registration",
      needed: 6,
      joined: 2,
      durationHours: 4,
      urgent: false,
      accessibility: false,
      verifiedBy: "Miami Beach Convention Center",
      ...place(claimNearest(lm("miami-beach-convention").lng, lm("miami-beach-convention").lat, used)),
    },
    {
      id: "job-ramp",
      title: "Accessible ramp check — evacuation route",
      needed: 2,
      joined: 1,
      durationHours: 1.5,
      urgent: true,
      accessibility: true,
      verifiedBy: "Miami-Dade Office of Emergency Management",
      ...place(claimNearest(lm("brickell-zone-a").lng, lm("brickell-zone-a").lat, used)),
    },
    {
      id: "job-causeway",
      title: "Clear debris — Venetian Causeway",
      needed: 5,
      joined: 0,
      durationHours: 3,
      urgent: true,
      accessibility: false,
      verifiedBy: "Venetian Causeway Checkpoint",
      ...place(claimNearest(lm("venetian-checkpoint").lng, lm("venetian-checkpoint").lat, used)),
    },
  ];

  return {
    description:
      "Community layer shared by the operations dashboard and the field app. " +
      "Every entry sits on a real OSM road-network node with its elevation read " +
      "from the USGS 3DEP DEM, so both surfaces agree on where it is and the " +
      "router can path to it.",
    data_status:
      "placement: derived from observed road graph and DEM; records: operational fixtures for exercise use, not a live incident feed",
    location: "Miami-Dade Coastal Metro, FL",
    generated_at: new Date().toISOString(),
    shelters,
    incidents,
    resources,
    volunteerJobs,
  };
}

const out = build();
writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log("CoastGuard AI - community layer generated (Miami-Dade)");
for (const key of ["shelters", "incidents", "resources", "volunteerJobs"] as const) {
  console.log(`  ${key.padEnd(14)} ${out[key].length}`);
}
console.log("\n  shelters by elevation:");
for (const s of out.shelters) {
  console.log(`    ${s.name.padEnd(36)} ${String(s.elevationM).padStart(6)} m`);
}
console.log("\n  incidents by elevation:");
for (const i of out.incidents) {
  console.log(`    ${i.title.padEnd(36)} ${String(i.elevationM).padStart(6)} m`);
}
