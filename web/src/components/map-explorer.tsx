"use client";

import { ArrowUpRight, Box, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { HoverInfo } from "@/components/area-map";
import { Legend, MapTooltip } from "@/components/area-map";
import { Delta, Pct, Sparkline } from "@/components/ui";
import { aed, areaTitle, cn, compactNumber, num, pct } from "@/lib/format";
import { METRIC, METRICS, makeScale, type MetricKey } from "@/lib/metrics";
import type { Area } from "@/lib/types";

const AreaMap = dynamic(() => import("@/components/area-map").then((m) => m.AreaMap), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0 rounded-none" />,
});

export function MapExplorer({ areas }: { areas: Area[] }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("ppsf");
  const [extruded, setExtruded] = useState(true);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [selected, setSelected] = useState<Area | null>(null);
  const metric = METRIC[metricKey];
  const scale = useMemo(() => makeScale(metric, areas), [metric, areas]);

  const ranked = useMemo(
    () =>
      [...areas]
        .filter((a) => metric.get(a) != null && a.deals12m >= 100)
        .sort((a, b) => (metric.get(b) ?? 0) - (metric.get(a) ?? 0)),
    [areas, metric],
  );

  return (
    <div className="relative h-[100svh] w-full overflow-hidden pt-16">
      <div className="absolute inset-0 top-16">
        <AreaMap
          areas={areas}
          metric={metric}
          extruded={extruded}
          selected={selected?.slug}
          onSelect={setSelected}
          onHover={setHover}
          initialView={{ zoom: 10.6, pitch: extruded ? 50 : 0 }}
          className="h-full w-full"
        />
        <MapTooltip hover={hover} metric={metric} />
      </div>

      {/* Controls */}
      <div className="pointer-events-none absolute left-4 top-20 z-10 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-3 sm:left-6">
        <div className="glass-strong pointer-events-auto rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-faint">Colour by</div>
            <div className="flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="Map style">
              {[
                { v: true, icon: Box, label: "3D" },
                { v: false, icon: Square, label: "2D" },
              ].map(({ v, icon: Icon, label }) => (
                <button
                  key={label}
                  role="radio"
                  aria-checked={extruded === v}
                  onClick={() => setExtruded(v)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition",
                    extruded === v ? "bg-gold text-bg" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Metric">
            {METRICS.map((m) => (
              <button
                key={m.key}
                role="radio"
                aria-checked={m.key === metricKey}
                onClick={() => setMetricKey(m.key)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-left text-xs transition",
                  m.key === metricKey
                    ? "border-gold/60 bg-gold-soft text-ink"
                    : "border-line text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-faint">{metric.description}</p>
          <div className="mt-3">
            <Legend metric={metric} areas={areas} />
          </div>
        </div>

        <div className="glass-strong pointer-events-auto hidden max-h-[38vh] overflow-y-auto rounded-2xl p-2 md:block">
          <div className="px-2 pb-1 pt-1 text-xs uppercase tracking-[0.18em] text-faint">Top by {metric.short}</div>
          {ranked.slice(0, 12).map((a, i) => (
            <button
              key={a.slug}
              onClick={() => setSelected(a)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5"
            >
              <span className="w-4 text-xs text-faint tabular">{i + 1}</span>
              <span className="size-2.5 rounded-sm" style={{ background: `rgb(${scale.color(metric.get(a)).slice(0, 3).join(",")})` }} />
              <span className="min-w-0 flex-1 truncate text-ink">{areaTitle(a)}</span>
              <span className="tabular text-xs text-muted">{metric.format(metric.get(a))}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Area panel */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected.slug}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="glass-strong absolute bottom-4 right-4 z-20 w-[min(380px,calc(100vw-2rem))] rounded-2xl p-5 sm:bottom-auto sm:top-20"
            aria-label={`${areaTitle(selected)} summary`}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-faint hover:bg-white/5 hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div className="pr-8">
              <div className="font-display text-3xl leading-tight text-ink">{areaTitle(selected)}</div>
              {selected.knownAs && <div className="text-xs text-faint">DLD area: {selected.name}</div>}
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs text-muted">Median AED / sq ft</div>
                <div className="text-3xl font-semibold tabular text-ink">{num(selected.ppsf)}</div>
              </div>
              <Sparkline values={selected.spark} width={130} height={44} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-[11px] text-faint">1Y growth</dt>
                <dd><Pct value={selected.growth1y} className="font-medium" /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">3Y growth</dt>
                <dd><Pct value={selected.growth3y} className="font-medium" /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Gross yield</dt>
                <dd className="font-medium tabular text-ink">{pct(selected.yield, { sign: false })}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Deals, 12m</dt>
                <dd className="font-medium tabular text-ink">{compactNumber(selected.deals12m)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Median price</dt>
                <dd className="font-medium tabular text-ink">{aed(selected.price)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Off-plan</dt>
                <dd className="font-medium tabular text-ink">{pct(selected.offplanShare, { sign: false, digits: 0 })}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
              <span className="text-muted">Investor score</span>
              <span className="font-semibold text-gold">{selected.score}/100</span>
              <Delta value={selected.growth6m} suffix=" 6m" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/areas/${selected.slug}/`}
                className="flex items-center justify-center gap-1 rounded-full bg-gold px-4 py-2 text-sm font-medium text-bg transition hover:brightness-110"
              >
                Full profile <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href={`/valuation/?area=${selected.slug}`}
                className="flex items-center justify-center rounded-full px-4 py-2 text-sm text-ink ring-1 ring-line-strong transition hover:bg-white/5"
              >
                Value a unit
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
