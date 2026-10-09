import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { YieldsView } from "@/components/yields-view";
import { getAreas } from "@/lib/server-data";

export const metadata: Metadata = { title: "Rental yields" };

export default async function YieldsPage() {
  const areas = await getAreas();
  return (
    <>
      <PageHeader eyebrow="Rental yields" title={<>Where income meets <span className="italic text-gradient-gold">upside.</span></>}>
        Gross yields from {""}new Ejari leases against sale prices, matched by area and bedrooms, set against like-for-like
        price growth. Renewals are excluded because RERA caps them below market.
      </PageHeader>
      <YieldsView areas={areas} />
    </>
  );
}
