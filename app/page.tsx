"use client";

import Link from "next/link";
import LandingScene from "@/components/LandingScene";

export default function LandingPage() {
  return (
    <div className="landing-root relative h-[100dvh] overflow-hidden">
      <LandingScene />

      {/* Atmospheric overlays */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-deep/40 via-transparent to-navy-deep/80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(31,138,112,0.25), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Floating particles */}
      <div className="landing-particles pointer-events-none absolute inset-0" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="landing-particle absolute rounded-full bg-teal/40"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-16 pt-8 text-center">
        <div className="landing-badge mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
          </span>
          Miami-Dade · Live simulation
        </div>

        <h1 className="landing-title max-w-[14ch] font-serif text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.05] tracking-tight text-white">
          Predict floods.
          <br />
          <span className="bg-gradient-to-r from-teal via-teal to-amber bg-clip-text text-transparent">
            Route around them.
          </span>
        </h1>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
          Real elevation, tide, and road data — forecast and safe routing in one
          place.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/overview" className="landing-btn-primary group">
            <span>Open the dashboard</span>
            <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/map" className="landing-btn-secondary">
            Go to the map
          </Link>
          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-btn-secondary"
          >
            Field app ↗
          </a>
        </div>

        {/* Minimal scroll hint */}
        <div className="landing-scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
          Move to explore
        </div>
      </div>
    </div>
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  size: `${2 + (i % 3)}px`,
  delay: (i * 0.7) % 5,
  duration: 4 + (i % 4),
}));

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
