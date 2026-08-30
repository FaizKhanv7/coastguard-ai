"use client";

/**
 * Shared primitives, lifted straight from coastguard-ai.html so the two
 * surfaces share one visual language: the white card, the tinted pill badge,
 * the sand stat tile and the navy segmented control.
 */

import type { ReactNode } from "react";

export type Tone = "coral" | "teal" | "amber" | "blue" | "neutral";

const TONE_BG: Record<Tone, string> = {
  coral: "bg-coral-tint text-coral-dark",
  teal: "bg-teal-tint text-teal-dark",
  amber: "bg-amber-tint text-amber-dark",
  blue: "bg-blue-tint text-blue-dark",
  neutral: "bg-sand-dim text-ink-soft",
};

/** The mockup's `.card`. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card bg-card p-4 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/** The mockup's `.section-title`. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-serif text-[15px] font-semibold text-navy">
        {children}
      </h3>
      {action}
    </div>
  );
}

/** The mockup's `.pill` / `.sev` badge. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-block rounded-chip px-2.5 py-1 text-[10.5px] font-bold ${TONE_BG[tone]}`}
    >
      {children}
    </span>
  );
}

/** The mockup's `.aistat` tile. */
export function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "danger" | "warn" | "ok";
}) {
  const valueColor =
    tone === "danger"
      ? "text-coral-dark"
      : tone === "warn"
        ? "text-amber-dark"
        : tone === "ok"
          ? "text-teal-dark"
          : "text-navy";
  return (
    <div className="rounded-[14px] bg-sand p-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-soft">
        {label}
      </div>
      <div className={`text-[15px] font-bold ${valueColor}`}>{value}</div>
      {detail && (
        <div className="mt-0.5 text-[11px] text-ink-soft">{detail}</div>
      )}
    </div>
  );
}

/**
 * The mockup's `.maptoggle` segmented control, as a proper radio group so it
 * is reachable and operable from the keyboard with arrow keys.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  // Arrow keys move between options, which is what the radiogroup role
  // promises a screen-reader user. Tab still reaches every button, so the
  // control stays operable either way.
  const step = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    const group = document.querySelector<HTMLElement>(
      `[data-segmented="${name}"]`,
    );
    group?.querySelectorAll("button")[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-segmented={name}
      className="inline-flex rounded-chip bg-sand-dim p-[3px]"
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.hint ? `${opt.label}, ${opt.hint}` : opt.label}
            name={name}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                step(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                step(i, -1);
              }
            }}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-[16px] border-0 px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              selected
                ? "bg-navy text-white"
                : "bg-transparent text-ink-soft hover:text-navy"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** The mockup's `.btn`. */
export function Button({
  children,
  onClick,
  variant = "ghost",
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`cursor-pointer rounded-[14px] border-0 px-4 py-3 text-[13px] font-bold transition-opacity hover:opacity-90 ${
        variant === "primary"
          ? "bg-navy text-white"
          : "bg-sand text-navy"
      } ${className}`}
    >
      {children}
    </button>
  );
}
