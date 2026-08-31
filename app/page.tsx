"use client";

/**
 * Marketing landing page.
 *
 * `/` sells the product; `/overview` operates it. This page therefore brings
 * its own header and footer (AppShell steps aside for it) but not its own
 * palette: sand ground, white cards, navy ink, teal accent, Fraunces
 * headings — the same tokens every operating screen uses, so arriving at the
 * dashboard feels like walking further into the same building.
 *
 * Every number on this page is a real property of the shipped dataset, taken
 * from `data/*.json`. Nothing here is a placeholder, because a flood tool that
 * exaggerates on its own landing page has already lost the argument.
 */

import Link from "next/link";
import LandingScene from "@/components/LandingScene";

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen">
      <LandingNav />
      <main>
        <Hero />
        <DataRail />
        <Features />
        <HowItWorks />
        <Assistant />
        <TwoSurfaces />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ========================================================================== */
/* Navigation                                                                 */
/* ========================================================================== */

const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#how", label: "How it works" },
  { href: "#assistant", label: "Assistant" },
  { href: "#faq", label: "FAQ" },
];

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-sand-dim/70 bg-sand/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-6 px-5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          aria-label="CoastGuard AI home"
        >
          <Wordmark />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-serif text-[17px] font-semibold text-navy sm:text-[19px]">
              CoastGuard AI
            </span>
            <span className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-ink-soft sm:text-[9.5px]">
              Miami-Dade, Florida
            </span>
          </span>
        </Link>

        <nav aria-label="Page sections" className="mx-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-chip px-3.5 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-sand-dim/60 hover:text-navy"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-chip px-3.5 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-navy sm:block"
          >
            Field app ↗
          </a>
          <Link
            href="/overview"
            className="flex-shrink-0 whitespace-nowrap rounded-[13px] bg-navy px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(14,42,51,0.7)] transition-colors hover:bg-[#123640] sm:px-4 sm:text-[13px]"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy"
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M2 13.4c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6"
          stroke="var(--color-teal)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M2 17c1.6 0 1.6-1.6 3.2-1.6S6.8 17 8.4 17s1.6-1.6 3.2-1.6S13.2 17 14.8 17s1.6-1.6 3.2-1.6"
          stroke="var(--color-blue)"
          strokeWidth="1.7"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M10 2.6 16.2 9H3.8L10 2.6Z"
          fill="var(--color-amber)"
          opacity="0.95"
        />
      </svg>
    </span>
  );
}

