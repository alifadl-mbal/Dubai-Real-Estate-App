"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, FadeIn, Segmented } from "@/components/ui";
import { aed, cn, dateLabel, num } from "@/lib/format";
import type { Deal } from "@/lib/types";

type Kind = "homes" | "all";

export function DealsView({ top, latest }: { top: Deal[]; latest: Deal[] }) {
  const [list, setList] = useState<"top" | "latest">("top");
  const [kind, setKind] = useState<Kind>("homes");
  const deals = useMemo(
    () =>
      (list === "top" ? top : latest).filter(
        (d) => kind === "all" || (d.units === 1 && (d.type === "Flat" || d.type === "Villa")),
      ),
    [list, kind, top, latest],
  );
  const biggest = deals[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="List" value={list} onChange={setList} options={[{ value: "top", label: "Biggest, 30 days" }, { value: "latest", label: "Latest" }]} />
        <Segmented label="Kind" size="sm" value={kind} onChange={setKind} options={[{ value: "homes", label: "Homes" }, { value: "all", label: "Everything" }]} />
      </div>

      {biggest && list === "top" && (
        <FadeIn>
          <Card glow="gold" className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gold">Deal of the month</div>
              <div className="mt-2 font-display text-6xl text-ink">{aed(biggest.value)}</div>
              <div className="mt-2 text-sm text-muted">
                {biggest.rooms ? `${biggest.rooms} ${biggest.type === "Villa" ? "villa" : "apartment"}` : biggest.type} in{" "}
                <span className="text-ink">{biggest.project ?? biggest.building ?? biggest.area}</span>,{" "}
                <Link href={`/areas/${biggest.slug}/`} className="text-gold hover:underline">{biggest.area}</Link> ·{" "}
                {dateLabel(biggest.date)}
              </div>
            </div>
            {biggest.ppsf && (
              <div className="text-right">
                <div className="text-xs text-faint">Price per sq ft</div>
                <div className="text-3xl font-semibold tabular text-gradient-gold">AED {num(biggest.ppsf)}</div>
                <div className="text-xs text-faint">{num(biggest.size)} sq ft</div>
              </div>
            )}
          </Card>
        </FadeIn>
      )}

      <FadeIn>
        <Card className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th className="px-6 py-3 font-normal">Date</th>
                  <th className="px-3 py-3 font-normal">Property</th>
                  <th className="px-3 py-3 font-normal">Area</th>
                  <th className="px-3 py-3 text-right font-normal">Size</th>
                  <th className="px-3 py-3 text-right font-normal">AED/sqft</th>
                  <th className="px-6 py-3 text-right font-normal">Price</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d, i) => (
                  <tr key={i} className="border-b border-line/50 transition last:border-0 hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-6 py-3 text-muted">{dateLabel(d.date)}</td>
                    <td className="px-3 py-3">
                      <div className="text-ink">{d.project ?? d.building ?? "—"}</div>
                      <div className="text-[11px] text-faint">
                        {[d.rooms, d.type, d.units && d.units > 1 ? `${d.units} units` : null].filter(Boolean).join(" · ")}
                        {d.offplan && <span className="ml-2 rounded-full bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet">off-plan</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/areas/${d.slug}/`} className="text-muted hover:text-gold">{d.area}</Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-muted">{d.size ? num(d.size) : "—"}</td>
                    <td className="px-3 py-3 text-right tabular text-muted">{d.ppsf ? num(d.ppsf) : "—"}</td>
                    <td className={cn("px-6 py-3 text-right font-medium tabular", (d.value ?? 0) >= 1e7 ? "text-gold" : "text-ink")}>{aed(d.value)}</td>
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
