"use client";

/**
 * Volunteer dispatch.
 *
 * The field app shows a volunteer a board of jobs they can accept. This is the
 * other side of it: the desk that posts the jobs and has to know whether a
 * volunteer can physically reach one before assigning it.
 */

import { useMemo, useState } from "react";
import { useCoastguard } from "@/lib/store";
import { Card, Pill, SectionTitle } from "@/components/ui";

const FILTERS = ["All", "Urgent", "Accessibility", "Needs people"] as const;

const fieldClass =
  "w-full rounded-[12px] border border-sand-dim bg-sand px-3 py-2.5 text-[13px] font-semibold text-navy";

export default function VolunteerPage() {
  const s = useCoastguard();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [needed, setNeeded] = useState(2);
  const [durationHours, setDurationHours] = useState(1);
  const [urgent, setUrgent] = useState(false);
  const [accessibility, setAccessibility] = useState(false);

  const filledFor = (jobId: string, base: number) =>
    base + (s.joined.has(jobId) ? 1 : 0);

  const rows = useMemo(() => {
    const filtered = s.jobs.filter((j) => {
      if (filter === "Urgent") return j.urgent;
      if (filter === "Accessibility") return j.accessibility;
      if (filter === "Needs people") return filledFor(j.id, j.joined) < j.needed;
      return true;
    });
    return s.reach(filtered).sort(
      (a, b) =>
        Number(b.item.urgent) - Number(a.item.urgent) ||
        Number(b.reachable) - Number(a.reachable) ||
        (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
    );
  }, [s, filter]);

  const unreachable = s.reach(s.jobs).filter((r) => !r.reachable).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    s.addJob({ title: title.trim(), needed, durationHours, urgent, accessibility });
    setTitle("");
    setNeeded(2);
    setDurationHours(1);
    setUrgent(false);
    setAccessibility(false);
    setShowForm(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <SectionTitle
          action={
            unreachable ? (
              <Pill tone="coral">{unreachable} unreachable</Pill>
            ) : (
              <Pill tone="teal">All reachable</Pill>
            )
          }
        >
          Open jobs
        </SectionTitle>

        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === filter}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 rounded-chip border px-3.5 py-1.5 text-[12px] font-semibold ${
                f === filter
                  ? "border-navy bg-navy text-white"
                  : "border-sand-dim bg-card text-ink-soft hover:text-navy"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {rows.map(({ item, reachable, distanceM, etaMinutes }) => {
            const filled = filledFor(item.id, item.joined);
            const full = filled >= item.needed;
            const isJoined = s.joined.has(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-[16px] border border-sand-dim p-3.5 ${
                  reachable ? "bg-card" : "bg-sand opacity-80"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-serif text-[14.5px] font-semibold text-navy">
                    {item.title}
                  </h3>
                  <span className="flex flex-shrink-0 gap-1.5">
                    {item.urgent && <Pill tone="coral">Urgent</Pill>}
                    {item.accessibility && <Pill tone="teal">Accessibility</Pill>}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-semibold text-ink-soft">
                  <span>
                    {reachable
                      ? `📍 ${
                          distanceM! >= 1000
                            ? `${(distanceM! / 1000).toFixed(1)} km`
                            : `${Math.round(distanceM!)} m`
                        } · ${Math.round(etaMinutes!)} min`
                      : "⚠️ No road route right now"}
                  </span>
                  <span>
                    👥 {filled}/{item.needed} volunteers
                  </span>
                  <span>⏱ ~{item.durationHours} hr</span>
                  <span>✔ {item.verifiedBy}</span>
                </div>

                {/* Progress toward the number of people needed. Encoded as a
                    bar AND as the count above, not colour alone. */}
                <div
                  className="mb-3 h-1.5 overflow-hidden rounded-full bg-sand-dim"
                  role="img"
                  aria-label={`${filled} of ${item.needed} volunteers assigned`}
                >
                  <div
                    className={`h-full rounded-full ${full ? "bg-teal" : "bg-amber"}`}
                    style={{
                      width: `${Math.min(100, (filled / item.needed) * 100)}%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => s.toggleJoin(item.id)}
                  aria-pressed={isJoined}
                  className={`w-full rounded-[14px] px-4 py-2.5 text-[13px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
                    isJoined
                      ? "bg-teal-tint text-teal-dark"
                      : "bg-navy text-white hover:opacity-90"
                  }`}
                >
                  {!reachable
                    ? "Cannot be reached"
                    : isJoined
                      ? "Assigned — tap to release"
                      : "Assign a volunteer"}
                </button>
              </div>
            );
          })}
        </div>

        {rows.length === 0 && (
          <p className="py-6 text-center text-[12px] text-ink-soft">
            No jobs match this filter.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Post a job</SectionTitle>
          {showForm ? (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  What needs doing
                </span>
                <input
                  className={fieldClass}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sandbag the marina approach"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                    People needed
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={fieldClass}
                    value={needed}
                    onChange={(e) => setNeeded(Math.max(1, +e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                    Hours
                  </span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    className={fieldClass}
                    value={durationHours}
                    onChange={(e) =>
                      setDurationHours(Math.max(0.5, +e.target.value))
                    }
                  />
                </label>
              </div>
              <div className="flex gap-4 text-[12px] font-semibold text-navy">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={urgent}
                    onChange={(e) => setUrgent(e.target.checked)}
                  />
                  Urgent
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={accessibility}
                    onChange={(e) => setAccessibility(e.target.checked)}
                  />
                  Accessibility work
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-[14px] bg-navy px-4 py-3 text-[13px] font-bold text-white hover:opacity-90"
                >
                  Post job
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-[14px] bg-sand px-4 py-3 text-[13px] font-bold text-navy"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full rounded-[14px] bg-navy px-4 py-3 text-[13px] font-bold text-white hover:opacity-90"
            >
              ＋ Post a job
            </button>
          )}
        </Card>

        <Card>
          <SectionTitle>Dispatch safety</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            A job whose site cannot be reached over passable roads is disabled
            rather than merely flagged. The whole point of the model is to stop
            someone being sent somewhere the water has already closed off.
          </p>
        </Card>
      </div>
    </div>
  );
}