/* ========================================================================== */
/* Hero                                                                       */
/* ========================================================================== */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="landing-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1180px] px-5 pb-16 pt-16 sm:pt-24">
        <div className="mx-auto max-w-[760px] text-center">
          <div
            className="landing-rise inline-flex items-center gap-2 rounded-chip border border-sand-dim bg-card/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-ink-soft shadow-card backdrop-blur"
            style={{ "--rise-delay": "0s" } as React.CSSProperties}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            48-hour simulation running live
          </div>

          <h1
            className="landing-rise landing-title mt-6 font-serif text-[clamp(2.5rem,6vw,4.1rem)] font-semibold leading-[1.04] text-navy"
            style={{ "--rise-delay": "0.08s" } as React.CSSProperties}
          >
            Predict the flood.
            <br />
            <span className="text-teal-dark">Route around it.</span>
          </h1>

          <p
            className="landing-rise mx-auto mt-6 max-w-[560px] text-[16px] leading-relaxed text-ink-soft"
            style={{ "--rise-delay": "0.16s" } as React.CSSProperties}
          >
            CoastGuard AI runs a real hydrological model over real elevation,
            tide and road data — then solves the routes that are still open.
            One engine drives the operations dashboard and the offline field
            app in every responder&rsquo;s pocket.
          </p>

          <div
            className="landing-rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ "--rise-delay": "0.24s" } as React.CSSProperties}
          >
            <Link href="/overview" className="landing-btn-primary group">
              <span>Open the dashboard</span>
              <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/map" className="landing-btn-secondary">
              Explore the forecast map
            </Link>
          </div>

          <p
            className="landing-rise mt-5 text-[12px] font-medium text-ink-soft/80"
            style={{ "--rise-delay": "0.3s" } as React.CSSProperties}
          >
            No sign-up. No backend. Works with the network down.
          </p>
        </div>

        {/* The product frame. A real WebGL terrain-and-flood scene inside app
            chrome, so the first thing you see is the thing itself. */}
        <div
          className="landing-rise landing-frame relative mt-14 overflow-hidden rounded-[26px] bg-navy-deep"
          style={{ "--rise-delay": "0.36s" } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="block h-2.5 w-2.5 rounded-full bg-white/20" />
              <i className="block h-2.5 w-2.5 rounded-full bg-white/20" />
              <i className="block h-2.5 w-2.5 rounded-full bg-white/20" />
            </span>
            <span className="mx-auto hidden rounded-chip bg-white/[0.07] px-3 py-1 text-[10.5px] font-semibold text-white/55 sm:block">
              coastguard.ai/map · Miami-Dade coastal grid
            </span>
            <span className="hidden text-[10.5px] font-semibold text-teal sm:block">
              ● Simulating
            </span>
          </div>

          {/* The sky is CSS, painted behind a canvas that clears to
              transparent — the terrain shader fogs into the same colour at the
              horizon, so the two meet without a seam. */}
          <div
            className="relative aspect-[16/10] sm:aspect-[16/8]"
            style={{
              background:
                "radial-gradient(ellipse 55% 42% at 34% 30%, rgba(31,138,112,0.28), transparent 68%)," +
                "linear-gradient(to bottom, #071a21 0%, #0a2530 46%, #0f373f 72%, #0f3741 100%)",
            }}
          >
            <LandingScene />

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

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/80 via-transparent to-navy-deep/30"
              aria-hidden="true"
            />

            {/* Overlaid panels, in the field app's own glass language. */}
            <div className="pointer-events-none absolute inset-0 p-3 sm:p-5">
              <div className="flex flex-wrap gap-2">
                <GlassStat label="Water" value="2.41 m" tone="coral" />
                <GlassStat label="Roads cut" value="612 / 4,659" tone="amber" />
                <GlassStat label="Cut off" value="2 sites" tone="coral" />
                <GlassStat label="Showing" value="Forecast +12 h" tone="teal" />
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2 sm:bottom-5 sm:left-5 sm:right-5">
                <div className="landing-glass max-w-[300px] rounded-[16px] p-3.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.11em] text-white/45">
                    Safest route found
                  </div>
                  <div className="mt-1 font-serif text-[15px] font-semibold text-white">
                    Jackson Memorial Hospital
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <GlassChip>3.4 km by road</GlassChip>
                    <GlassChip>11 min</GlassChip>
                    <GlassChip tone="amber">1 road flagged</GlassChip>
                  </div>
                </div>

                <div className="landing-glass hidden rounded-[16px] p-3.5 md:block">
                  <div className="text-[9px] font-bold uppercase tracking-[0.11em] text-white/45">
                    Legend
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    <LegendRow color="var(--map-flood)" label="Flooded" />
                    <LegendRow color="var(--map-road-blocked)" label="Road impassable" />
                    <LegendRow color="var(--map-route)" label="Chosen route" />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-scroll-hint mt-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
          Scroll to see how it works
        </div>
      </div>
    </section>
  );
}

function GlassStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "coral" | "amber" | "teal";
}) {
  const dot =
    tone === "coral"
      ? "var(--color-coral)"
      : tone === "amber"
        ? "var(--color-amber)"
        : "var(--color-teal)";
  return (
    <div className="landing-glass rounded-[13px] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.11em] text-white/45">
        <i
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: dot }}
          aria-hidden="true"
        />
        {label}
      </div>
      <div className="mt-0.5 font-serif text-[14px] font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function GlassChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "amber";
}) {
  return (
    <span
      className="rounded-chip px-2 py-1 text-[9.5px] font-bold"
      style={{
        background:
          tone === "amber" ? "rgba(227,160,8,0.2)" : "rgba(255,255,255,0.1)",
        color: tone === "amber" ? "#f7d38a" : "rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </span>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[10.5px] font-semibold text-white/70">
      <i
        className="block h-2 w-5 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </li>
  );
}

/* ========================================================================== */
/* Data provenance rail                                                       */
/* ========================================================================== */

const SOURCES = [
  "USGS 3DEP 1 m Bare Earth DEM",
  "NOAA CO-OPS · Virginia Key 8723214",
  "OpenStreetMap via Overpass",
  "NAVD88 vertical datum",
  "FDEM operational landmarks",
  "Miami-Dade County road classes",
];

function DataRail() {
  return (
    <section className="border-y border-sand-dim bg-card/60 py-7">
      <p className="mb-4 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-soft">
        Built on measured data, not synthetic terrain
      </p>
      <div className="landing-marquee-mask overflow-hidden">
        <div className="landing-marquee flex w-max gap-10 pr-10">
          {[...SOURCES, ...SOURCES].map((s, i) => (
            <span
              key={i}
              className="flex flex-shrink-0 items-center gap-2 text-[13px] font-semibold text-navy/55"
            >
              <i
                className="block h-1.5 w-1.5 rounded-full bg-teal"
                aria-hidden="true"
              />
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Features                                                                   */
/* ========================================================================== */

const FEATURES = [
  {
    icon: "🌊",
    tone: "blue" as const,
    title: "Physical flood model",
    body: "A connectivity-filled water surface over a 300 × 300 elevation grid at 40 m cells. Water reaches a cell only if it can actually get there from the sea, so an inland hollow below sea level stays dry until something connects it.",
  },
  {
    icon: "🧭",
    tone: "teal" as const,
    title: "Routing that respects the water",
    body: "A* over 4,659 real OSM road segments, re-weighted at every timestep. A shelter 300 m away across a flooded causeway is correctly reported as no distance at all.",
  },
  {
    icon: "⏱️",
    tone: "amber" as const,
    title: "Forecast you can scrub",
    body: "193 timesteps at 15-minute resolution across a full 48 hours. Drag the timeline and the flood, the closures, the routes and every panel move with it — including the answers the assistant gives.",
  },
  {
    icon: "✨",
    tone: "coral" as const,
    title: "An assistant that cannot bluff",
    body: "Questions are answered by the model and the router first; the language model only rephrases. Every reply names the source it came from, and none of them can invent a road that does not exist.",
  },
  {
    icon: "📶",
    tone: "teal" as const,
    title: "Offline by design",
    body: "The engine is compiled to a single JavaScript bundle that runs entirely in the browser. No backend, no round trip, no degradation on the day the towers go down.",
  },
  {
    icon: "🤝",
    tone: "blue" as const,
    title: "Community layer",
    body: "Shelters with live capacity, shared resources, hazard reports and volunteer jobs — each pinned to a real road node with its elevation read from the DEM, so both surfaces agree on where it is.",
  },
];

const TONE_TILE: Record<string, string> = {
  blue: "bg-blue-tint",
  teal: "bg-teal-tint",
  amber: "bg-amber-tint",
  coral: "bg-coral-tint",
};

function Features() {
  return (
    <Section id="platform" eyebrow="The platform" title="Six things it does that a flood map does not">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="landing-card rounded-[20px] border border-sand-dim bg-card p-5 shadow-card"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-[13px] text-[19px] ${TONE_TILE[f.tone]}`}
              aria-hidden="true"
            >
              {f.icon}
            </span>
            <h3 className="mt-4 font-serif text-[17px] font-semibold text-navy">
              {f.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {f.body}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* ========================================================================== */
/* How it works                                                               */
/* ========================================================================== */

const STEPS = [
  {
    n: "01",
    title: "Read the ground",
    body: "USGS 3DEP bare-earth elevations are sampled onto the operations grid in NAVD88, the same datum NOAA publishes tides against — so a water level and a ground height are directly comparable numbers.",
    detail: "300 × 300 cells · 40 m · −7.9 m to 16.3 m",
  },
  {
    n: "02",
    title: "Force the water",
    body: "Measured NOAA astronomical tide at Virginia Key, plus a Category 2 design-storm surge, rainfall and wind. The tide alone does not flood Miami-Dade; a design storm is how coastal risk is actually planned against.",
    detail: "2.2 m surge peak · 48 mm/h rain · 165 km/h wind",
  },
  {
    n: "03",
    title: "Solve what is left",
    body: "Every road segment is tested against the water surface at that instant, the impassable ones are cut, and A* re-solves over what remains. That is what the map, the shelter recommendation and the assistant all read from.",
    detail: "4,659 segments re-weighted per timestep",
  },
];

function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title="Three steps, run 193 times"
      lead="Nothing is precomputed into a picture. The whole chain re-runs for every position on the timeline, in your browser."
      tinted
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className="relative rounded-[20px] border border-sand-dim bg-card p-6 shadow-card"
          >
            <span className="font-serif text-[30px] font-semibold leading-none text-teal/35">
              {s.n}
            </span>
            <h3 className="mt-3 font-serif text-[18px] font-semibold text-navy">
              {s.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {s.body}
            </p>
            <p className="mt-4 border-t border-sand-dim pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-teal-dark">
              {s.detail}
            </p>
            {i < STEPS.length - 1 && (
              <span
                className="absolute right-[-14px] top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-sand-dim bg-card text-ink-soft md:flex"
                aria-hidden="true"
              >
                <ArrowIcon />
              </span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ========================================================================== */
/* Assistant                                                                  */
/* ========================================================================== */

function Assistant() {
  return (
    <Section
      id="assistant"
      eyebrow="Grounded assistant"
      title="Ask it anything about this town, at this hour"
    >
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Most disaster chatbots answer with general safety advice, because
            general safety advice is all a language model has. This one reads
            the question, works out what is being asked, and answers from the
            flood model and the router — the actual distance, the actual depth,
            the actual shelter with capacity left.
          </p>
          <ul className="mt-6 space-y-3">
            <Bullet>
              <strong className="text-navy">Facts before phrasing.</strong> The
              engine produces the answer; the language model is only allowed to
              say it more naturally.
            </Bullet>
            <Bullet>
              <strong className="text-navy">Provenance on every reply.</strong>{" "}
              &ldquo;A* router, forecast +12 h, cautious mode&rdquo; sits under
              the answer, so nobody mistakes it for an opinion.
            </Bullet>
            <Bullet>
              <strong className="text-navy">Degrades, never breaks.</strong> Pull
              the key, pull the network — you get the engine&rsquo;s own
              wording, with the same numbers in it.
            </Bullet>
          </ul>
          <Link
            href="/assistant"
            className="landing-btn-secondary mt-7 group"
          >
            Try the assistant
            <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="rounded-[22px] border border-sand-dim bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-[15px] font-semibold text-navy">
              Disaster assistant
            </h3>
            <span className="rounded-chip bg-blue-tint px-2.5 py-1 text-[10.5px] font-bold text-blue-dark">
              Model connected
            </span>
          </div>

          <div className="space-y-3">
            <div className="ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[4px] bg-navy px-3.5 py-2.5 text-[13px] font-medium text-white">
              Can I still reach the hospital?
            </div>
            <div className="max-w-[92%] rounded-[16px] rounded-bl-[4px] bg-sand px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-ink">
                Yes — Jackson Memorial Hospital is 3.4 km away, about 11 minutes
                by road in cautious mode. Watch out: NW 12th Ave is flagged by
                the forecast.
              </p>
              <p className="mt-1.5 border-t border-sand-dim pt-1.5 text-[10.5px] font-semibold text-ink-soft">
                Source: A* router, forecast +12 h, cautious mode
              </p>
            </div>

            <div className="ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[4px] bg-navy px-3.5 py-2.5 text-[13px] font-medium text-white">
              When does it peak?
            </div>
            <div className="max-w-[92%] rounded-[16px] rounded-bl-[4px] bg-sand px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-ink">
                The surge peaks at hour 26 of the window. At the peak the model
                closes the largest share of the road network and cuts off two
                key locations entirely.
              </p>
              <p className="mt-1.5 border-t border-sand-dim pt-1.5 text-[10.5px] font-semibold text-ink-soft">
                Source: Flood model, full 48 h window
              </p>
            </div>
          </div>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {["Where should we evacuate to?", "Which roads are closed?"].map(
              (s) => (
                <span
                  key={s}
                  className="flex-shrink-0 rounded-chip border border-sand-dim px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft"
                >
                  {s}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[13.5px] leading-relaxed text-ink-soft">
      <span
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-tint text-[11px] font-bold text-teal-dark"
        aria-hidden="true"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ========================================================================== */
/* Two surfaces                                                               */
/* ========================================================================== */

function TwoSurfaces() {
  return (
    <Section
      eyebrow="One engine, two surfaces"
      title="The coordination room and the flooded street"
      lead="The dashboard answers “what is happening to the county”. The field app answers “what do I do now”. They compile from the same model, so they never disagree."
      tinted
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-[22px] border border-sand-dim bg-card p-6 shadow-card">
          <span className="w-fit rounded-chip bg-navy px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white">
            Operations dashboard
          </span>
          <h3 className="mt-4 font-serif text-[21px] font-semibold text-navy">
            For whoever is deciding
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            A town safety score derived from the model rather than invented,
            a four-horizon flood outlook, active incidents ranked by road
            distance, and the shelter the router — not straight-line distance —
            says to send people to.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-2">
            {["Overview", "Forecast map", "Resources", "Volunteer dispatch"].map(
              (t) => (
                <li
                  key={t}
                  className="rounded-[12px] bg-sand px-3 py-2 text-[12px] font-semibold text-navy"
                >
                  {t}
                </li>
              ),
            )}
          </ul>
          <Link href="/overview" className="landing-btn-primary group mt-6 w-fit">
            Open the dashboard
            <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </article>

        <article className="flex flex-col rounded-[22px] border border-sand-dim bg-card p-6 shadow-card">
          <span className="w-fit rounded-chip bg-teal-tint px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-teal-dark">
            Field app
          </span>
          <h3 className="mt-4 font-serif text-[21px] font-semibold text-navy">
            For whoever is standing in it
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            A single HTML file, sized for a phone. Photograph a flooded street
            and it estimates depth and hazards; claim a neighbour&rsquo;s
            generator; join a debris-clearing job; flag that you need
            evacuation assistance. It opens straight off disk.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-2">
            {["Photo hazard reports", "Shared resources", "Volunteer jobs", "Priority assistance"].map(
              (t) => (
                <li
                  key={t}
                  className="rounded-[12px] bg-sand px-3 py-2 text-[12px] font-semibold text-navy"
                >
                  {t}
                </li>
              ),
            )}
          </ul>
          <a
            href="/mobile.html"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-btn-secondary mt-6 w-fit"
          >
            Open the field app ↗
          </a>
        </article>
      </div>
    </Section>
  );
}

/* ========================================================================== */
/* FAQ                                                                        */
/* ========================================================================== */

const FAQS = [
  {
    q: "Is the flood data real?",
    a: "The elevation and the road network are. Elevations come from the USGS 3DEP 1 m bare-earth DEM via The National Map, referenced to NAVD88; the roads are OpenStreetMap geometry pulled through Overpass. The tide curve is NOAA CO-OPS astronomical prediction for Virginia Key. The surge, rainfall and wind are a stated Category 2 design storm rather than a live forecast — because the astronomical tide alone does not flood Miami-Dade, and a design storm is how coastal flood risk is actually planned against.",
  },
  {
    q: "Does it need a server?",
    a: "No. The model, the router and the whole 48-hour simulation are compiled into a JavaScript bundle that runs in the browser. There is no database and no API call in the critical path, which is deliberate: the moment a tool like this matters is the moment the network is least likely to be there.",
  },
  {
    q: "What does the AI actually do?",
    a: "It phrases. Questions are matched to what the engine can answer — a route, a water depth, a shelter recommendation — and the numbers in every reply come from that computation. When an API key is configured the language model rewrites that grounded answer into plainer prose. It is never asked for a fact, so it has nothing to hallucinate about.",
  },
  {
    q: "Can I point it at a different county?",
    a: "Yes. The data layer is five JSON files — elevation grid, forcing curve, road graph, landmarks, community fixtures — regenerated by the scripts in the repo. Swap the bounding box, re-run the generators, and the engine, the dashboard and the field app all follow.",
  },
  {
    q: "Is the community data live?",
    a: "No, and it says so. Shelters, incidents, resources and volunteer jobs are operational fixtures for exercise use, not a live feed. Their placement is real — every one sits on an actual road-network node with its elevation read from the DEM — so the router paths to them correctly.",
  },
];

function Faq() {
  return (
    <Section id="faq" eyebrow="Questions" title="The things people ask first">
      <div className="landing-faq mx-auto max-w-[820px] space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-[18px] border border-sand-dim bg-card px-5 shadow-card"
          >
            <summary className="flex items-center gap-4 py-4 font-serif text-[16px] font-semibold text-navy">
              <span className="flex-1">{f.q}</span>
              <span
                className="landing-faq-sign flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sand text-[15px] font-normal text-ink-soft"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="border-t border-sand-dim pb-5 pt-4 text-[13.5px] leading-relaxed text-ink-soft">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ========================================================================== */
/* Final CTA                                                                  */
/* ========================================================================== */

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-20 pt-4 sm:pb-28">
      <div
        className="relative overflow-hidden rounded-[26px] px-6 py-14 text-center sm:px-14"
        style={{
          background:
            "linear-gradient(140deg, var(--color-navy) 0%, var(--color-navy-deep) 58%, #0d3a3a 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 82% 8%, rgba(31,138,112,0.35), transparent 68%), radial-gradient(ellipse 45% 60% at 12% 92%, rgba(46,111,149,0.3), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <h2 className="mx-auto max-w-[16ch] font-serif text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-[1.1] text-white">
            The water is already modelled. Go and look.
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-white/65">
            Forty-eight hours of Miami-Dade, at fifteen-minute resolution,
            running in your browser right now. Scrub to the peak and see what
            is still open.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/overview"
              className="group inline-flex items-center gap-2 rounded-[14px] bg-white px-6 py-3.5 text-[14px] font-bold text-navy shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5"
            >
              Open the dashboard
              <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="/mobile.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[14px] border border-white/20 bg-white/[0.07] px-6 py-3.5 text-[14px] font-bold text-white backdrop-blur transition-colors hover:bg-white/15"
            >
              Field app ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Footer                                                                     */
/* ========================================================================== */

function Footer() {
  return (
    <footer className="border-t border-sand-dim bg-card/60">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <Wordmark />
            <span className="font-serif text-[18px] font-semibold text-navy">
              CoastGuard AI
            </span>
          </div>
          <p className="mt-3 max-w-[260px] text-[12.5px] leading-relaxed text-ink-soft">
            Predictive flood modelling and dynamic safe-route pathfinding for
            Miami-Dade County, Florida.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: "/overview", label: "Overview" },
            { href: "/map", label: "Forecast map" },
            { href: "/assistant", label: "Assistant" },
            { href: "/resources", label: "Resources" },
          ]}
        />
        <FooterCol
          title="Respond"
          links={[
            { href: "/report", label: "Report a hazard" },
            { href: "/volunteer", label: "Volunteer" },
            { href: "/mobile.html", label: "Field app ↗", external: true },
          ]}
        />

        <div>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-soft">
            Data sources
          </h3>
          <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
            <li>USGS 3DEP · The National Map</li>
            <li>NOAA CO-OPS · Virginia Key</li>
            <li>OpenStreetMap contributors</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-sand-dim">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[11.5px] text-ink-soft">
          <span>
            Simulation for planning and exercise use. Not an official warning
            product — follow Miami-Dade Emergency Management for live orders.
          </span>
          <span>© {new Date().getFullYear()} CoastGuard AI</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-soft">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-navy/75 hover:text-navy"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-[12.5px] font-semibold text-navy/75 hover:text-navy"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================================================================== */
/* Shared bits                                                                */
/* ========================================================================== */

function Section({
  id,
  eyebrow,
  title,
  lead,
  tinted,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 py-20 sm:py-24 ${tinted ? "border-y border-sand-dim bg-card/50" : ""}`}
    >
      <div className="mx-auto max-w-[1180px] px-5">
        <div className="mb-10 max-w-[640px]">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-teal-dark">
            {eyebrow}
          </div>
          <h2 className="mt-3 font-serif text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-[1.14] tracking-tight text-navy">
            {title}
          </h2>
          {lead && (
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              {lead}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
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
