"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InfoTip, Pct, ScoreBar, Segmented, Sparkline } from "@/components/ui";
import { aed, areaTitle, cn, compactNumber, num, pct } from "@/lib/format";
import { METRIC } from "@/lib/metrics";
import type { Area } from "@/lib/types";

type SortKey = "score" | "ppsf" | "growth1y" | "growth3y" | "yield" | "deals12m" | "price" | "offplanShare" | "pipelineUnits";

const COLUMNS: { key: SortKey; label: string; hint?: string; className?: string }[] = [
  { key: "ppsf", label: "AED/sqft" },
  { key: "price", label: "Median price", className: "hidden md:table-cell" },
  { key: "growth1y", label: "1Y", hint: METRIC.growth1y.description },
  { key: "growth3y", label: "3Y", hint: METRIC.growth3y.description, className: "hidden sm:table-cell" },
  { key: "yield", label: "Yield", hint: METRIC.yield.description },
  { key: "deals12m", label: "Deals 12m", className: "hidden lg:table-cell" },
  { key: "offplanShare", label: "Off-plan", className: "hidden xl:table-cell" },
  { key: "pipelineUnits", label: "Pipeline", hint: METRIC.pipelineUnits.description, className: "hidden xl:table-cell" },
  { key: "score", label: "Score", hint: METRIC.score.description },
];

type Segment = "all" | "apartments" | "villas";

export function Screener({ areas }: { areas: Area[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });
  const [segment, setSegment] = useState<Segment>("all");
  const [liquidOnly, setLiquidOnly] = useState(true);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return areas
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.knownAs ?? "").toLowerCase().includes(q))
      .filter((a) => !liquidOnly || a.deals12m >= 100)
      .filter((a) =>
        segment === "all" ? true : segment === "villas" ? (a.villaShare ?? 0) >= 0.5 : (a.villaShare ?? 0) < 0.5,
      )
      .sort((a, b) => {
        const av = a[sort.key] as number | null;
        const bv = b[sort.key] as number | null;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sort.desc ? bv - av : av - bv;
      });
  }, [areas, query, sort, segment, liquidOnly]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="glass flex min-w-64 flex-1 items-center gap-2 rounded-full px-4 py-2.5 sm:max-w-sm">
          <Search className="size-4 text-faint" aria-hidden />
          <span className="sr-only">Filter areas</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        <Segmented
          label="Segment"
          size="sm"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "all", label: "All" },
            { value: "apartments", label: "Mostly apartments" },
            { value: "villas", label: "Mostly villas" },
          ]}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={liquidOnly}
            onChange={(e) => setLiquidOnly(e.target.checked)}
            className="size-4 accent-[var(--gold)]"
          />
          100+ sales a year
        </label>
        <div className="ml-auto text-xs text-faint">{rows.length} areas</div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-elevated/90 backdrop-blur">
            <tr className="border-b border-line text-left text-xs text-faint">
              <th className="px-5 py-3 font-normal">Area</th>
              <th className="hidden px-3 py-3 font-normal sm:table-cell">36-month trend</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-3 py-3 text-right font-normal", c.className)} aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                  <span className="inline-flex items-center justify-end gap-1">
                    <button onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 hover:text-ink", sort.key === c.key && "text-gold")}>
                      {c.label}
                      {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                    </button>
                    {c.hint && <InfoTip text={c.hint} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.slug} className="group border-b border-line/50 transition last:border-0 hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <Link href={`/areas/${a.slug}/`} className="block">
                    <span className="block font-medium text-ink group-hover:text-gold">{areaTitle(a)}</span>
                    {a.knownAs && <span className="block text-[11px] text-faint">{a.name}</span>}
                  </Link>
                </td>
                <td className="hidden px-3 py-3 sm:table-cell">
                  <Sparkline values={a.spark} width={100} height={28} />
                </td>
                <td className="px-3 py-3 text-right tabular text-ink">{num(a.ppsf)}</td>
                <td className="hidden px-3 py-3 text-right tabular text-muted md:table-cell">{aed(a.price)}</td>
                <td className="px-3 py-3 text-right"><Pct value={a.growth1y} /></td>
                <td className="hidden px-3 py-3 text-right sm:table-cell"><Pct value={a.growth3y} /></td>
                <td className="px-3 py-3 text-right tabular text-ink">{pct(a.yield, { sign: false })}</td>
                <td className="hidden px-3 py-3 text-right tabular text-muted lg:table-cell">{compactNumber(a.deals12m)}</td>
                <td className="hidden px-3 py-3 text-right tabular text-muted xl:table-cell">{pct(a.offplanShare, { sign: false, digits: 0 })}</td>
                <td className="hidden px-3 py-3 text-right tabular text-muted xl:table-cell">{a.pipelineUnits ? compactNumber(a.pipelineUnits) : "—"}</td>
                <td className="px-3 py-3"><div className="flex justify-end"><ScoreBar score={a.score} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
