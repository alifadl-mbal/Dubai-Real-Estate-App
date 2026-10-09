"use client";

import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chart, COLORS, baseOption, timeAxis, valueAxis } from "@/components/chart";
import { Card, Delta, Eyebrow, FadeIn, SectionHeading, Sparkline, Stat } from "@/components/ui";
import { aed, areaTitle, change, compactNumber, dateLabel, monthLabel, num, pct } from "@/lib/format";
import { METRIC } from "@/lib/metrics";
import type { Area, Deal, Market, Meta } from "@/lib/types";

const AreaMap = dynamic(() => import("@/components/area-map").then((m) => m.AreaMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

export function Hero({ market, areas, meta }: { market: Market; areas: Area[]; meta: Meta }) {
  const { now, lastYear } = market.pulse;
  return (
    <section className="relative isolate h-[100svh] min-h-[680px] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <AreaMap
          areas={areas}
          metric={METRIC.ppsf}
          labels={false}
          autoRotate
          interactive={false}
          initialView={{ zoom: 10.25, pitch: 52, latitude: 25.13, longitude: 55.24 }}
          focusRight
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,transparent_0%,rgba(5,7,12,0.55)_55%,rgba(5,7,12,0.95)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg/80 to-transparent" />
      </div>

      <div className="mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-10 sm:px-6 sm:pb-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg/50 px-3 py-1 text-xs text-muted backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-up" />
            </span>
            Dubai Land Department data to {dateLabel(meta.asOf)}
          </div>
          <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] tracking-tight text-ink">
            Dubai property,
            <br />
            <span className="text-gradient-gold italic">decoded.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {compactNumber(meta.transactions)} registered deals and {compactNumber(meta.leases)} leases turned into
            fair prices, rental yields, supply risk and the signals that move them.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new Event("open-search"))}
              className="group flex w-full max-w-md items-center gap-3 rounded-full border border-line-strong bg-bg/60 py-3 pl-5 pr-3 text-left text-muted backdrop-blur-xl transition hover:border-gold/50 sm:w-auto sm:min-w-96"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1">Search JVC, Dubai Marina, a project…</span>
              <span className="grid size-8 place-items-center rounded-full bg-gold text-bg transition group-hover:scale-105">
                <ArrowRight className="size-4" />
              </span>
            </button>
            <Link
              href="/valuation/"
              className="rounded-full px-5 py-3 text-sm font-medium text-ink ring-1 ring-line-strong transition hover:bg-white/5"
            >
              Value a property
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass mt-10 grid grid-cols-2 gap-6 rounded-2xl p-5 sm:p-6 lg:grid-cols-4"
        >
          <Stat
            label="Sales, last 30 days"
            value={now.deals}
            format={(n) => num(n)}
            delta={change(now.deals, lastYear.deals)}
            deltaLabel="vs last year"
          />
          <Stat
            label="Value transacted"
            value={now.value}
            format={(n) => aed(n)}
            delta={change(now.value, lastYear.value)}
            deltaLabel="vs last year"
          />
          <Stat
            label="Median price / sq ft"
            value={now.ppsf}
            format={(n) => `AED ${num(n)}`}
            delta={change(now.ppsf, lastYear.ppsf)}
            deltaLabel="vs last year"
          />
          <Stat
            label="Off-plan share"
            value={now.offplan != null ? now.offplan * 100 : null}
            format={(n) => `${n.toFixed(0)}%`}
            hint="Share of sales in the last 30 days that were off-plan (bought from the developer before completion)."
          />
        </motion.div>
      </div>
    </section>
  );
}

