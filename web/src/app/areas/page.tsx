import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Screener } from "@/components/screener";
import { getAreas } from "@/lib/server-data";

export const metadata: Metadata = { title: "Area screener" };

export default async function AreasPage() {
  const areas = await getAreas();
  return (
    <>
      <PageHeader eyebrow="Area screener" title={<>Every community, <span className="italic text-gradient-gold">ranked.</span></>}>
        Sort {areas.length} Dubai areas by price, like-for-like growth, rental yield, liquidity and supply. Click any row for
        the full profile.
      </PageHeader>
      <Screener areas={areas} />
    </>
  );
}
