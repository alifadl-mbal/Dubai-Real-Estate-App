"use client";

import { ArrowUpRight, Calculator } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chart, COLORS, baseOption, timeAxis, valueAxis } from "@/components/chart";
import { Badge, Card, FadeIn, InfoTip, Pct, ScoreBar, Segmented, Stat } from "@/components/ui";
import { aed, areaTitle, compactNumber, dateLabel, monthLabel, num, pct } from "@/lib/format";
import { METRIC } from "@/lib/metrics";
import type { Area, AreaDetail } from "@/lib/types";

const AreaMap = dynamic(() => import("@/components/area-map").then((m) => m.AreaMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

export function AreaProfile({ area, areas }: { area: AreaDetail; areas: Area[] }) {
  const [range, setRange] = useState<"3y" | "10y">("3y");
  const hasIndex = area.series.index.some((v) => v != null);
  const [measure, setMeasure] = useState<"like" | "raw">(hasIndex ? "like" : "raw");
  const s = area.series;

  const priceOption = useMemo(() => {
    const months = s.month;
    const lastYear = Number(months.at(-1)?.slice(0, 4));
    const from = `${lastYear - (range === "3y" ? 3 : 10)}${months.at(-1)?.slice(4)}`;
    const i = Math.max(0, months.findIndex((m) => m >= from));
    const labels = months.slice(i).map(monthLabel);
    const raw = measure === "raw";
    const p25 = raw ? s.p25.slice(i) : [];
    const p75 = raw ? s.p75.slice(i) : [];
    // Like-for-like: the area's mix-adjusted index, scaled so its latest value equals today's
    // median AED/sqft, i.e. "what today's typical unit would have cost then".
    const lastIndex = s.index.filter((v) => v != null).at(-1) ?? null;
    const like = s.index
      .slice(i)
      .map((v) => (v == null || lastIndex == null || area.ppsf == null ? null : Math.round((v / lastIndex) * area.ppsf)));
    return {
      ...baseOption(),
      grid: [
        { left: 8, right: 12, top: 30, height: "62%", containLabel: true },
        { left: 8, right: 12, top: "78%", bottom: 8, containLabel: true },
      ],
      xAxis: [
        { ...(timeAxis(labels) as object), gridIndex: 0, axisLabel: { show: false } },
        { ...(timeAxis(labels) as object), gridIndex: 1, boundaryGap: true },
      ],
      yAxis: [
        { ...(valueAxis((v) => num(v)) as object), gridIndex: 0 },
        { ...(valueAxis((v) => compactNumber(v), { scale: false }) as object), gridIndex: 1, splitNumber: 2 },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      legend: {
        ...(baseOption().legend as object),
        data: [...(measure === "raw" ? ["Middle 50%", "Median AED/sqft"] : ["Like-for-like AED/sqft"]), "Ready deals", "Off-plan deals"],
      },
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? num(v) : "—"),
      },
      series: [
        { name: "p25", type: "line", data: p25, stack: "band", lineStyle: { opacity: 0 }, showSymbol: false, smooth: 0.3, tooltip: { show: false }, xAxisIndex: 0, yAxisIndex: 0 },
        {
          name: "Middle 50%",
          type: "line",
          data: p75.map((v, k) => (v == null || p25[k] == null ? null : v - (p25[k] as number))),
          stack: "band",
          lineStyle: { opacity: 0 },
          showSymbol: false,
          smooth: 0.3,
          areaStyle: { color: "rgba(231,183,95,0.14)" },
          tooltip: { show: false },
          color: "rgba(231,183,95,0.5)",
        },
        {
          name: raw ? "Median AED/sqft" : "Like-for-like AED/sqft",
          type: "line",
          data: raw ? s.median.slice(i) : like,
          color: COLORS.gold,
          showSymbol: false,
          smooth: 0.3,
          lineStyle: { width: 2.5, shadowBlur: 14, shadowColor: "rgba(231,183,95,.5)" },
        },
        {
          name: "Ready deals",
          type: "bar",
          stack: "deals",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: s.deals.slice(i).map((d, k) => (d == null ? null : d - (s.offplanDeals[i + k] ?? 0))),
          color: "rgba(63,224,197,0.7)",
        },
        {
          name: "Off-plan deals",
          type: "bar",
          stack: "deals",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: s.offplanDeals.slice(i),
          color: "rgba(139,123,255,0.8)",
          itemStyle: { borderRadius: [2, 2, 0, 0] },
        },
      ],
    };
  }, [s, range, measure, area.ppsf]);

  const apartments = area.rooms.filter((r) => r.segment === "Apartment");
  const villas = area.rooms.filter((r) => r.segment === "Villa");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      {/* Hero */}
      <div className="grid gap-6 pt-24 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
        <FadeIn className="flex flex-col justify-end">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link href="/areas/" className="text-xs text-faint hover:text-muted">
              Areas
            </Link>
            <span className="text-xs text-faint">/</span>
            {area.knownAs && <Badge>DLD area · {area.name}</Badge>}
            {(area.villaShare ?? 0) >= 0.5 ? <Badge>Villa community</Badge> : <Badge>Apartment market</Badge>}
            {(area.offplanShare ?? 0) >= 0.6 && <Badge className="border-violet/40 text-violet">Off-plan hotspot</Badge>}
          </div>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-ink sm:text-7xl">{areaTitle(area)}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-muted">Median price per sq ft</div>
              <div className="text-4xl font-semibold tabular text-gradient-gold">AED {num(area.ppsf)}</div>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <div className="flex items-center gap-1 text-xs text-muted">
                Investor score <InfoTip text={METRIC.score.description} />
              </div>
              <div className="mt-1"><ScoreBar score={area.score} /></div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/valuation/?area=${area.slug}`}
              className="flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-bg transition hover:brightness-110"
            >
              <Calculator className="size-4" /> Value a unit here
            </Link>
            <Link href="/map/" className="rounded-full px-5 py-2.5 text-sm text-ink ring-1 ring-line-strong transition hover:bg-white/5">
              See on the map
            </Link>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="glass relative h-72 overflow-hidden rounded-2xl sm:h-80">
            {area.lat != null && area.lng != null && (
              <AreaMap
                areas={areas}
                metric={METRIC.ppsf}
                selected={area.slug}
                interactive={false}
                initialView={{ latitude: area.lat, longitude: area.lng, zoom: 11.1, pitch: 50, bearing: -25 }}
                autoRotate
                className="h-full w-full"
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
          </div>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="1-year growth" value={area.growth1y != null ? area.growth1y * 100 : null} format={(n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`} hint={METRIC.growth1y.description} />
          <Stat label="3-year growth" value={area.growth3y != null ? area.growth3y * 100 : null} format={(n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`} hint={METRIC.growth3y.description} />
          <Stat label="Gross yield" value={area.yield != null ? area.yield * 100 : null} format={(n) => `${n.toFixed(1)}%`} hint={METRIC.yield.description} />
          <Stat label="Median price" value={area.price} format={(n) => aed(n)} />
          <Stat label="Sales, 12 months" value={area.deals12m} format={(n) => num(n)} />
          <Stat label="Units in pipeline" value={area.pipelineUnits} format={(n) => num(n)} hint={METRIC.pipelineUnits.description} />
        </Card>
      </FadeIn>

      <FadeIn>
        <Card glow="gold">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-medium text-ink">Price per sq ft and activity</div>
              <div className="flex items-center gap-1.5 text-xs text-faint">
                {measure === "like"
                  ? "Same projects and unit types over time, in today's AED/sqft"
                  : "Median with the middle 50% of deals; shifts with what happened to sell"}
                <InfoTip text="A raw median jumps when a luxury launch or a cheap tower dominates a month's sales. The like-for-like line compares the same projects and bedroom types month to month, so it shows real price movement." />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasIndex && (
                <Segmented label="Measure" size="sm" value={measure} onChange={setMeasure} options={[{ value: "like", label: "Like-for-like" }, { value: "raw", label: "Raw median" }]} />
              )}
              <Segmented label="Range" size="sm" value={range} onChange={setRange} options={[{ value: "3y", label: "3Y" }, { value: "10y", label: "10Y" }]} />
            </div>
          </div>
          <Chart option={priceOption as never} height={420} />
        </Card>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <FadeIn>
          <Card className="h-full p-0 sm:p-0">
            <div className="border-b border-line px-6 py-4">
              <div className="text-lg font-medium text-ink">By unit type</div>
              <div className="text-xs text-faint">Last 12 months · rents from new Ejari leases</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="px-6 py-2 font-normal">Type</th>
                    <th className="px-3 py-2 text-right font-normal">Deals</th>
                    <th className="px-3 py-2 text-right font-normal">Price</th>
                    <th className="px-3 py-2 text-right font-normal">AED/sqft</th>
                    <th className="px-3 py-2 text-right font-normal">Size</th>
                    <th className="px-3 py-2 text-right font-normal">Rent / yr</th>
                    <th className="px-6 py-2 text-right font-normal">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {[...apartments, ...villas].map((r) => (
                    <tr key={r.segment + r.rooms} className="border-t border-line/60">
                      <td className="px-6 py-2.5 text-ink">
                        {r.rooms} <span className="text-faint">{r.segment === "Villa" ? "villa" : "apt"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-muted">{num(r.deals)}</td>
                      <td className="px-3 py-2.5 text-right tabular text-ink">{aed(r.price)}</td>
                      <td className="px-3 py-2.5 text-right tabular text-muted">{num(r.ppsf)}</td>
                      <td className="px-3 py-2.5 text-right tabular text-muted">{r.size ? `${num(r.size)} sqft` : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular text-muted">{aed(r.rent)}</td>
                      <td className="px-6 py-2.5 text-right tabular font-medium text-teal">{pct(r.yield, { sign: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={0.08}>
          <Card className="h-full p-0 sm:p-0">
            <div className="border-b border-line px-6 py-4">
              <div className="text-lg font-medium text-ink">Nearby alternatives</div>
              <div className="text-xs text-faint">Closest profiled areas</div>
            </div>
            <ul>
              {area.neighbours.map((n) => (
                <li key={n.slug}>
                  <Link href={`/areas/${n.slug}/`} className="flex items-center gap-3 border-b border-line/50 px-6 py-3 transition last:border-0 hover:bg-white/[0.03]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{n.knownAs ?? n.name}</span>
                      <span className="text-[11px] text-faint">{n.km < 1 ? "Next door" : `${n.km} km away`}</span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block tabular text-ink">AED {num(n.ppsf)}</span>
                      <span className="block text-faint">
                        <Pct value={n.growth1y} /> · {pct(n.yield, { sign: false })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn>
          <Card className="h-full p-0 sm:p-0">
            <div className="border-b border-line px-6 py-4">
              <div className="text-lg font-medium text-ink">Most traded projects</div>
              <div className="text-xs text-faint">Last 12 months · like-for-like 1Y change</div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {area.projects.map((p) => (
                    <tr key={p.name} className="border-b border-line/50 last:border-0">
                      <td className="px-6 py-2.5">
                        <Link href={`/valuation/?area=${area.slug}&project=${encodeURIComponent(p.name)}`} className="text-ink hover:text-gold">
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-faint">
                          {p.deals} deals · {pct(p.offplanShare, { sign: false, digits: 0 })} off-plan
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular text-muted">{aed(p.price)}</td>
                      <td className="px-3 py-2.5 text-right tabular text-ink">{num(p.ppsf)}</td>
                      <td className="px-6 py-2.5 text-right"><Pct value={p.growth1y} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={0.08}>
          <Card className="h-full p-0 sm:p-0">
            <div className="border-b border-line px-6 py-4">
              <div className="text-lg font-medium text-ink">Coming supply</div>
              <div className="text-xs text-faint">Registered projects not yet completed · DLD projects register</div>
            </div>
            {area.pipeline.length ? (
              <div className="max-h-[420px] overflow-y-auto">
                {area.pipeline.map((p) => (
                  <div key={p.number} className="flex items-center gap-4 border-b border-line/50 px-6 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{p.name ?? `Project ${p.number}`}</div>
                      <div className="truncate text-[11px] text-faint">
                        {p.developer ?? "Developer n/a"} · due {p.expected ? monthLabel(p.expected) : "n/a"}
                      </div>
                    </div>
                    <div className="w-28">
                      <div className="mb-1 flex justify-between text-[11px] text-faint">
                        <span>{num(p.progress)}% built</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet to-teal" style={{ width: `${p.progress ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm tabular text-ink">{num(p.units)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-6 py-8 text-sm text-muted">No registered projects under construction here.</p>
            )}
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <div className="text-lg font-medium text-ink">Latest sales</div>
              <div className="text-xs text-faint">Single-unit residential deals registered with DLD</div>
            </div>
            <Link href={`/valuation/?area=${area.slug}`} className="flex items-center gap-1 text-sm text-gold hover:underline">
              Compare a unit <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-elevated/95 backdrop-blur">
                <tr className="text-left text-xs text-faint">
                  <th className="px-6 py-2 font-normal">Date</th>
                  <th className="px-3 py-2 font-normal">Project / building</th>
                  <th className="px-3 py-2 font-normal">Type</th>
                  <th className="px-3 py-2 text-right font-normal">Size</th>
                  <th className="px-3 py-2 text-right font-normal">Price</th>
                  <th className="px-6 py-2 text-right font-normal">AED/sqft</th>
                </tr>
              </thead>
              <tbody>
                {area.recent.map((d, i) => (
                  <tr key={i} className="border-t border-line/50">
                    <td className="whitespace-nowrap px-6 py-2.5 text-muted">{dateLabel(d.date)}</td>
                    <td className="px-3 py-2.5 text-ink">
                      {d.building ?? d.project ?? "—"}
                      {d.offplan && <span className="ml-2 rounded-full bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet">off-plan</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{d.rooms ?? d.segment}</td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">{num(d.size)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-ink">{aed(d.price)}</td>
                    <td className="px-6 py-2.5 text-right tabular text-gold">{num(d.ppsf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
