import { aed, compactNumber, num, pct } from "./format";
import type { Area, Num } from "./types";

export type MetricKey =
  | "ppsf"
  | "growth1y"
  | "growth3y"
  | "yield"
  | "deals12m"
  | "offplanShare"
  | "pipelineUnits"
  | "score";

export interface Metric {
  key: MetricKey;
  label: string;
  short: string;
  description: string;
  get: (a: Area) => Num;
  format: (v: Num) => string;
  /** sequential: low→high ramp; diverging: centred on zero. */
  scale: "sequential" | "diverging";
}

export const METRICS: Metric[] = [
  {
    key: "ppsf",
    label: "Price per sq ft",
    short: "AED/sqft",
    description: "Median AED per sq ft of single-unit residential sales, last 12 months.",
    get: (a) => a.ppsf,
    format: (v) => (v == null ? "—" : `AED ${num(v)}`),
    scale: "sequential",
  },
  {
    key: "growth1y",
    label: "1-year growth",
    short: "1Y",
    description: "Like-for-like price change: same projects and bedroom types, last 12 months vs the 12 before.",
    get: (a) => a.growth1y,
    format: (v) => pct(v),
    scale: "diverging",
  },
  {
    key: "growth3y",
    label: "3-year growth",
    short: "3Y",
    description: "Like-for-like price change over three years.",
    get: (a) => a.growth3y,
    format: (v) => pct(v),
    scale: "diverging",
  },
  {
    key: "yield",
    label: "Gross rental yield",
    short: "Yield",
    description: "Median new-lease rent ÷ median sale price, matched by bedrooms, last 12 months.",
    get: (a) => a.yield,
    format: (v) => pct(v, { sign: false }),
    scale: "sequential",
  },
  {
    key: "deals12m",
    label: "Sales, last 12 months",
    short: "Deals",
    description: "Registered sales in the last 12 months — a proxy for how easily you can exit.",
    get: (a) => a.deals12m,
    format: (v) => (v == null ? "—" : compactNumber(v)),
    scale: "sequential",
  },
  {
    key: "offplanShare",
    label: "Off-plan share",
    short: "Off-plan",
    description: "Share of the last 12 months' sales that were off-plan.",
    get: (a) => a.offplanShare,
    format: (v) => pct(v, { sign: false, digits: 0 }),
    scale: "sequential",
  },
  {
    key: "pipelineUnits",
    label: "Supply pipeline",
    short: "Pipeline",
    description: "Units in registered projects not yet completed (DLD projects register).",
    get: (a) => a.pipelineUnits,
    format: (v) => (v == null ? "—" : `${compactNumber(v)} units`),
    scale: "sequential",
  },
  {
    key: "score",
    label: "Investor score",
    short: "Score",
    description:
      "0–100 blend of yield (35%), 1-year growth (25%), 3-year growth (15%) and liquidity (25%), ranked across Dubai.",
    get: (a) => a.score,
    format: (v) => (v == null ? "—" : `${v}/100`),
    scale: "sequential",
  },
];

export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, Metric>;

type RGB = [number, number, number];

// Night-friendly ramps that read well over a dark basemap.
const SEQUENTIAL: RGB[] = [
  [45, 55, 120],
  [70, 90, 200],
  [63, 190, 210],
  [120, 225, 170],
  [231, 200, 95],
  [245, 140, 75],
  [250, 85, 110],
];
const DIVERGING: RGB[] = [
  [250, 85, 110],
  [190, 80, 120],
  [80, 85, 110],
  [70, 160, 150],
  [60, 230, 170],
];

function ramp(stops: RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [stops[i], stops[i + 1]];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as RGB;
}

/** Maps a metric value to [0,1] using ranks, so a few extreme areas don't wash out the rest. */
export function makeScale(metric: Metric, areas: Area[]) {
  const values = areas
    .map(metric.get)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const rank = (v: number) => {
    if (!values.length) return 0.5;
    let lo = 0;
    let hi = values.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (values[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo / Math.max(1, values.length - 1);
  };
  const maxAbs = Math.max(0.0001, ...values.map(Math.abs));
  return {
    t(v: Num): number | null {
      if (v == null || !Number.isFinite(v)) return null;
      if (metric.scale === "diverging") {
        // Spread by rank but keep the sign: negatives always read as red.
        const r = rank(v);
        return v < 0 ? Math.min(0.45, r) : Math.max(0.55, r);
      }
      return rank(v);
    },
    color(v: Num, alpha = 255): [number, number, number, number] {
      const t = this.t(v);
      if (t == null) return [60, 66, 84, 90];
      return [...ramp(metric.scale === "diverging" ? DIVERGING : SEQUENTIAL, t), alpha];
    },
    cssColor(t: number) {
      const [r, g, b] = ramp(metric.scale === "diverging" ? DIVERGING : SEQUENTIAL, t);
      return `rgb(${r},${g},${b})`;
    },
    min: values[0],
    max: values[values.length - 1],
    maxAbs,
    quantile(q: number) {
      return values[Math.round(q * (values.length - 1))];
    },
  };
}

export function formatMetricValue(metric: Metric, area: Area) {
  return metric.format(metric.get(area));
}

export { aed };
