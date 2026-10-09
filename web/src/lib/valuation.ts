import type { AreaDetail, Comps } from "./types";

export const ROOMS = ["Studio", "1 B/R", "2 B/R", "3 B/R", "4 B/R", "5 B/R", "6 B/R", "7+ B/R", "Penthouse"];
export const ROOM_LABELS = ["Studio", "1 bed", "2 beds", "3 beds", "4 beds", "5 beds", "6 beds", "7+ beds", "Penthouse"];

const EPOCH = Date.UTC(2000, 0, 1);
const DAY = 86_400_000;

export interface Comp {
  date: string;
  days: number;
  project: string | null;
  building: string | null;
  rooms: number;
  segment: 0 | 1;
  size: number;
  price: number;
  ppsf: number;
  adjPpsf: number;
  offplan: boolean;
}

export interface Query {
  project: string | null;
  building: string | null;
  rooms: number;
  segment: 0 | 1;
  size: number | null;
  status: "any" | "ready" | "offplan";
}

export interface Estimate {
  level: "building" | "project" | "area";
  comps: Comp[];
  ppsf: number;
  ppsfLow: number;
  ppsfHigh: number;
  value: number;
  low: number;
  high: number;
  confidence: "High" | "Medium" | "Low";
  spread: number;
  rent: number | null;
  rentSource: string | null;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function unpack(c: Comps): Comp[] {
  const rows: Comp[] = [];
  for (let i = 0; i < c.d.length; i++) {
    const size = c.a[i];
    const price = c.v[i];
    if (!size || !price) continue;
    const date = new Date(EPOCH + c.d[i] * DAY).toISOString().slice(0, 10);
    rows.push({
      date,
      days: c.d[i],
      project: c.p[i] >= 0 ? c.projects[c.p[i]] : null,
      building: c.b[i] >= 0 ? c.buildings[c.b[i]] : null,
      rooms: c.r[i],
      segment: c.s[i] as 0 | 1,
      size,
      price,
      ppsf: price / size,
      adjPpsf: price / size,
      offplan: c.o[i] === 1,
    });
  }
  return rows;
}

/** Brings each comp's price/sqft to today using the area's mix-adjusted index. */
export function timeAdjust(rows: Comp[], area: AreaDetail | null) {
  if (!area) return rows;
  const idx = new Map<string, number>();
  area.series.month.forEach((m, i) => {
    const v = area.series.index[i];
    if (v != null) idx.set(m, v);
  });
  const latest = [...idx.values()].at(-1);
  if (!latest) return rows;
  return rows.map((r) => {
    const at = idx.get(r.date.slice(0, 7));
    const factor = at ? Math.min(1.25, Math.max(0.8, latest / at)) : 1;
    return { ...r, adjPpsf: r.ppsf * factor };
  });
}

export function estimate(rows: Comp[], q: Query, comps: Comps, area: AreaDetail | null): Estimate | null {
  const latestDay = Math.max(...rows.map((r) => r.days));
  const base = rows.filter(
    (r) =>
      r.rooms === q.rooms &&
      r.segment === q.segment &&
      (q.status === "any" || (q.status === "offplan") === r.offplan),
  );
  const sizeOk = (r: Comp) => !q.size || (r.size >= q.size * 0.7 && r.size <= q.size * 1.35);
  const recent = (r: Comp, months: number) => latestDay - r.days <= months * 30.5;

  const tiers: [Estimate["level"], (r: Comp) => boolean][] = [
    ["building", (r) => !!q.building && r.building === q.building],
    ["project", (r) => !!q.project && r.project === q.project],
    ["area", () => true],
  ];
  for (const [level, match] of tiers) {
    for (const months of [12, 24]) {
      let pick = base.filter((r) => match(r) && recent(r, months));
      const sized = pick.filter(sizeOk);
      if (sized.length >= 5) pick = sized;
      if (pick.length < 5) continue;
      pick = pick.sort((a, b) => b.days - a.days).slice(0, 80);
      const ppsfs = pick.map((r) => r.adjPpsf).sort((a, b) => a - b);
      const prices = pick.map((r) => r.price * (r.adjPpsf / r.ppsf)).sort((a, b) => a - b);
      const ppsf = quantile(ppsfs, 0.5);
      const lowP = quantile(ppsfs, 0.25);
      const highP = quantile(ppsfs, 0.75);
      const value = q.size ? ppsf * q.size : quantile(prices, 0.5);
      const low = q.size ? lowP * q.size : quantile(prices, 0.25);
      const high = q.size ? highP * q.size : quantile(prices, 0.75);
      const spread = (highP - lowP) / ppsf;
      const confidence =
        level !== "area" && pick.length >= 10 && spread < 0.2
          ? "High"
          : pick.length >= 8 && spread < 0.35
            ? "Medium"
            : "Low";
      const rent = rentFor(q, comps, area);
      return {
        level,
        comps: pick,
        ppsf,
        ppsfLow: lowP,
        ppsfHigh: highP,
        value,
        low,
        high,
        confidence,
        spread,
        ...rent,
      };
    }
  }
  return null;
}

function rentFor(q: Query, comps: Comps, area: AreaDetail | null) {
  const room = ROOMS[q.rooms];
  const seg = q.segment === 0 ? "Apartment" : "Villa";
  const cells = comps.rents.filter((r) => r[1] === seg && r[2] === room);
  const project = q.project ? cells.find((r) => r[0] === q.project) : undefined;
  if (project) return { rent: project[3], rentSource: `${project[4]} new leases in ${q.project}` };
  if (cells.length) {
    // Area-wide: lease-weighted median across projects in this area.
    const sorted = [...cells].sort((a, b) => a[3] - b[3]);
    const total = sorted.reduce((n, r) => n + r[4], 0);
    let acc = 0;
    for (const r of sorted) {
      acc += r[4];
      if (acc >= total / 2) return { rent: r[3], rentSource: `${total} new leases across the area` };
    }
  }
  const fromTable = area?.rooms.find((r) => r.segment === seg && r.rooms === ROOM_LABELS[q.rooms]);
  if (fromTable?.rent) return { rent: fromTable.rent, rentSource: "Area median for this unit type" };
  return { rent: null, rentSource: null };
}

export interface Returns {
  upfront: number;
  loan: number;
  monthlyPayment: number;
  annualCosts: number;
  netRent: number;
  grossYield: number;
  netYield: number;
  cashFlow: number;
  cashOnCash: number;
}

export function returns(input: {
  price: number;
  rent: number;
  size: number;
  serviceCharge: number;
  ltv: number;
  rate: number;
  years: number;
  vacancy: number;
}): Returns {
  const { price, rent, size, serviceCharge, ltv, rate, years, vacancy } = input;
  const loan = price * ltv;
  // DLD transfer fee 4% + agency 2% + trustee/registration ~AED 4.2k + mortgage registration 0.25%.
  const fees = price * 0.04 + price * 0.02 * 1.05 + 4_200 + loan * 0.0025;
  const upfront = price - loan + fees;
  const r = rate / 12;
  const n = years * 12;
  const monthlyPayment = loan > 0 ? (r > 0 ? (loan * r) / (1 - (1 + r) ** -n) : loan / n) : 0;
  const service = serviceCharge * size;
  const maintenance = price * 0.005;
  const annualCosts = service + maintenance;
  const netRent = rent * (1 - vacancy) - annualCosts;
  const cashFlow = netRent - monthlyPayment * 12;
  return {
    upfront,
    loan,
    monthlyPayment,
    annualCosts,
    netRent,
    grossYield: rent / price,
    netYield: netRent / price,
    cashFlow,
    cashOnCash: cashFlow / upfront,
  };
}
