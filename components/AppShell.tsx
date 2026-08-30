"use client";

/**
 * Top navigation and the live status strip, shared by every page.
 *
 * The nav mirrors the field app's bottom tab bar — Home, Map, Report,
 * Resources, Volunteer, Assistant — so the two surfaces have the same shape
 * as well as the same engine. On a phone-width screen it becomes a bottom bar,
 * which is where a thumb expects it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoastguard } from "@/lib/store";

const NAV = [
  { href: "/overview", label: "Overview", icon: "🏠" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/report", label: "Report", icon: "📷" },
  { href: "/resources", label: "Resources", icon: "📦" },
  { href: "/volunteer", label: "Volunteer", icon: "🤝" },
  { href: "/assistant", label: "Assistant", icon: "✨" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, horizon, ready } = useCoastguard();

  // The landing page talks about the product rather than operating it, so it
  // gets the wordmark and nothing else — a live water level above a hero
  // headline just reads as clutter.
  const isLanding = pathname === "/";

  return (
    <div className={`min-h-screen bg-sand lg:pb-0 ${isLanding ? "" : "pb-[66px]"}`}>
      <header className="border-b border-sand-dim bg-sand/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 lg:px-5">
          <Link href="/" className="mr-auto block">
            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Kalinaw Island
            </span>
            <span className="block font-serif text-[20px] font-semibold text-navy">
              CoastGuard AI
            </span>
          </Link>

          {/* Live strip. Present on every operating page, because "what is
              the water doing" is the question behind all of them. */}
          <div
            className={`items-center gap-2 ${isLanding ? "hidden" : "flex"}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <Chip
              tone={horizon > 0 ? "amber" : "teal"}
              label="Showing"
              value={horizon > 0 ? `Forecast +${horizon} h` : "Live now"}
            />
            <Chip
              label="Water"
              value={ready ? `${status.waterLevelM.toFixed(2)} m` : "—"}
            />
            <Chip
              label="Roads cut"
              value={ready ? String(status.blockedCount) : "—"}
              alert={ready && status.blockedCount / status.totalSegments > 0.2}
            />
            <Chip
              label="Cut off"
              value={ready ? String(status.cutOff.length) : "—"}
              alert={ready && status.cutOff.length > 0}
            />
          </div>

          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the CoastGuard AI mobile field app in a new tab"
            className="flex items-center gap-2 rounded-[14px] bg-navy px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-card transition-opacity hover:opacity-90"
          >
            <svg width="12" height="16" viewBox="0 0 13 17" fill="none" aria-hidden="true">
              <rect x="0.9" y="0.9" width="11.2" height="15.2" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
              <line x1="4.6" y1="13.2" x2="8.4" y2="13.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Field app
            <span aria-hidden="true" className="text-white/60">↗</span>
          </a>
        </div>

        {/* Desktop nav */}
        <nav
          aria-label="Sections"
          className={`mx-auto max-w-[1600px] gap-1 px-3 pb-2 lg:px-5 ${
            isLanding ? "hidden" : "hidden lg:flex"
          }`}
        >
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 py-4 lg:px-5">{children}</main>

      {/* Phone-width nav, mirroring the field app's bottom bar. */}
      <nav
        aria-label="Sections"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-sand-dim bg-card px-1 py-1.5 lg:hidden ${
          isLanding ? "hidden" : "flex"
        }`}
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`text-[17px] ${active ? "opacity-100" : "opacity-45"}`}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span
                className={`text-[9px] font-semibold ${
                  active ? "text-navy" : "text-ink-soft"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-chip px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active
          ? "bg-navy text-white"
          : "bg-card text-ink-soft shadow-card hover:text-navy"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}

function Chip({
  label,
  value,
  alert,
  tone,
}: {
  label: string;
  value: string;
  alert?: boolean;
  tone?: "amber" | "teal";
}) {
  const bg = alert
    ? "bg-coral-tint"
    : tone === "amber"
      ? "bg-amber-tint"
      : tone === "teal"
        ? "bg-teal-tint"
        : "bg-card";
  const fg = alert
    ? "text-coral-dark"
    : tone === "amber"
      ? "text-amber-dark"
      : tone === "teal"
        ? "text-teal-dark"
        : "text-navy";
  return (
    <div className={`rounded-[12px] px-2.5 py-1.5 text-center shadow-card ${bg}`}>
      <div className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </div>
      <div className={`font-serif text-[13.5px] font-semibold ${fg}`}>
        {value}
      </div>
    </div>
  );
}
