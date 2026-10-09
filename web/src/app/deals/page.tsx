import type { Metadata } from "next";

import { DealsView } from "@/components/deals-view";
import { PageHeader } from "@/components/page-header";
import { getDeals } from "@/lib/server-data";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const deals = await getDeals();
  return (
    <>
      <PageHeader eyebrow="Deal flow" title={<>The biggest deals, <span className="italic text-gradient-gold">as registered.</span></>}>
        The largest and latest transactions recorded by the Dubai Land Department over the last 30 days.
      </PageHeader>
      <DealsView top={deals.top} latest={deals.latest} />
    </>
  );
}
