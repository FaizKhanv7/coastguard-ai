/**
 * ============================================================================
 * Grounded assistant
 * ============================================================================
 * The field app's assistant calls a hosted LLM and falls back to canned advice
 * when there is no key — which, since the key must never be committed, is
 * always. That is fine for generic safety guidance but it cannot answer the
 * question people actually have, which is about *this town, at this hour*.
 *
 * So this one does not guess. It reads the question, works out what is being
 * asked, and answers from the flood model and the router. "Can I get to the
 * hospital?" runs A* and tells you the distance, or tells you the road is
 * severed and what to do instead.
 *
 * A pure function of (question, context) so it can be unit-tested with no
 * browser and no network. If a real LLM is ever wired in, it should go through
 * a server route with the key server-side, and these answers become its tools.
 * ============================================================================
 */

import {
  community,
  statusAt,
  route as engineRoute,
  bestShelter,
  reachability,
  floodDepthAt,
  levelSeries,
  landmarks,
  shortName,
  formatClock,
  STEP_HOURS,
  STEP_COUNT,
  type RiskTolerance,
} from "./engine";

export interface AskContext {
  step: number;
  horizonH: number;
  mode: RiskTolerance;
  originNodeId: string;
}

export interface Answer {
  text: string;
  /** Where the answer came from, shown so nobody mistakes it for an opinion. */
  basis: string;
}

const km = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

/** "1 key location" / "3 key locations". */
const plural = (n: number, one: string, many = one + "s") =>
  `${n} ${n === 1 ? one : many}`;

/** Every place the assistant can be asked about, by name. */
function placeIndex() {
  const entries: { name: string; nodeId: string; lng: number; lat: number }[] =
    landmarks.map((l) => ({
      name: l.name,
      nodeId: l.nodeId,
      lng: l.lng,
      lat: l.lat,
    }));
  for (const sh of community.shelters) {
    entries.push({ name: sh.name, nodeId: sh.nodeId, lng: sh.lng, lat: sh.lat });
  }
  return entries;
}

/** Loose name match — "hospital" should find "Kalinaw District Hospital". */
function findPlace(q: string) {
  const lower = q.toLowerCase();
  const all = placeIndex();
  // Longest matching name wins, so "school" does not beat "school & shelter".
  let best: (typeof all)[number] | null = null;
  for (const p of all) {
    const words = p.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
    const hit = words.some((w) => lower.includes(w));
    if (hit && (!best || p.name.length > best.name.length)) best = p;
  }
  if (best) return best;
  // A few colloquial aliases the dataset does not spell out.
  if (/\bdock|ferry|pier\b/.test(lower))
    return all.find((p) => p.name.includes("Ferry")) ?? null;
  if (/\bclinic|medic|doctor\b/.test(lower))
    return all.find((p) => p.name.includes("Hospital")) ?? null;
  return null;
}

