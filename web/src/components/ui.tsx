"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Info } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn, pct, tone } from "@/lib/format";
import type { Num } from "@/lib/types";

export function Card({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "gold" | "teal" | "violet";
}) {
  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-5 sm:p-6",
        glow === "gold" && "shadow-[0_0_80px_-30px_rgba(231,183,95,0.45)]",
        glow === "teal" && "shadow-[0_0_80px_-30px_rgba(63,224,197,0.4)]",
        glow === "violet" && "shadow-[0_0_80px_-30px_rgba(139,123,255,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.18em] text-gold/90",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h2>
        {children && <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Delta({ value, suffix, className }: { value: Num; suffix?: string; className?: string }) {
  if (value == null) return <span className={cn("text-xs text-faint", className)}>—</span>;
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular",
        Math.abs(value) < 0.0005
          ? "bg-white/5 text-muted"
          : up
            ? "bg-up/10 text-up"
            : "bg-down/10 text-down",
        className,
      )}
    >
      {Math.abs(value) >= 0.0005 && <span aria-hidden>{up ? "▲" : "▼"}</span>}
      {pct(value, { sign: false })}
      {suffix && <span className="font-normal text-faint">{suffix}</span>}
    </span>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number | null;
  format: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (value == null || !inView) return;
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, inView, mv, reduced]);
  if (value == null) return <span className={className}>—</span>;
  return (
    <motion.span ref={ref} className={cn("tabular", className)}>
      {text}
    </motion.span>
  );
}

export function Stat({
  label,
  value,
  format,
  delta,
  deltaLabel,
  hint,
  className,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  delta?: Num;
  deltaLabel?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {label}
        {hint && <InfoTip text={hint} />}
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
      />
      {delta !== undefined && (
        <div className="flex items-center gap-2">
          <Delta value={delta} />
          {deltaLabel && <span className="text-xs text-faint">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        className="text-faint transition hover:text-muted focus-visible:text-ink focus-visible:outline-none"
      >
        <Info className="size-3.5" aria-hidden />
        <span className="sr-only">More info</span>
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-line-strong bg-elevated/95 p-3 text-xs leading-relaxed text-muted opacity-0 shadow-2xl backdrop-blur transition group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  label: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-line bg-white/[0.03] p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-full font-medium transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active ? "text-bg" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-gold"
                transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  className,
}: {
  values: Num[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] != null);
  const gradient = useId();
  if (points.length < 2) return <div style={{ width, height }} />;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => ((x - x0) / (x1 - x0 || 1)) * (width - 2) + 1;
  const sy = (y: number) => height - 3 - ((y - y0) / (y1 - y0 || 1)) * (height - 6);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");
  const rising = ys[ys.length - 1] >= ys[0];
  const color = rising ? "var(--up)" : "var(--down)";
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${sx(x1)},${height}L${sx(x0)},${height}Z`} fill={`url(#${gradient})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal via-gold to-gold"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted">{score}</span>
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pct({ value, className }: { value: Num; className?: string }) {
  return <span className={cn("tabular", tone(value), className)}>{pct(value)}</span>;
}

export function FadeIn({
  children,
  delay = 0,
  className,
  immediate = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Animate on mount instead of on scroll (for content that appears after a fetch). */
  immediate?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      {...(immediate ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 } })}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
