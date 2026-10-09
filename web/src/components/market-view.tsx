"use client";

import { useMemo, useState } from "react";

import { Chart, COLORS, baseOption, timeAxis, valueAxis } from "@/components/chart";
import { Card, FadeIn, InfoTip, Segmented, Stat } from "@/components/ui";
import { aed, change, compactNumber, monthLabel, num } from "@/lib/format";
import type { Market, Num } from "@/lib/types";

type Range = "5y" | "10y" | "all";
const RANGE_START: Record<Range, string> = { "5y": "", "10y": "", all: "2010-01" };

function sliceFrom<T>(months: string[], arrays: T[][], from: string) {
  const i = Math.max(0, months.findIndex((m) => m >= from));
  return { months: months.slice(i), arrays: arrays.map((a) => a.slice(i)) };
}

const gradient = (color: string, top = 0.35) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: color.replace("rgb", "rgba").replace(")", `,${top})`) },
    { offset: 1, color: color.replace("rgb", "rgba").replace(")", ",0)") },
  ],
});

export function MarketView({ market }: { market: Market }) {
  const m = market.monthly;
  const [range, setRange] = useState<Range>("10y");
  const [priceView, setPriceView] = useState<"index" | "ppsf">("index");
  const lastMonth = m.month.at(-1) ?? "2026-01";
  const from = useMemo(() => {
    if (range === "all") return RANGE_START.all;
    const years = range === "5y" ? 5 : 10;
    const [y, mo] = lastMonth.split("-").map(Number);
    return `${y - years}-${String(mo).padStart(2, "0")}`;
  }, [range, lastMonth]);

  const { now, prev, lastYear } = market.pulse;
  // Drop the unfinished current month from flow charts so the last bar isn't misleading.
  const complete = m.partialLast ? m.month.length - 1 : m.month.length;
  const cut = <T,>(a: T[]) => a.slice(0, complete);

  const priceOption = useMemo(() => {
    const { months, arrays } = sliceFrom(m.month, [m.index, m.ppsfApartment, m.ppsfVilla], from);
    const [index, apt, villa] = arrays as Num[][];
    const isIndex = priceView === "index";
    return {
      ...baseOption(),
      xAxis: timeAxis(months.map(monthLabel)),
      yAxis: valueAxis((v) => (isIndex ? `${v}` : num(v))),
      dataZoom: [{ type: "inside", throttle: 30 }],
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) =>
          typeof v === "number" ? (isIndex ? v.toFixed(1) : `AED ${num(v)}/sqft`) : "—",
      },
      series: isIndex
        ? [
            {
              name: `Price index (${market.monthly.month.includes("2020-01") ? "Jan 2020 = 100" : ""})`,
              type: "line",
              data: index,
              color: COLORS.gold,
              showSymbol: false,
              smooth: 0.3,
              lineStyle: { width: 2.5, shadowBlur: 16, shadowColor: "rgba(231,183,95,.5)" },
              areaStyle: { color: gradient("rgb(231,183,95)") },
            },
          ]
        : [
            {
              name: "Apartments",
              type: "line",
              data: apt,
              color: COLORS.teal,
              showSymbol: false,
              smooth: 0.3,
              lineStyle: { width: 2 },
            },
            {
              name: "Villas",
              type: "line",
              data: villa,
              color: COLORS.violet,
              showSymbol: false,
              smooth: 0.3,
              lineStyle: { width: 2 },
            },
          ],
    };
  }, [m, from, priceView, market.monthly.month]);

  const volumeOption = useMemo(() => {
    const ready = m.value.map((v, i) => (v == null ? null : v - (m.offplanValue[i] ?? 0)));
    const { months, arrays } = sliceFrom(cut(m.month), [cut(m.offplanValue), cut(ready), cut(m.deals)], from);
    const [offplan, readyV, deals] = arrays as Num[][];
    return {
      ...baseOption(),
      xAxis: { ...(timeAxis(months.map(monthLabel)) as object), boundaryGap: true },
      yAxis: [
        valueAxis((v) => compactNumber(v), { scale: false }),
        valueAxis((v) => compactNumber(v), { scale: false, splitLine: { show: false } }),
      ],
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? compactNumber(v) : "—"),
      },
      series: [
        { name: "Off-plan value (AED)", type: "bar", stack: "v", data: offplan, color: COLORS.gold, barCategoryGap: "20%" },
        {
          name: "Ready value (AED)",
          type: "bar",
          stack: "v",
          data: readyV,
          color: "rgba(63,224,197,0.75)",
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
        {
          name: "Deals",
          type: "line",
          yAxisIndex: 1,
          data: deals,
          color: "#ffffff",
          showSymbol: false,
          smooth: 0.3,
          lineStyle: { width: 1.5, opacity: 0.7 },
        },
      ],
    };
  }, [m, from]); // eslint-disable-line react-hooks/exhaustive-deps

  const rentOption = useMemo(() => {
    const rentStart = m.rentApartment.findIndex((v) => v != null);
    if (rentStart < 0) return null;
    const months = cut(m.month).slice(rentStart);
    const rent = cut(m.rentApartment).slice(rentStart);
    const idx = cut(m.index).slice(rentStart);
    const base = (arr: Num[]) => {
      const first = arr.find((v) => v != null) ?? 1;
      return arr.map((v) => (v == null ? null : Math.round((v / first) * 1000) / 10));
    };
    const rentSmooth = rent.map((_, i) => {
      const window = rent.slice(Math.max(0, i - 2), i + 1).filter((v): v is number => v != null);
      return window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
    });
    return {
      ...baseOption(),
      xAxis: timeAxis(months.map(monthLabel)),
      yAxis: valueAxis((v) => `${v}`),
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? v.toFixed(1) : "—"),
      },
      series: [
        { name: "Sale prices", type: "line", data: base(idx), color: COLORS.gold, showSymbol: false, smooth: 0.3, lineStyle: { width: 2 } },
        { name: "New-lease rents", type: "line", data: base(rentSmooth), color: COLORS.teal, showSymbol: false, smooth: 0.3, lineStyle: { width: 2 } },
      ],
    };
  }, [m]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearlyOption = useMemo(() => {
    const y = market.yearly;
    const start = y.year.findIndex((v) => v >= 2010);
    return {
      ...baseOption(),
      legend: { show: false },
      xAxis: { type: "category", data: y.year.slice(start), axisLabel: { color: COLORS.faint }, axisTick: { show: false }, axisLine: { lineStyle: { color: COLORS.grid } } },
      yAxis: valueAxis((v) => compactNumber(v), { scale: false }),
      tooltip: { ...baseOption().tooltip, trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? aed(v) : "—") },
      series: [
        {
          name: "Sales value",
          type: "bar",
          data: y.value.slice(start).map((v, i, arr) => ({
            value: v,
            itemStyle: {
              color: i === arr.length - 1 ? "rgba(231,183,95,0.45)" : COLORS.gold,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barCategoryGap: "30%",
        },
      ],
    };
  }, [market.yearly]);

  const segments = ["Apartment", "Villa"];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <FadeIn>
        <Card className="grid grid-cols-2 gap-6 lg:grid-cols-5">
          <Stat label="Sales, last 30 days" value={now.deals} format={(n) => num(n)} delta={change(now.deals, prev.deals)} deltaLabel="vs prior 30d" />
          <Stat label="Sales value" value={now.value} format={(n) => aed(n)} delta={change(now.value, lastYear.value)} deltaLabel="vs last year" />
          <Stat label="Median price" value={now.price} format={(n) => aed(n)} delta={change(now.price, lastYear.price)} deltaLabel="vs last year" />
          <Stat label="Median AED / sq ft" value={now.ppsf} format={(n) => num(n)} delta={change(now.ppsf, lastYear.ppsf)} deltaLabel="vs last year" hint="Raw median of single-unit residential sales. It shifts with the mix of what sells; the index below doesn't." />
          <Stat label="Off-plan share" value={now.offplan != null ? now.offplan * 100 : null} format={(n) => `${n.toFixed(0)}%`} delta={now.offplan != null && lastYear.offplan != null ? now.offplan - lastYear.offplan : null} deltaLabel="pts vs last year" />
        </Card>
      </FadeIn>

      <FadeIn>
        <Card glow="gold">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-medium text-ink">
                Prices
                <InfoTip text="Index: log price per sq ft explained by area × type × bedrooms plus a month effect; the month effects are the index (Jan 2020 = 100). AED/sqft: raw medians by segment." />
              </div>
              <div className="text-xs text-faint">Drag or scroll on the chart to zoom</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Segmented label="Price measure" size="sm" value={priceView} onChange={setPriceView} options={[{ value: "index", label: "Mix-adjusted index" }, { value: "ppsf", label: "AED / sq ft" }]} />
              <Segmented label="Time range" size="sm" value={range} onChange={setRange} options={[{ value: "5y", label: "5Y" }, { value: "10y", label: "10Y" }, { value: "all", label: "All" }]} />
            </div>
          </div>
          <Chart option={priceOption as never} height={380} />
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <div className="mb-4">
            <div className="text-lg font-medium text-ink">Sales volume</div>
            <div className="text-xs text-faint">Monthly value, split off-plan vs ready, with deal count. Complete months only.</div>
          </div>
          <Chart option={volumeOption as never} height={340} />
        </Card>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn>
          <Card className="h-full">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-lg font-medium text-ink">
                Rents vs prices
                <InfoTip text="Both rebased to 100 at the start. Rents: median new-lease apartment rent across area × bedroom cells (Ejari), 3-month average. When prices outrun rents, yields compress." />
              </div>
              <div className="text-xs text-faint">Rebased to 100</div>
            </div>
            {rentOption ? <Chart option={rentOption as never} height={300} /> : <p className="text-sm text-muted">No rent data loaded.</p>}
          </Card>
        </FadeIn>
        <FadeIn delay={0.08}>
          <Card className="h-full">
            <div className="mb-4">
              <div className="text-lg font-medium text-ink">Value by year</div>
              <div className="text-xs text-faint">All sales, AED. The current year is to date.</div>
            </div>
            <Chart option={yearlyOption as never} height={300} />
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="p-0 sm:p-0">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-medium text-ink">By unit type, last 12 months</div>
            <div className="text-xs text-faint">Single-unit residential sales</div>
          </div>
          <div className="grid divide-line md:grid-cols-2 md:divide-x">
            {segments.map((seg) => (
              <div key={seg} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="px-6 pt-4 text-left text-xs uppercase tracking-[0.18em] text-faint">{seg}s</caption>
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th className="px-6 py-2 font-normal">Type</th>
                      <th className="px-3 py-2 text-right font-normal">Deals</th>
                      <th className="px-3 py-2 text-right font-normal">Median price</th>
                      <th className="px-6 py-2 text-right font-normal">AED/sqft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {market.rooms
                      .filter((r) => r.segment === seg)
                      .map((r) => (
                        <tr key={r.rooms} className="border-t border-line/60">
                          <td className="px-6 py-2.5 text-ink">{r.rooms}</td>
                          <td className="px-3 py-2.5 text-right tabular text-muted">{num(r.deals)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-ink">{aed(r.price)}</td>
                          <td className="px-6 py-2.5 text-right tabular text-gold">{num(r.ppsf)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
