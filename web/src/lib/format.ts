import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Num } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DASH = "—";

/** AED 1.25M, AED 30.3B, AED 845K. */
export function aed(value: Num | undefined, opts: { compact?: boolean; prefix?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) return DASH;
  const { compact = true, prefix = true } = opts;
  const body = compact ? compactNumber(value) : Math.round(value).toLocaleString("en-US");
  return prefix ? `AED ${body}` : body;
}

export function compactNumber(value: number, digits?: number) {
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const scaled = value / size;
      const d = digits ?? (Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2);
      return `${scaled.toFixed(d)}${suffix}`;
    }
  }
  return Math.round(value).toLocaleString("en-US");
}

export function num(value: Num | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return DASH;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 0.0431 -> "+4.3%". */
export function pct(value: Num | undefined, opts: { sign?: boolean; digits?: number } = {}) {
  if (value == null || !Number.isFinite(value)) return DASH;
  const { sign = true, digits = 1 } = opts;
  const text = `${(value * 100).toFixed(digits)}%`;
  return sign && value > 0 ? `+${text}` : text;
}

export function change(now: Num | undefined, then: Num | undefined): Num {
  if (now == null || then == null || !then) return null;
  return now / then - 1;
}

export function tone(value: Num | undefined) {
  if (value == null || Math.abs(value) < 0.0005) return "text-muted";
  return value > 0 ? "text-up" : "text-down";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function areaTitle(area: { name: string; knownAs?: string | null }) {
  return area.knownAs ?? area.name;
}

export function areaSubtitle(area: { name: string; knownAs?: string | null }) {
  return area.knownAs ? area.name : null;
}