export function ask(question: string, ctx: AskContext): Answer {
  const q = question.trim().toLowerCase();
  const status = statusAt(ctx.step, ctx.horizonH, ctx.originNodeId);
  const when =
    ctx.horizonH > 0
      ? `the +${ctx.horizonH} h forecast`
      : `${formatClock(ctx.step)}`;

  if (!q) {
    return {
      text: "Ask me about the water level, which roads are closed, where to evacuate to, or whether you can still reach somewhere.",
      basis: "—",
    };
  }

  // --- When does it peak? --------------------------------------------------
  if (/\bpeak|worst|highest|when.*(bad|flood)|how bad\b/.test(q)) {
    let peakIdx = 0;
    for (let i = 1; i < STEP_COUNT; i++) {
      if (levelSeries[i] > levelSeries[peakIdx]) peakIdx = i;
    }
    const hoursAway = (peakIdx - ctx.step) * STEP_HOURS;
    const peakStatus = statusAt(peakIdx, 0, ctx.originNodeId);
    return {
      text:
        `The surge peaks at ${levelSeries[peakIdx].toFixed(2)} m on ${formatClock(peakIdx)}` +
        (hoursAway > 0
          ? `, about ${hoursAway.toFixed(1)} hours from where the timeline is now. `
          : `, which has already passed. `) +
        `At the peak the model closes ${peakStatus.blockedCount} of ${peakStatus.totalSegments} road segments and cuts off ${plural(peakStatus.cutOff.length, "key location")}.`,
      basis: "Flood model, full 48 h window",
    };
  }

  // --- Where should people go? --------------------------------------------
  if (/\bevacuat|shelter|where.*(go|safe)|safest place|higher ground\b/.test(q)) {
    const best = bestShelter(ctx.originNodeId, {
      step: ctx.step,
      horizonH: ctx.horizonH,
      mode: ctx.mode,
    });
    if (!best) {
      return {
        text: "No evacuation centre is reachable by road from here at this moment — every route out is under water. Shelter in place on the highest floor available and request water rescue.",
        basis: `Router, ${when}, ${ctx.mode} mode`,
      };
    }
    const free = best.item.capacityTotal - best.item.capacityUsed;
    return {
      text:
        `Send people to ${best.item.name} — ${km(best.distanceM!)} by road, about ${Math.round(best.etaMinutes!)} minutes, ` +
        `on ground ${best.item.elevationM} m above sea level with ${free} spaces open` +
        `${best.item.accessible ? " and step-free access" : ""}. ` +
        `That is chosen by the router over passable roads, not by straight-line distance.`,
      basis: `Router + shelter capacity, ${when}`,
    };
  }

  // --- Can I reach a specific place? --------------------------------------
  if (/\breach|get to|route|road to|drive|can i|how far\b/.test(q)) {
    const place = findPlace(q);
    if (!place) {
      return {
        text: `I could not tell which place you mean. Try one of: ${landmarks.map((l) => shortName(l)).join(", ")}.`,
        basis: "—",
      };
    }
    const r = engineRoute(ctx.originNodeId, place.nodeId, {
      step: ctx.step,
      horizonH: ctx.horizonH,
      mode: ctx.mode,
    });
    if (!r.ok) {
      const alt = r.nearestReachable;
      return {
        text:
          `${r.message}` +
          (alt
            ? ` The nearest place you can still reach is ${alt.landmark.name}, ${km(alt.distanceM)} away.`
            : ""),
        basis: `A* router, ${when}, ${ctx.mode} mode`,
      };
    }
    const warn = r.warnings.length
      ? ` Watch out: ${[...new Set(r.warnings.map((w) => w.roadName))].join(", ")} ${r.warnings.length === 1 ? "is" : "are"} flagged by the forecast.`
      : " The route is clear the whole way.";
    return {
      text: `Yes — ${place.name} is ${km(r.distanceM)} away, about ${Math.round(r.etaMinutes)} minutes by road in ${ctx.mode} mode.${warn}`,
      basis: `A* router, ${when}, ${ctx.mode} mode`,
    };
  }

  // --- Is somewhere under water? ------------------------------------------
  if (/\bunder water|flooded|deep|depth|水|is it wet\b/.test(q)) {
    const place = findPlace(q);
    if (place) {
      const depth = floodDepthAt(place.lng, place.lat, ctx.step, ctx.horizonH);
      const soon = floodDepthAt(place.lng, place.lat, ctx.step, 6);
      if (depth > 0.02) {
        return {
          text: `${place.name} is standing in about ${depth.toFixed(2)} m of water at ${when}.`,
          basis: "Flood model, connectivity fill",
        };
      }
      return {
        text:
          `${place.name} is dry at ${when}.` +
          (soon > 0.02
            ? ` The model expects about ${soon.toFixed(2)} m there within 6 hours, so it is worth moving anything valuable now.`
            : " It is not expected to flood within 6 hours either."),
        basis: "Flood model, connectivity fill",
      };
    }
    return {
      text: `${(status.floodedFraction * 100).toFixed(1)}% of the town's land area is under water at ${when}, and ${status.blockedCount} of ${status.totalSegments} road segments are impassable.`,
      basis: "Flood model, connectivity fill",
    };
  }

  // --- Which roads are closed? --------------------------------------------
  if (/\broad|closed|blocked|passable|impassable|traffic\b/.test(q)) {
    return {
      text:
        `${status.blockedCount} of ${status.totalSegments} road segments are impassable at ${when} — that is ${Math.round((status.blockedCount / status.totalSegments) * 100)}% of the network. ` +
        (status.cutOff.length
          ? `${status.cutOff.map(shortName).join(", ")} ${status.cutOff.length === 1 ? "is" : "are"} cut off entirely.`
          : "Every key location is still reachable."),
      basis: `Road graph vs flood model, ${when}`,
    };
  }

  // --- Resources -----------------------------------------------------------
  if (/\bresource|supplies|water bottle|generator|kit|food\b/.test(q)) {
    const rows = reachability(community.resources, ctx.originNodeId, {
      step: ctx.step,
      horizonH: ctx.horizonH,
      mode: ctx.mode,
    }).filter((r) => r.reachable);
    if (!rows.length) {
      return {
        text: "No shared resources are reachable by road from here at this moment.",
        basis: `Router, ${when}`,
      };
    }
    rows.sort((a, b) => a.distanceM! - b.distanceM!);
    const top = rows.slice(0, 3);
    return {
      text: `${rows.length} shared resources are still reachable. Closest: ${top
        .map((r) => `${r.item.name} (${km(r.distanceM!)})`)
        .join(", ")}.`,
      basis: `Shared inventory + router, ${when}`,
    };
  }

  // --- Conditions / catch-all ---------------------------------------------
  if (/\bwater level|tide|surge|rain|wind|condition|status|now\b/.test(q)) {
    return {
      text:
        `At ${when}: water ${status.waterLevelM.toFixed(2)} m (tide ${status.tideM.toFixed(2)} + surge ${status.surgeM.toFixed(2)}), ` +
        `rain ${status.rainfallMmHr.toFixed(1)} mm/h, wind ${status.windKph.toFixed(0)} km/h. ` +
        `${plural(status.blockedCount, "road segment")} impassable, ${plural(status.cutOff.length, "key location")} cut off.`,
      basis: `Flood model, ${when}`,
    };
  }

  return {
    text:
      `I answer from the live flood model rather than from general advice, so I am best at questions about this town. Try: "can I reach the hospital", ` +
      `"where should we evacuate to", "which roads are closed", "when does it peak", or "is the ferry dock under water". ` +
      `Right now the water is ${status.waterLevelM.toFixed(2)} m with ${status.blockedCount} road segments impassable.`,
    basis: `Flood model, ${when}`,
  };
}

/** Suggested prompts, so the box is not a blank stare. */
export const SUGGESTIONS = [
  "Where should we evacuate to?",
  "Can I reach the hospital?",
  "Which roads are closed?",
  "When does it peak?",
  "Is the ferry dock under water?",
];
