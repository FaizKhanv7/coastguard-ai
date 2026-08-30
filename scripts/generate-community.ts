/**
 * ============================================================================
 * Community layer generator
 * ============================================================================
 * The field app originally carried its incidents, resources, volunteer jobs
 * and shelters as hardcoded arrays with hand-picked coordinates. Those points
 * were inside the town's bounding box but had no relationship to the DEM or
 * the road graph, so the two surfaces disagreed about where everything was and
 * nothing in that layer could be routed to or checked against the flood model.
 *
 * This script re-places every one of those items on a real road-network node,
 * keeping the names and the human content the field app already had. The
 * output is `data/community.json`, read by BOTH surfaces, which means:
 *
 *   - a shelter's elevation is its actual DEM elevation, not a guess;
 *   - the router can path to any of these points, because each one sits on
 *     the graph;
 *   - the dashboard and the field app cannot drift apart, because there is
 *     one file.
 *
 * Deterministic: node choices are driven by position and elevation, not by
 * randomness, so re-running produces identical output.
 * ============================================================================
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { graph, landmarks, type GraphNode } from "../lib/routing";
import { elevationAt } from "../lib/dem";

const OUT = join(process.cwd(), "data", "community.json");

// ---------------------------------------------------------------------------
// Node selection helpers
// ---------------------------------------------------------------------------

const elevOf = (n: GraphNode) => elevationAt(n.lng, n.lat);

/** Every graph node with its elevation, highest first. */
const byElevation = [...graph.nodes]
  .map((n) => ({ node: n, elev: elevOf(n) }))
  .sort((a, b) => b.elev - a.elev);

