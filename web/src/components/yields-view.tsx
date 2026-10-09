"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Chart, COLORS, baseOption } from "@/components/chart";
import { Card, FadeIn, Pct, Segmented, Sparkline } from "@/components/ui";
import { aed, areaTitle, num, pct } from "@/lib/format";
import type { Area } from "@/lib/types";

export function YieldsView({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const [horizon, setHorizon] = useState<"growth1y" | "growth3y">("growth1y");
  const points = useMemo(
    () => areas.filter((a) => a.yield != null && a[horizon] != null && a.deals12m >= 100),
    [areas, horizon],
  );
  const medianYield = useMemo(() => {
    const ys = points.map((a) => a.yield as number).sort((a, b) => a - b);
    return ys[Math.floor(ys.length / 2)] ?? 0.06;
  }, [points]);
  const medianGrowth = useMemo(() => {
    const gs = points.map((a) => a[horizon] as number).sort((a, b) => a - b);
    return gs[Math.floor(gs.length / 2)] ?? 0;
  }, [points, horizon]);

  const option = useMemo(() => {
    const maxDeals = Math.max(...points.map((a) => a.deals12m));
    const xs = points.map((a) => a[horizon] as number).sort((a, b) => a - b);
    const q = (p: number) => xs[Math.round(p * (xs.length - 1))] ?? 0;
    const xMin = Math.floor((q(0.03) - 0.02) * 20) / 20;
    const xMax = Math.ceil((q(0.97) + 0.02) * 20) / 20;
    return {
      ...baseOption(),
      grid: { left: 12, right: 24, top: 30, bottom: 30, containLabel: true },
      legend: { show: false },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(10,14,23,0.92)",
        borderColor: "rgba(255,255,255,0.12)",
        textStyle: { color: "#eef0f6", fontSize: 12 },
        formatter: (p: { data: { name: string; value: number[] } }) =>
          `<b>${p.data.name}</b><br/>Yield ${pct(p.data.value[5], { sign: false })} · Growth ${pct(p.data.value[4])}<br/>AED ${num(p.data.value[3])}/sqft · ${num(p.data.value[2])} deals`,
      },
      xAxis: {
        type: "value",
        name: horizon === "growth1y" ? "1-year growth →" : "3-year growth →",
        nameLocation: "end",
        nameTextStyle: { color: COLORS.faint, fontSize: 11 },
        axisLabel: { color: COLORS.faint, formatter: (v: number) => `${Math.round(v * 100)}%` },
        splitLine: { lineStyle: { color: COLORS.grid } },
        min: xMin,
        max: xMax,
      },
      yAxis: {
        type: "value",
        name: "Gross yield ↑",
        nameTextStyle: { color: COLORS.faint, fontSize: 11 },
        axisLabel: { color: COLORS.faint, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
        splitLine: { lineStyle: { color: COLORS.grid } },
        min: 0.02,
        max: 0.1,
      },
      visualMap: {
        show: false,
        dimension: 3,
        min: Math.min(...points.map((a) => a.ppsf ?? 0)),
        max: Math.max(...points.map((a) => a.ppsf ?? 0)),
        inRange: { color: ["#4a5ad0", "#3fbed2", "#78e1aa", "#e7c85f", "#f58c4b", "#fa556e"] },
      },
      series: [
        {
          type: "scatter",
          // Outliers sit on the chart edge rather than stretching the axes; the tooltip keeps the true value.
          data: points.map((a) => ({
            name: areaTitle(a),
            slug: a.slug,
            value: [
              Math.min(xMax, Math.max(xMin, a[horizon] as number)),
              Math.min(0.1, Math.max(0.02, a.yield as number)),
              a.deals12m,
              a.ppsf,
              a[horizon],
              a.yield,
            ],
          })),
          symbolSize: (v: number[]) => 8 + Math.sqrt(v[2] / maxDeals) * 38,
          itemStyle: { opacity: 0.85, borderColor: "rgba(255,255,255,0.35)", borderWidth: 1, shadowBlur: 20, shadowColor: "rgba(0,0,0,0.5)" },
          emphasis: { scale: 1.15, label: { show: true } },
          labelLayout: { hideOverlap: true },
          label: {
            show: true,
            formatter: (p: { data: { name: string; value: number[] } }) => (p.data.value[2] > maxDeals * 0.25 ? p.data.name : ""),
            position: "top",
            color: "#cfd4e0",
            fontSize: 11,
          },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: "rgba(255,255,255,0.18)", type: "dashed" },
            label: { show: false },
            data: [{ xAxis: medianGrowth }, { yAxis: medianYield }],
          },
        },
      ],
    };
  }, [points, horizon, medianGrowth, medianYield]);

  const quadrants = useMemo(() => {
    const q = (fy: (a: Area) => boolean, fg: (a: Area) => boolean) =>
      points.filter((a) => fy(a) && fg(a)).sort((a, b) => b.score - a.score).slice(0, 5);
    const hiY = (a: Area) => (a.yield ?? 0) >= medianYield;
    const hiG = (a: Area) => (a[horizon] ?? 0) >= medianGrowth;
    return [
      { title: "Income and upside", body: "Above-median yield and growth", tone: "text-up", items: q(hiY, hiG) },
      { title: "Income plays", body: "High yield, slower growth", tone: "text-teal", items: q(hiY, (a) => !hiG(a)) },
      { title: "Growth plays", body: "Rising fast, thinner yield", tone: "text-gold", items: q((a) => !hiY(a), hiG) },
      { title: "Priced for perfection", body: "Lower yield and growth", tone: "text-down", items: q((a) => !hiY(a), (a) => !hiG(a)) },
    ];
  }, [points, horizon, medianGrowth, medianYield]);

  const byYield = useMemo(() => [...points].sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0)), [points]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <FadeIn>
        <Card glow="teal">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-medium text-ink">The investor quadrant</div>
              <div className="text-xs text-faint">
                Bubble size: sales volume · colour: AED/sqft · dashed lines: Dubai medians · click a bubble to open the area
              </div>
            </div>
            <Segmented label="Growth horizon" size="sm" value={horizon} onChange={setHorizon} options={[{ value: "growth1y", label: "1Y growth" }, { value: "growth3y", label: "3Y growth" }]} />
          </div>
          <Chart
            option={option as never}
            height={520}
            onEvents={{ click: (p) => router.push(`/areas/${(p as { data: { slug: string } }).data.slug}/`) }}
          />
        </Card>
      </FadeIn>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quadrants.map((q, i) => (
          <FadeIn key={q.title} delay={i * 0.05}>
            <Card className="h-full">
              <div className={`text-sm font-medium ${q.tone}`}>{q.title}</div>
              <div className="mb-3 text-xs text-faint">{q.body}</div>
              <ul className="space-y-2">
                {q.items.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/areas/${a.slug}/`} className="flex items-center justify-between gap-2 text-sm hover:text-gold">
                      <span className="truncate text-ink">{areaTitle(a)}</span>
                      <span className="shrink-0 text-xs tabular text-muted">
                        {pct(a.yield, { sign: false })} · <Pct value={a[horizon]} />
                      </span>
                    </Link>
                  </li>
                ))}
                {!q.items.length && <li className="text-xs text-faint">None right now</li>}
              </ul>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn>
        <Card className="p-0 sm:p-0">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-medium text-ink">Yield league table</div>
            <div className="text-xs text-faint">Areas with 100+ sales a year · gross yield from new leases vs sale prices, matched by bedrooms</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-6 py-2 font-normal">#</th>
                  <th className="px-3 py-2 font-normal">Area</th>
                  <th className="px-3 py-2 text-right font-normal">Gross yield</th>
                  <th className="px-3 py-2 text-right font-normal">Median rent</th>
                  <th className="px-3 py-2 text-right font-normal">Median price</th>
                  <th className="px-3 py-2 text-right font-normal">1Y</th>
                  <th className="px-6 py-2 font-normal">Trend</th>
                </tr>
              </thead>
              <tbody>
                {byYield.map((a, i) => (
                  <tr key={a.slug} className="border-t border-line/50 transition hover:bg-white/[0.03]">
                    <td className="px-6 py-2.5 text-xs text-faint tabular">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/areas/${a.slug}/`} className="text-ink hover:text-gold">{areaTitle(a)}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="ml-auto flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-gradient-to-r from-teal/50 to-teal" style={{ width: `${Math.min(100, ((a.yield ?? 0) / 0.1) * 100)}%` }} />
                        </div>
                        <span className="w-12 tabular font-medium text-teal">{pct(a.yield, { sign: false })}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">{aed(a.rent)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">{aed(a.price)}</td>
                    <td className="px-3 py-2.5 text-right"><Pct value={a.growth1y} /></td>
                    <td className="px-6 py-2.5"><Sparkline values={a.spark} width={90} height={24} /></td>
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
