"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chart, COLORS, baseOption } from "@/components/chart";
import { Card, FadeIn, InfoTip, Segmented, Stat } from "@/components/ui";
import { compactNumber, monthLabel, num } from "@/lib/format";
import type { Pipeline } from "@/lib/types";

export function PipelineView({ pipeline }: { pipeline: Pipeline }) {
  const [devSort, setDevSort] = useState<"total" | "pipeline" | "delivered">("total");
  const [query, setQuery] = useState("");
  const thisYear = Number(pipeline.asOf.slice(0, 4));

  const yearOption = useMemo(
    () => ({
      ...baseOption(),
      legend: { show: false },
      xAxis: {
        type: "category",
        data: pipeline.byYear.map((y) => (y.year === thisYear ? `${y.year}*` : String(y.year))),
        axisLabel: { color: COLORS.faint },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.grid } },
      },
      yAxis: { type: "value", axisLabel: { color: COLORS.faint, formatter: (v: number) => compactNumber(v) }, splitLine: { lineStyle: { color: COLORS.grid } } },
      tooltip: { ...baseOption().tooltip, valueFormatter: (v: unknown) => (typeof v === "number" ? `${num(v)} units` : "—") },
      series: [
        {
          name: "Units due",
          type: "bar",
          barWidth: "55%",
          data: pipeline.byYear.map((y) => y.units),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: COLORS.violet },
                { offset: 1, color: "rgba(139,123,255,0.15)" },
              ],
            },
          },
          label: { show: true, position: "top", color: COLORS.muted, formatter: (p: { value: number }) => compactNumber(p.value) },
        },
      ],
    }),
    [pipeline.byYear, thisYear],
  );

  const developers = useMemo(() => {
    const key = {
      total: (d: Pipeline["developers"][number]) => d.unitsDelivered + d.unitsPipeline,
      pipeline: (d: Pipeline["developers"][number]) => d.unitsPipeline,
      delivered: (d: Pipeline["developers"][number]) => d.unitsDelivered,
    }[devSort];
    return [...pipeline.developers].sort((a, b) => key(b) - key(a)).slice(0, 40);
  }, [pipeline.developers, devSort]);

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pipeline.projects
      .filter((p) => !q || [p.name, p.developer, p.area].some((s) => s?.toLowerCase().includes(q)))
      .slice(0, 80);
  }, [pipeline.projects, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <FadeIn>
        <Card className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Units in the pipeline" value={pipeline.totals.units} format={(n) => num(n)} />
          <Stat label="Registered projects" value={pipeline.totals.projects} format={(n) => num(n)} />
          <Stat label="Developers building" value={pipeline.totals.developers} format={(n) => num(n)} />
        </Card>
      </FadeIn>

      <FadeIn>
        <Card glow="violet">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-lg font-medium text-ink">Units due by year</div>
            <InfoTip text="Units and villas in active, pending and not-started projects, by planned completion. *Projects already past their planned date are counted in the current year." />
          </div>
          <Chart option={yearOption as never} height={320} />
        </Card>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <FadeIn className="min-w-0">
          <Card className="h-full p-0 sm:p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <div className="text-lg font-medium text-ink">Biggest projects underway</div>
                <div className="text-xs text-faint">By units · DLD projects register</div>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5">
                <Search className="size-3.5 text-faint" aria-hidden />
                <span className="sr-only">Filter projects</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Project, developer, area" className="w-44 bg-transparent text-xs text-ink outline-none placeholder:text-faint" />
              </label>
            </div>
            <div className="max-h-[560px] overflow-auto">
              {projects.map((p) => (
                <div key={p.number} className="flex items-center gap-4 border-b border-line/50 px-6 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{p.name ?? `Project ${p.number}`}</div>
                    <div className="truncate text-[11px] text-faint">
                      {p.developer ?? "—"} ·{" "}
                      {p.slug ? (
                        <Link href={`/areas/${p.slug}/`} className="hover:text-gold">{p.area}</Link>
                      ) : (
                        p.area
                      )}{" "}
                      · due {p.expected ? monthLabel(p.expected) : "n/a"}
                    </div>
                  </div>
                  <div className="hidden w-28 sm:block">
                    <div className="mb-1 text-[11px] text-faint">{num(p.progress)}% built</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet to-teal" style={{ width: `${p.progress ?? 0}%` }} />
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm tabular text-ink">{num(p.units)}</div>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.08} className="min-w-0">
          <Card className="h-full p-0 sm:p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-medium text-ink">
                  Developer track record
                  <InfoTip text="From DLD's projects register. Build time = median months from start to completion of finished projects. Progress = average % complete of active projects." />
                </div>
                <div className="text-xs text-faint">Units delivered vs in the pipeline</div>
              </div>
              <Segmented label="Sort developers" size="sm" value={devSort} onChange={setDevSort} options={[{ value: "total", label: "Total" }, { value: "pipeline", label: "Pipeline" }, { value: "delivered", label: "Delivered" }]} />
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-elevated/95 backdrop-blur">
                  <tr className="text-left text-xs text-faint">
                    <th className="px-6 py-2 font-normal">Developer</th>
                    <th className="px-3 py-2 text-right font-normal">Delivered</th>
                    <th className="px-3 py-2 text-right font-normal">Pipeline</th>
                    <th className="whitespace-nowrap px-6 py-2 text-right font-normal">Build time</th>
                  </tr>
                </thead>
                <tbody>
                  {developers.map((d) => {
                    const total = d.unitsDelivered + d.unitsPipeline || 1;
                    return (
                      <tr key={d.name} className="border-t border-line/50">
                        <td className="px-6 py-2.5">
                          <div className="max-w-44 truncate text-ink sm:max-w-56">{d.name}</div>
                          <div className="mt-1 flex h-1 w-40 overflow-hidden rounded-full bg-white/8">
                            <div className="bg-teal" style={{ width: `${(d.unitsDelivered / total) * 100}%` }} />
                            <div className="bg-violet" style={{ width: `${(d.unitsPipeline / total) * 100}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-teal">{compactNumber(d.unitsDelivered)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-violet">{compactNumber(d.unitsPipeline)}</td>
                        <td className="whitespace-nowrap px-6 py-2.5 text-right tabular text-muted">{d.buildMonths ? `${d.buildMonths} mo` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