export function DealTicker({ deals }: { deals: Deal[] }) {
  // Homes only: land plots and offices make headline numbers but mean little to buyers.
  const items = deals
    .filter((d) => d.units === 1 && (d.type === "Flat" || d.type === "Villa"))
    .slice(0, 30);
  return (
    <div className="relative overflow-hidden border-y border-line bg-white/[0.015] py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap text-sm">
        {[...items, ...items].map((d, i) => (
          <Link
            key={i}
            href={`/areas/${d.slug}/`}
            className="flex items-center gap-2 text-muted transition hover:text-ink"
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
          >
            <span className="text-gold">◆</span>
            <span className="text-ink">{aed(d.value)}</span>
            <span>
              {d.rooms ? `${d.rooms} ${d.type === "Villa" ? "villa" : "apartment"}` : d.type} in{" "}
              {d.project ?? d.building ?? d.area}
            </span>
            <span className="text-faint">{dateLabel(d.date)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const EVENTS: [string, string][] = [
  ["2014-09", "2014 peak"],
  ["2020-05", "COVID low"],
];

export function IndexStory({ market }: { market: Market }) {
  const m = market.monthly;
  // DLD's open records are thin before 2010, so the story starts there.
  const start = m.month.findIndex((x) => x >= "2010-01");
  const months = m.month.slice(start);
  const index = m.index.slice(start);
  const last = index.filter((v) => v != null).at(-1) ?? null;
  const covidLow = Math.min(...(index.slice(months.indexOf("2020-01"), months.indexOf("2021-01")).filter((v) => v != null) as number[]));
  const option = useMemo(
    () => ({
      ...baseOption(),
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      legend: { show: false },
      xAxis: timeAxis(months.map(monthLabel)),
      yAxis: valueAxis((v) => `${v}`),
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? v.toFixed(1) : "—"),
      },
      series: [
        {
          name: "Dubai price index",
          type: "line",
          color: COLORS.gold,
          data: index,
          showSymbol: false,
          smooth: 0.25,
          lineStyle: { width: 2.5, color: COLORS.gold, shadowBlur: 18, shadowColor: "rgba(231,183,95,0.6)" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(231,183,95,0.35)" },
                { offset: 1, color: "rgba(231,183,95,0)" },
              ],
            },
          },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: "rgba(255,255,255,0.15)", type: "dashed" },
            label: { color: COLORS.muted, fontSize: 11, formatter: "{b}", position: "end", rotate: 0 },
            data: EVENTS.filter(([d]) => months.includes(d)).map(([d, name]) => ({ xAxis: monthLabel(d), name })),
          },
        },
      ],
    }),
    [months, index],
  );
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <FadeIn>
        <SectionHeading
          eyebrow="The market in one line"
          title={
            <>
              Prices are up <span className="text-gradient-gold italic">{pct(last != null ? last / 100 - 1 : null, { digits: 0 })}</span>{" "}
              since January 2020.
            </>
          }
          action={
            <Link href="/market/" className="flex items-center gap-1 text-sm text-gold hover:underline">
              Full market analysis <ArrowUpRight className="size-4" />
            </Link>
          }
        >
          A mix-adjusted index of every residential sale since 2010: each month compares like with like (same
          area, type and bedrooms), so it moves with prices, not with what happened to sell. Up{" "}
          {pct(last != null && covidLow ? last / covidLow - 1 : null, { digits: 0 })} from the 2020 low.
        </SectionHeading>
      </FadeIn>
      <FadeIn delay={0.1}>
        <Card className="p-3 sm:p-5" glow="gold">
          <Chart option={option as never} height={380} />
        </Card>
      </FadeIn>
    </section>
  );
}

