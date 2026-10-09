"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Chart, COLORS, baseOption } from "@/components/chart";
import { Card, FadeIn, InfoTip, Segmented } from "@/components/ui";
import { useJson } from "@/lib/client-data";
import { aed, areaTitle, cn, dateLabel, num, pct } from "@/lib/format";
import type { Area, AreaDetail, Comps } from "@/lib/types";
import { ROOM_LABELS, estimate, returns, timeAdjust, unpack, type Query } from "@/lib/valuation";

const field =
  "w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-gold/60 focus:bg-white/[0.05]";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      {children}
    </label>
  );
}

export function ValuationTool({ areas }: { areas: Area[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const sorted = useMemo(() => [...areas].sort((a, b) => areaTitle(a).localeCompare(areaTitle(b))), [areas]);
  const [slug, setSlug] = useState(params.get("area") ?? "al-barsha-south-fourth");
  const [projectChoice, setProject] = useState<string | null>(params.get("project"));
  const [building, setBuilding] = useState<string | null>(null);
  const [segment, setSegment] = useState<0 | 1>(0);
  const [roomsChoice, setRooms] = useState(1);
  const [size, setSize] = useState<string>("");
  const [status, setStatus] = useState<Query["status"]>("any");

  const { data: comps } = useJson<Comps>(slug ? `comps/${slug}.json` : null);
  const { data: detail } = useJson<AreaDetail>(slug ? `areas/${slug}.json` : null);

  const rows = useMemo(() => (comps ? timeAdjust(unpack(comps), detail) : []), [comps, detail]);

  // Options narrow as you choose: projects in the area, then buildings in the project.
  const projects = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => r.project && counts.set(r.project, (counts.get(r.project) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  // A project (e.g. from a link) without recent sales in this area is ignored.
  const project = rows.length && !projects.some(([p]) => p === projectChoice) ? null : projectChoice;

  useEffect(() => {
    const qs = new URLSearchParams({ area: slug });
    if (project) qs.set("project", project);
    router.replace(`/valuation/?${qs.toString()}`, { scroll: false });
  }, [slug, project, router]);
  const buildings = useMemo(() => {
    const counts = new Map<string, number>();
    rows
      .filter((r) => !project || r.project === project)
      .forEach((r) => r.building && counts.set(r.building, (counts.get(r.building) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, project]);
  const roomOptions = useMemo(() => {
    const present = new Set(
      rows.filter((r) => r.segment === segment && (!project || r.project === project)).map((r) => r.rooms),
    );
    return ROOM_LABELS.map((label, i) => ({ label, i })).filter((o) => present.has(o.i));
  }, [rows, segment, project]);

  // Fall back to the first bedroom count this selection actually has.
  const rooms = roomOptions.some((o) => o.i === roomsChoice) ? roomsChoice : (roomOptions[0]?.i ?? roomsChoice);

  const sizeNum = Number(size) > 100 ? Number(size) : null;
  const est = useMemo(
    () =>
      comps && rows.length
        ? estimate(rows, { project, building, rooms, segment, size: sizeNum, status }, comps, detail)
        : null,
    [rows, comps, detail, project, building, rooms, segment, sizeNum, status],
  );

  const unitSize = sizeNum ?? (est ? Math.round(est.comps.reduce((s, c) => s + c.size, 0) / est.comps.length) : 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[360px_1fr]">
      <FadeIn>
        <Card className="space-y-4 lg:sticky lg:top-24">
          <div className="text-lg font-medium text-ink">Your unit</div>
          <Field label="Area">
            <select
              className={field}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setProject(null);
                setBuilding(null);
              }}
            >
              {sorted.map((a) => (
                <option key={a.slug} value={a.slug} className="bg-elevated">
                  {areaTitle(a)}
                  {a.knownAs ? ` (${a.name})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project" hint="Optional. Comparable sales from the same project are weighted first.">
            <select
              className={field}
              value={project ?? ""}
              onChange={(e) => {
                setProject(e.target.value || null);
                setBuilding(null);
              }}
            >
              <option value="" className="bg-elevated">Any project in the area</option>
              {projects.map(([p, n]) => (
                <option key={p} value={p} className="bg-elevated">
                  {p} ({n})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Building" hint="Optional. The tightest comparison: same building, same bedrooms.">
            <select className={field} value={building ?? ""} onChange={(e) => setBuilding(e.target.value || null)}>
              <option value="" className="bg-elevated">Any building</option>
              {buildings.slice(0, 300).map(([b, n]) => (
                <option key={b} value={b} className="bg-elevated">
                  {b} ({n})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Segmented label="Type" size="sm" value={String(segment) as "0" | "1"} onChange={(v) => setSegment(Number(v) as 0 | 1)} options={[{ value: "0", label: "Apartment" }, { value: "1", label: "Villa" }]} />
            </Field>
            <Field label="Bedrooms">
              <select className={field} value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
                {roomOptions.map((o) => (
                  <option key={o.i} value={o.i} className="bg-elevated">
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Size (sq ft)" hint="Optional. With a size we value per sq ft and use similar-sized comps.">
            <input className={field} inputMode="numeric" placeholder="e.g. 780" value={size} onChange={(e) => setSize(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Status">
            <Segmented label="Status" size="sm" value={status} onChange={setStatus} options={[{ value: "any", label: "Any" }, { value: "ready", label: "Ready" }, { value: "offplan", label: "Off-plan" }]} />
          </Field>
        </Card>
      </FadeIn>

      <div className="min-w-0 space-y-6">
        {!comps ? (
          <div className="skeleton h-80" />
        ) : !est ? (
          <Card>
            <div className="text-lg text-ink">Not enough comparable sales</div>
            <p className="mt-2 text-sm text-muted">
              Fewer than five matching sales in the last two years. Try another bedroom count, clear the building or set
              status to Any.
            </p>
          </Card>
        ) : (
          <Result est={est} unitSize={unitSize} sized={!!sizeNum} areaSlug={slug} />
        )}
      </div>
    </div>
  );
}

function Result({
  est,
  unitSize,
  sized,
  areaSlug,
}: {
  est: NonNullable<ReturnType<typeof estimate>>;
  unitSize: number;
  sized: boolean;
  areaSlug: string;
}) {
  const scatter = useMemo(
    () => ({
      ...baseOption(),
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      legend: { show: false },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(10,14,23,0.92)",
        borderColor: "rgba(255,255,255,0.12)",
        textStyle: { color: "#eef0f6", fontSize: 12 },
        formatter: (p: { data: [string, number, number, string] }) =>
          `${dateLabel(p.data[0])}<br/>${p.data[3]}<br/><b>AED ${num(p.data[1])}/sqft</b> · ${aed(p.data[2])}`,
      },
      xAxis: { type: "time", axisLabel: { color: COLORS.faint, fontSize: 11 }, splitLine: { show: false }, axisLine: { lineStyle: { color: COLORS.grid } } },
      yAxis: { type: "value", scale: true, axisLabel: { color: COLORS.faint, fontSize: 11 }, splitLine: { lineStyle: { color: COLORS.grid } } },
      series: [
        {
          type: "scatter",
          symbolSize: (d: [string, number, number]) => Math.max(6, Math.min(18, Math.sqrt(d[2] / 1e5) * 3)),
          data: est.comps.map((c) => [c.date, Math.round(c.ppsf), c.price, c.building ?? c.project ?? "", c.offplan]),
          itemStyle: {
            color: (p: { data: unknown[] }) => (p.data[4] ? "rgba(139,123,255,0.85)" : "rgba(63,224,197,0.85)"),
            borderColor: "rgba(255,255,255,0.3)",
          },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(231,183,95,0.08)" },
            data: [[{ yAxis: est.ppsfLow }, { yAxis: est.ppsfHigh }]],
          },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: COLORS.gold, width: 2, type: "solid" },
            label: { color: COLORS.gold, formatter: `Fair AED ${num(est.ppsf)}/sqft`, position: "insideEndTop" },
            data: [{ yAxis: est.ppsf }],
          },
        },
      ],
    }),
    [est],
  );

  return (
    <>
      <FadeIn immediate>
        <Card glow="gold" className="relative">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-gold/10 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold">
                <Sparkles className="size-3.5" /> Fair value estimate
              </div>
              <motion.div
                key={Math.round(est.value)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 font-display text-6xl tracking-tight text-ink sm:text-7xl"
              >
                {aed(est.value)}
              </motion.div>
              <div className="mt-2 text-sm text-muted">
                Likely range <span className="text-ink">{aed(est.low)}</span> – <span className="text-ink">{aed(est.high)}</span>
                {" · "}AED {num(est.ppsf)}/sqft{!sized && " · typical size"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <div className="text-[11px] text-faint">Confidence</div>
                <div className={cn("font-medium", est.confidence === "High" ? "text-up" : est.confidence === "Medium" ? "text-gold" : "text-down")}>
                  {est.confidence}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-faint">Comparables</div>
                <div className="font-medium text-ink">
                  {est.comps.length} · same {est.level}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-faint">Est. annual rent</div>
                <div className="font-medium text-ink">{aed(est.rent)}</div>
              </div>
              <div>
                <div className="text-[11px] text-faint">Gross yield</div>
                <div className="font-medium text-teal">{pct(est.rent ? est.rent / est.value : null, { sign: false })}</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Median of the {est.comps.length} most recent comparable sales (same {est.level}, bedrooms and type
            {sized ? ", similar size" : ""}), each brought to today with the area&apos;s mix-adjusted price index. Range is the
            middle 50%. {est.rentSource && `Rent: ${est.rentSource}.`} An estimate from public records, not a formal valuation.
          </p>
        </Card>
      </FadeIn>

      <FadeIn immediate>
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-medium text-ink">Comparable sales</div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal" />Ready</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet" />Off-plan</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gold" />Fair value</span>
            </div>
          </div>
          <Chart option={scatter as never} height={300} />
        </Card>
      </FadeIn>

      {est.rent && (
        // Remount when the estimate changes so the sliders start from the new numbers.
        <Calculator key={`${Math.round(est.value)}-${est.rent}`} value={est.value} rent={est.rent} size={unitSize} />
      )}

      <FadeIn immediate>
        <Card className="p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div className="text-lg font-medium text-ink">The comparables</div>
            <Link href={`/areas/${areaSlug}/`} className="text-sm text-gold hover:underline">Area profile</Link>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 bg-elevated/95 backdrop-blur">
                <tr className="text-left text-xs text-faint">
                  <th className="px-6 py-2 font-normal">Date</th>
                  <th className="px-3 py-2 font-normal">Building / project</th>
                  <th className="px-3 py-2 text-right font-normal">Size</th>
                  <th className="px-3 py-2 text-right font-normal">Price</th>
                  <th className="px-6 py-2 text-right font-normal">AED/sqft</th>
                </tr>
              </thead>
              <tbody>
                {est.comps.slice(0, 60).map((c, i) => (
                  <tr key={i} className="border-t border-line/50">
                    <td className="whitespace-nowrap px-6 py-2 text-muted">{dateLabel(c.date)}</td>
                    <td className="px-3 py-2 text-ink">
                      {c.building ?? c.project ?? "—"}
                      {c.offplan && <span className="ml-2 rounded-full bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet">off-plan</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted">{num(c.size)}</td>
                    <td className="px-3 py-2 text-right tabular text-ink">{aed(c.price)}</td>
                    <td className="px-6 py-2 text-right tabular text-gold">{num(c.ppsf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </FadeIn>
    </>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular text-ink">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold)]"
      />
    </label>
  );
}

function Calculator({ value, rent, size }: { value: number; rent: number; size: number }) {
  const [price, setPrice] = useState(Math.round(value / 1000) * 1000);
  const [annualRent, setAnnualRent] = useState(Math.round(rent / 500) * 500);
  const [ltv, setLtv] = useState(0.6);
  const [rate, setRate] = useState(0.045);
  const [service, setService] = useState(16);
  const [vacancy, setVacancy] = useState(0.05);
  const r = returns({ price, rent: annualRent, size, serviceCharge: service, ltv, rate, years: 25, vacancy });

  return (
    <FadeIn immediate>
      <Card glow="teal">
        <div className="mb-5 flex items-center gap-2">
          <div className="text-lg font-medium text-ink">Investment returns</div>
          <InfoTip text="Upfront: deposit + 4% DLD fee + 2% agency (+VAT) + registration and mortgage fees. Costs: service charge per sq ft plus 0.5% maintenance. 25-year mortgage." />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Slider label="Purchase price" value={price} min={Math.round(value * 0.6)} max={Math.round(value * 1.5)} step={5000} onChange={setPrice} format={(v) => aed(v)} />
            <Slider label="Annual rent" value={annualRent} min={Math.round(rent * 0.5)} max={Math.round(rent * 1.6)} step={500} onChange={setAnnualRent} format={(v) => aed(v)} />
            <Slider label="Loan to value" value={ltv} min={0} max={0.8} step={0.05} onChange={setLtv} format={(v) => (v ? `${Math.round(v * 100)}%` : "Cash")} />
            <Slider label="Mortgage rate" value={rate} min={0.02} max={0.08} step={0.0025} onChange={setRate} format={(v) => `${(v * 100).toFixed(2)}%`} />
            <Slider label="Service charge (AED/sqft/yr)" value={service} min={0} max={40} step={1} onChange={setService} format={(v) => `${v}`} />
            <Slider label="Vacancy" value={vacancy} min={0} max={0.25} step={0.01} onChange={setVacancy} format={(v) => `${Math.round(v * 100)}%`} />
          </div>
          <div className="grid grid-cols-2 content-start gap-4">
            {[
              ["Cash needed upfront", aed(r.upfront), "text-ink"],
              ["Monthly mortgage", r.monthlyPayment ? aed(r.monthlyPayment) : "—", "text-ink"],
              ["Gross yield", pct(r.grossYield, { sign: false }), "text-ink"],
              ["Net yield", pct(r.netYield, { sign: false }), "text-teal"],
              ["Annual cash flow", aed(r.cashFlow), r.cashFlow >= 0 ? "text-up" : "text-down"],
              ["Cash-on-cash return", pct(r.cashOnCash), r.cashOnCash >= 0 ? "text-up" : "text-down"],
            ].map(([label, v, color]) => (
              <div key={label} className="rounded-xl border border-line bg-white/[0.02] p-4">
                <div className="text-[11px] text-faint">{label}</div>
                <div className={cn("mt-1 text-xl font-semibold tabular", color)}>{v}</div>
              </div>
            ))}
            <p className="col-span-2 text-xs leading-relaxed text-faint">
              Costs a year: {aed(r.annualCosts)} (service charge on {num(size)} sq ft plus maintenance). Not financial
              advice; check fees and rates with your bank and broker.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}
