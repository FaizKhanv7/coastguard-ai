"use client";

/**
 * Map legend. Every entry shows the actual mark used on the map — the dash
 * pattern for closed roads, the hatch for flooded ground — rather than a
 * plain colour chip, so the legend works for a viewer who cannot tell the
 * colours apart.
 */

export default function LegendBar() {
  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">
        Legend
      </h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
        <Item label="Flooded (hatched, darker = deeper)">
          <svg width="26" height="14" aria-hidden="true">
            <defs>
              <pattern
                id="lg-hatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="#4E86A6" />
                <rect width="2" height="6" fill="#1D4A62" />
              </pattern>
            </defs>
            <rect width="26" height="14" rx="3" fill="url(#lg-hatch)" />
          </svg>
        </Item>

        <Item label="Road open">
          <svg width="26" height="14" aria-hidden="true">
            <line x1="1" y1="7" x2="25" y2="7" stroke="#3C4A46" strokeWidth="2.5" />
          </svg>
        </Item>

        <Item label="Road impassable (dashed)">
          <svg width="26" height="14" aria-hidden="true">
            <line
              x1="1"
              y1="7"
              x2="25"
              y2="7"
              stroke="#E2572B"
              strokeWidth="3"
              strokeDasharray="4 3"
            />
          </svg>
        </Item>

        <Item label="Selected route (solid)">
          <svg width="26" height="14" aria-hidden="true">
            <line
              x1="1"
              y1="7"
              x2="25"
              y2="7"
              stroke="#1F8A70"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </Item>

        <Item label="Other risk mode (dashed)">
          <svg width="26" height="14" aria-hidden="true">
            <line
              x1="1"
              y1="7"
              x2="25"
              y2="7"
              stroke="#E3A008"
              strokeWidth="3.5"
              strokeDasharray="5 3"
            />
          </svg>
        </Item>

        <Item label="Cut off">
          <svg width="26" height="14" aria-hidden="true">
            <circle cx="9" cy="7" r="6" fill="#9E3A18" stroke="#fff" strokeWidth="1.6" />
            <text x="18" y="11" fontSize="11" fill="#9E3A18">
              ⚠
            </text>
          </svg>
        </Item>
      </ul>
    </div>
  );
}

function Item({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
      {children}
      <span>{label}</span>
    </li>
  );
}
