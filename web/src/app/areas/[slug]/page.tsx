import type { Metadata } from "next";

import { AreaProfile } from "@/components/area-profile";
import { areaTitle, num, pct } from "@/lib/format";
import { getArea, getAreas } from "@/lib/server-data";

// Every area profile is prerendered; unknown slugs are a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  const areas = await getAreas();
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/areas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const area = await getArea(slug);
  return {
    title: `${areaTitle(area)} property prices`,
    description: `${areaTitle(area)}: median AED ${num(area.ppsf)}/sq ft, ${pct(area.growth1y)} over a year, ${pct(
      area.yield,
      { sign: false },
    )} gross yield. Built from Dubai Land Department records.`,
  };
}

export default async function AreaPage({ params }: PageProps<"/areas/[slug]">) {
  const { slug } = await params;
  const [area, areas] = await Promise.all([getArea(slug), getAreas()]);
  return <AreaProfile area={area} areas={areas} />;
}