function RankList({
  title,
  subtitle,
  areas,
  value,
  format,
}: {
  title: string;
  subtitle: string;
  areas: Area[];
  value: (a: Area) => number | null;
  format: (v: number | null) => string;
}) {
  return (
    <Card className="p-0 sm:p-0">
      <div className="border-b border-line px-5 py-4">
        <div className="font-medium text-ink">{title}</div>
        <div className="text-xs text-faint">{subtitle}</div>
      </div>
      <ol>
        {areas.map((a, i) => (
          <li key={a.slug}>
            <Link
              href={`/areas/${a.slug}/`}
              className="flex items-center gap-4 border-b border-line/60 px-5 py-3 transition last:border-0 hover:bg-white/[0.03]"
            >
              <span className="w-4 text-xs text-faint tabular">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{areaTitle(a)}</span>
                <span className="block truncate text-[11px] text-faint">AED {num(a.ppsf)}/sqft</span>
              </span>
              <Sparkline values={a.spark} width={72} height={26} />
              <span className="w-16 text-right text-sm font-medium tabular text-ink">{format(value(a))}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Leaderboards({ areas }: { areas: Area[] }) {
  const liquid = areas.filter((a) => a.deals12m >= 300);
  const top = (key: (a: Area) => number | null, list = liquid) =>
    [...list].filter((a) => key(a) != null).sort((a, b) => (key(b) ?? 0) - (key(a) ?? 0)).slice(0, 6);
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <FadeIn>
        <SectionHeading
          eyebrow="Where the money is moving"
          title="Leaders right now"
          action={
            <Link href="/areas/" className="flex items-center gap-1 text-sm text-gold hover:underline">
              Screen all areas <ArrowUpRight className="size-4" />
            </Link>
          }
        >
          Areas with at least 300 sales in the last year, so a single launch can&apos;t top the table.
        </SectionHeading>
      </FadeIn>
      <div className="grid gap-5 lg:grid-cols-3">
        <FadeIn>
          <RankList
            title="Fastest rising"
            subtitle="Like-for-like price change, 12 months"
            areas={top((a) => a.growth1y)}
            value={(a) => a.growth1y}
            format={(v) => pct(v)}
          />
        </FadeIn>
        <FadeIn delay={0.08}>
          <RankList
            title="Highest yields"
            subtitle="Gross rental yield, new leases"
            areas={top((a) => a.yield)}
            value={(a) => a.yield}
            format={(v) => pct(v, { sign: false })}
          />
        </FadeIn>
        <FadeIn delay={0.16}>
          <RankList
            title="Most traded"
            subtitle="Sales in the last 12 months"
            areas={top((a) => a.deals12m, areas)}
            value={(a) => a.deals12m}
            format={(v) => (v == null ? "—" : compactNumber(v))}
          />
        </FadeIn>
      </div>
    </section>
  );
}

const TOOLS = [
  {
    href: "/valuation/",
    title: "What is it worth?",
    body: "Pick a building and unit type: get a fair-value range from comparable sales, the rent it should fetch and its yield.",
    tag: "Valuation",
  },
  {
    href: "/map/",
    title: "See the whole city",
    body: "Every community in 3D, coloured by price, growth, yield, liquidity or supply. Click to dive in.",
    tag: "Map",
  },
  {
    href: "/yields/",
    title: "Find the yield",
    body: "Growth against yield for every area — the investor quadrant that shows where income and upside meet.",
    tag: "Yields",
  },
  {
    href: "/pipeline/",
    title: "Know what's coming",
    body: "Units due by year and area, and each developer's delivery track record from the DLD register.",
    tag: "Supply",
  },
];

export function Tools() {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <FadeIn>
        <SectionHeading eyebrow="Tools" title="Built for decisions, not decoration" />
      </FadeIn>
      <div className="grid gap-5 md:grid-cols-2">
        {TOOLS.map((t, i) => (
          <FadeIn key={t.href} delay={i * 0.06}>
            <Link
              href={t.href}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="glass group relative block h-full overflow-hidden rounded-2xl p-7 transition hover:border-gold/40"
            >
              <div
                className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold/10 blur-3xl transition-opacity duration-500"
                style={{ opacity: hover === i ? 1 : 0 }}
              />
              <Eyebrow>{t.tag}</Eyebrow>
              <div className="mt-3 flex items-start justify-between gap-6">
                <h3 className="font-display text-3xl text-ink">{t.title}</h3>
                <ArrowUpRight className="size-6 shrink-0 text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{t.body}</p>
            </Link>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

export function PulseStrip({ market }: { market: Market }) {
  const w = market.weekly;
  const option = useMemo(
    () => ({
      ...baseOption(),
      grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: false },
      xAxis: { type: "category", data: w.week, show: false },
      yAxis: { type: "value", show: false },
      tooltip: {
        ...baseOption().tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? aed(v) : "—"),
      },
      series: [
        {
          name: "Weekly sales value",
          type: "bar",
          data: w.value,
          barCategoryGap: "25%",
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: COLORS.teal },
                { offset: 1, color: "rgba(63,224,197,0.15)" },
              ],
            },
          },
        },
      ],
    }),
    [w],
  );
  const lastFull = w.value.at(-2) ?? null;
  return (
    <Card className="mx-auto mt-6 max-w-7xl">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm text-muted">Weekly sales value, last two years</div>
        <div className="text-sm text-ink">
          Last full week <span className="font-semibold">{aed(lastFull)}</span>{" "}
          <Delta value={change(lastFull, w.value.at(-54) ?? null)} suffix=" y/y" />
        </div>
      </div>
      <Chart option={option as never} height={120} />
    </Card>
  );
}
