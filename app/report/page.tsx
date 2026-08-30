"use client";

/**
 * Report a hazard.
 *
 * The field app's version is built for someone standing in the water with a
 * phone: photograph it, let the assistant classify it, drop a pin. This is the
 * operations desk equivalent — an intake form for reports arriving by radio,
 * phone or from a field volunteer.
 *
 * What makes it more than a form is corroboration: the moment you place a
 * location, the flood model says what it expects there, so a report is
 * checked against the forecast before anyone is dispatched to it.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCoastguard } from "@/lib/store";
import { floodDepthAt, nearestNode, landmarks } from "@/lib/engine";
import { Card, Pill, SectionTitle } from "@/components/ui";

const CATEGORIES = [
  { value: "Flood", icon: "🌊", label: "Flooding" },
  { value: "Mobility Barrier", icon: "♿", label: "Mobility barrier" },
  { value: "Marine Debris / Erosion", icon: "🪸", label: "Debris / erosion" },
  { value: "Structural", icon: "🏚️", label: "Structural damage" },
];

const SEVERITIES = ["High", "Medium", "Low"] as const;

const fieldClass =
  "w-full rounded-[12px] border border-sand-dim bg-sand px-3 py-2.5 text-[13px] font-semibold text-navy";

export default function ReportPage() {
  const s = useCoastguard();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("High");
  const [placeId, setPlaceId] = useState(landmarks[0].id);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const place = landmarks.find((l) => l.id === placeId) ?? landmarks[0];

  // What the model expects at the reported location, now and shortly.
  const corroboration = useMemo(() => {
    const now = floodDepthAt(place.lng, place.lat, s.step, 0);
    const soon = floodDepthAt(place.lng, place.lat, s.step, 6);
    if (now > 0.02) {
      return {
        tone: "coral" as const,
        text: `The model has about ${now.toFixed(2)} m of water here right now. This report is consistent with the forecast.`,
      };
    }
    if (soon > 0.02) {
      return {
        tone: "amber" as const,
        text: `Dry here at this hour, but the model expects about ${soon.toFixed(2)} m within 6 hours. Worth pre-positioning for.`,
      };
    }
    return {
      tone: "teal" as const,
      text: "The model has this spot dry now and not flooding within 6 hours. Worth a second confirmation before dispatching.",
    };
  }, [place, s.step]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const node = nearestNode(place.lng, place.lat);
    const incident = s.reportIncident({
      title: title.trim() || `${category.label} — ${place.name}`,
      category: category.value,
      severity,
      icon: category.icon,
      lng: node.lng,
      lat: node.lat,
    });
    setSubmitted(incident.title);
    setTitle("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <SectionTitle>Log an incoming hazard report</SectionTitle>

        {submitted && (
          <div
            className="mb-4 flex items-start gap-2 rounded-[14px] bg-teal-tint p-3 text-[12px] font-semibold leading-relaxed text-teal-dark"
            role="status"
          >
            <span aria-hidden="true">✓</span>
            <span>
              “{submitted}” logged and placed on the road network. It is now on
              the map, the home overview and the field app&rsquo;s incident
              list.{" "}
              <button
                type="button"
                onClick={() => router.push("/map")}
                className="underline"
              >
                View on the map
              </button>
            </span>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              What is happening
            </span>
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${category.label} — ${place.name}`}
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              Category
            </legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={c.value === category.value}
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-1.5 rounded-chip px-3 py-2 text-[12px] font-semibold ${
                    c.value === category.value
                      ? "bg-navy text-white"
                      : "bg-sand text-ink-soft hover:text-navy"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                Nearest landmark
              </span>
              <select
                className={fieldClass}
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
              >
                {landmarks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                Severity
              </legend>
              <div className="flex gap-2">
                {SEVERITIES.map((sv) => (
                  <button
                    key={sv}
                    type="button"
                    aria-pressed={sv === severity}
                    onClick={() => setSeverity(sv)}
                    className={`flex-1 rounded-chip px-3 py-2.5 text-[12px] font-semibold ${
                      sv === severity
                        ? "bg-navy text-white"
                        : "bg-sand text-ink-soft hover:text-navy"
                    }`}
                  >
                    {sv}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <button
            type="submit"
            className="w-full rounded-[14px] bg-navy px-4 py-3.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Log report
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle action={<Pill tone={corroboration.tone}>Model check</Pill>}>
            Corroboration
          </SectionTitle>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            {corroboration.text}
          </p>
          <div className="mt-3 border-t border-sand-dim pt-2.5 text-[11px] leading-relaxed text-ink-soft">
            Checked at <strong className="text-navy">{place.name}</strong>,
            ground level {place.elevation.toFixed(1)} m, against the same flood
            model the map and the field app run.
          </div>
        </Card>

        <Card>
          <SectionTitle>How the field app does this</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            On a phone, a resident photographs the hazard and the assistant
            classifies it — severity, estimated depth, hazards present — then
            they drop a pin, and the same model check runs against that exact
            spot. Both paths end in one shared incident list.
          </p>
          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] font-semibold text-teal-dark hover:underline"
          >
            Open the field app ↗
          </a>
        </Card>

        <Card>
          <SectionTitle>Reports on file</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            <strong className="font-serif text-[18px] text-navy">
              {s.incidents.length}
            </strong>{" "}
            incidents logged across the town, covering{" "}
            {new Set(s.incidents.map((i) => i.category)).size} categories.
          </p>
        </Card>
      </div>
    </div>
  );
}