/** Nearest graph node to a lng/lat, excluding ones already claimed. */
function claimNearest(
  lng: number,
  lat: number,
  used: Set<string>,
): GraphNode {
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

/** Highest unclaimed node, for things that belong on high ground. */
function claimHighest(used: Set<string>, minElev = 0): GraphNode {
  for (const { node, elev } of byElevation) {
    if (!used.has(node.id) && elev >= minElev) {
      used.add(node.id);
      return node;
    }
  }
  return claimNearest(graph.nodes[0].lng, graph.nodes[0].lat, used);
}

/** Lowest unclaimed node, for flood incidents. */
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

const lm = (id: string) => landmarks.find((l) => l.id === id)!;

const place = (n: GraphNode) => ({
  nodeId: n.id,
  lng: Math.round(n.lng * 1e6) / 1e6,
  lat: Math.round(n.lat * 1e6) / 1e6,
  elevationM: Math.round(elevOf(n) * 10) / 10,
});

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
  const used = new Set<string>();

  // Landmarks are already placed; don't put community items on top of them.
  for (const l of landmarks) used.add(l.nodeId);

  // --- Shelters -----------------------------------------------------------
  // These are evacuation centres, so they go on the highest ground available.
  // The two named landmarks that genuinely are shelters come first and reuse
  // their own nodes rather than being duplicated somewhere else.
  const shelterSpecs = [
    {
      id: "shelter-school",
      name: "Bayanihan School & Shelter",
      type: "Primary evacuation centre",
      capacityTotal: 240,
      capacityUsed: 96,
      accessible: true,
      node: graph.nodes.find((n) => n.id === lm("shelter").nodeId)!,
    },
    {
      id: "shelter-hospital",
      name: "Kalinaw District Hospital",
      type: "Medical + evacuation",
      capacityTotal: 120,
      capacityUsed: 71,
      accessible: true,
      node: graph.nodes.find((n) => n.id === lm("hospital").nodeId)!,
    },
    {
      id: "shelter-hilltop",
      name: "Hilltop Barangay Hall",
      type: "Secondary evacuation centre",
      capacityTotal: 80,
      capacityUsed: 65,
      accessible: false,
      node: claimHighest(used, 12),
    },
    {
      id: "shelter-church",
      name: "St. Isidro Church Hall",
      type: "Overflow shelter",
      capacityTotal: 60,
      capacityUsed: 12,
      accessible: true,
      node: claimHighest(used, 8),
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
  // Flood and access incidents belong on low ground, near the water, so the
  // simulation actually corroborates them as the surge comes in.
  const incidents = [
    {
      id: "inc-harbor",
      title: "Flooding — Harbor Rd",
      category: "Flood",
      severity: "High" as const,
      icon: "🌊",
      reportedMinutesAgo: 22,
      confirmations: 14,
      ...place(claimLowest(used)),
    },
    {
      id: "inc-ramp",
      title: "Blockage — North Ramp",
      category: "Mobility Barrier",
      severity: "High" as const,
      icon: "♿",
      reportedMinutesAgo: 95,
      confirmations: 6,
      ...place(claimNearest(lm("ferry").lng, lm("ferry").lat, used)),
    },
    {
      id: "inc-debris",
      title: "Marine Debris — East Shore",
      category: "Marine Debris / Erosion",
      severity: "Medium" as const,
      icon: "🪸",
      reportedMinutesAgo: 180,
      confirmations: 5,
      ...place(claimLowest(used)),
    },
    {
      id: "inc-causeway",
      title: "Water over the Salt Flat Causeway",
      category: "Flood",
      severity: "High" as const,
      icon: "🌊",
      reportedMinutesAgo: 8,
      confirmations: 21,
      ...place(claimNearest(lm("marina").lng, lm("marina").lat, used)),
    },
  ];

  // --- Resources ----------------------------------------------------------
  const resources = [
    {
      id: "res-generator",
      name: "Portable generator",
      category: "Tools",
      icon: "⚡",
      owner: "Jun",
      verified: true,
      status: "Available",
      quantity: 1,
      ...place(claimNearest(lm("town-center").lng, lm("town-center").lat, used)),
    },
    {
      id: "res-water",
      name: "Bottled water, 40 units",
      category: "Water & food",
      icon: "💧",
      owner: "Shelter Manager Santos",
      verified: true,
      status: "Available",
      quantity: 40,
      ...place(claimNearest(lm("shelter").lng, lm("shelter").lat, used)),
    },
    {
      id: "res-kayaks",
      name: "Kayaks (x2)",
      category: "Transport",
      icon: "🛶",
      owner: "Alma",
      verified: false,
      status: "1 left",
      quantity: 1,
      ...place(claimNearest(lm("marina").lng, lm("marina").lat, used)),
    },
    {
      id: "res-medical",
      name: "Medical supplies kit",
      category: "Medical",
      icon: "🩹",
      owner: "Dr. Reyes (Clinic)",
      verified: true,
      status: "Available",
      quantity: 3,
      ...place(claimNearest(lm("hospital").lng, lm("hospital").lat, used)),
    },
    {
      id: "res-rice",
      name: "Rice & canned goods",
      category: "Water & food",
      icon: "🍚",
      owner: "Nena",
      verified: true,
      status: "Low stock",
      quantity: 2,
      ...place(claimNearest(lm("ferry").lng, lm("ferry").lat, used)),
    },
  ];

  // --- Volunteer jobs -----------------------------------------------------
  const volunteerJobs = [
    {
      id: "job-debris",
      title: "Clear debris — Harbor Rd",
      needed: 3,
      joined: 1,
      durationHours: 1.5,
      urgent: true,
      accessibility: false,
      verifiedBy: "Community Leader",
      ...place(claimNearest(lm("town-center").lng, lm("town-center").lat, used)),
    },
    {
      id: "job-water",
      title: "Distribute water & medicines",
      needed: 2,
      joined: 0,
      durationHours: 1,
      urgent: false,
      accessibility: false,
      verifiedBy: "Shelter Manager",
      ...place(claimNearest(lm("shelter").lng, lm("shelter").lat, used)),
    },
    {
      id: "job-ramp",
      title: "Repair wheelchair access ramp",
      needed: 2,
      joined: 1,
      durationHours: 1,
      urgent: true,
      accessibility: true,
      verifiedBy: "Local Medic",
      ...place(claimNearest(lm("ferry").lng, lm("ferry").lat, used)),
    },
    {
      id: "job-sandbag",
      title: "Sandbag the causeway approach",
      needed: 5,
      joined: 2,
      durationHours: 2,
      urgent: true,
      accessibility: false,
      verifiedBy: "Barangay Captain",
      ...place(claimNearest(lm("marina").lng, lm("marina").lat, used)),
    },
  ];

  return {
    description:
      "Community layer shared by the operations dashboard and the field app. " +
      "Every entry sits on a real road-network node, so both surfaces agree " +
      "on where it is and the router can path to it.",
    shelters,
    incidents,
    resources,
    volunteerJobs,
  };
}

const out = build();
writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log("CoastGuard AI - community layer generated");
for (const key of ["shelters", "incidents", "resources", "volunteerJobs"] as const) {
  console.log(`  ${key.padEnd(14)} ${out[key].length}`);
}
console.log("\n  shelters by elevation:");
for (const s of out.shelters) {
  console.log(`    ${s.name.padEnd(30)} ${String(s.elevationM).padStart(6)} m  (${s.nodeId})`);
}
console.log("\n  incidents by elevation:");
for (const i of out.incidents) {
  console.log(`    ${i.title.padEnd(38)} ${String(i.elevationM).padStart(6)} m  (${i.nodeId})`);
}
