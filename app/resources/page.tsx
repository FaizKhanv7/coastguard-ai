"use client";

/**
 * Resource sharing.
 *
 * Same shared inventory the field app shows, but every row carries what an
 * operations desk needs on top: how far it is by road right now, and whether
 * the flood has severed the route to it. A generator that is 240 m away and
 * unreachable is not a resource.
 */

import { useMemo, useState } from "react";
import { useCoastguard } from "@/lib/store";
import { Card, Pill, SectionTitle } from "@/components/ui";

const CATEGORIES = ["All", "Tools", "Water & food", "Medical", "Transport"];

const CATEGORY_BG: Record<string, string> = {
  Tools: "var(--color-amber-tint)",
  "Water & food": "var(--color-blue-tint)",
  Transport: "var(--color-teal-tint)",
  Medical: "var(--color-coral-tint)",
};

const fieldClass =
  "w-full rounded-[12px] border border-sand-dim bg-sand px-3 py-2.5 text-[13px] font-semibold text-navy";

export default function ResourcesPage() {
  const s = useCoastguard();
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState("Tools");
  const [quantity, setQuantity] = useState(1);

  const rows = useMemo(() => {
    const filtered =
      filter === "All"
        ? s.resources
        : s.resources.filter((r) => r.category === filter);
    return s.reach(filtered).sort(
      (a, b) =>
        Number(b.reachable) - Number(a.reachable) ||
        (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
    );
  }, [s, filter]);

  const reachableCount = s.reach(s.resources).filter((r) => r.reachable).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    s.addResource({
      name: name.trim(),
      category,
      icon: category === "Medical" ? "🩹" : category === "Transport" ? "🛶" : "📦",
      owner: owner.trim() || "Operations desk",
      quantity,
    });
    setName("");
    setOwner("");
    setQuantity(1);
    setShowForm(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <SectionTitle
          action={
            <Pill tone={reachableCount === s.resources.length ? "teal" : "coral"}>
              {reachableCount} of {s.resources.length} reachable
            </Pill>
          }
        >
          Shared resources
        </SectionTitle>

        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === filter}
              onClick={() => setFilter(c)}
              className={`flex-shrink-0 rounded-chip border px-3.5 py-1.5 text-[12px] font-semibold ${
                c === filter
                  ? "border-navy bg-navy text-white"
                  : "border-sand-dim bg-card text-ink-soft hover:text-navy"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <ul>
          {rows.map(({ item, reachable, distanceM, etaMinutes }) => {
            const isClaimed = s.claimed.has(item.id);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-sand-dim py-3 last:border-b-0"
              >
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] text-[19px]"
                  style={{
                    background: CATEGORY_BG[item.category] ?? "var(--color-sand-dim)",
                  }}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-navy">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-soft">
                    {item.owner}
                    {item.verified ? " ✔ verified" : ""} · {item.status}
                    {item.quantity > 1 ? ` · ${item.quantity} available` : ""}
                  </span>
                </span>

                <span className="flex flex-shrink-0 items-center gap-2">
                  {reachable ? (
                    <span className="text-right">
                      <span className="block text-[12.5px] font-bold text-navy">
                        {distanceM! >= 1000
                          ? `${(distanceM! / 1000).toFixed(1)} km`
                          : `${Math.round(distanceM!)} m`}
                      </span>
                      <span className="block text-[10px] text-ink-soft">
                        {Math.round(etaMinutes!)} min
                      </span>
                    </span>
                  ) : (
                    <Pill tone="coral">Cut off</Pill>
                  )}
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => s.toggleClaim(item.id)}
                    aria-pressed={isClaimed}
                    className={`rounded-chip px-3 py-2 text-[11.5px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
                      isClaimed
                        ? "bg-teal-tint text-teal-dark"
                        : "bg-navy text-white hover:opacity-90"
                    }`}
                  >
                    {isClaimed ? "Reserved" : "Reserve"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        {rows.length === 0 && (
          <p className="py-6 text-center text-[12px] text-ink-soft">
            No resources in this category.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Log a resource</SectionTitle>
          {showForm ? (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  What is it
                </span>
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Water pump"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  Held by
                </span>
                <input
                  className={fieldClass}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Operations desk"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                    Category
                  </span>
                  <select
                    className={fieldClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                    Quantity
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={fieldClass}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, +e.target.value))}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-[14px] bg-navy px-4 py-3 text-[13px] font-bold text-white hover:opacity-90"
                >
                  Add to inventory
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
              ＋ Log a resource
            </button>
          )}
        </Card>

        <Card>
          <SectionTitle>Why distances move</SectionTitle>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            These are network distances through roads that are still passable
            at the moment you are viewing — not straight lines. Scrub the
            timeline on the map and watch them change; anything the surge cuts
            off drops out entirely rather than quietly staying on the list.
          </p>
        </Card>
      </div>
    </div>
  );
}
