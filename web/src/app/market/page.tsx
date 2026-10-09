import type { Metadata } from "next";

import { MarketView } from "@/components/market-view";
import { PageHeader } from "@/components/page-header";
import { dateLabel } from "@/lib/format";
import { getMarket } from "@/lib/server-data";

export const metadata: Metadata = { title: "Market" };

export default async function MarketPage() {
  const market = await getMarket();
  return (
    <>
      <PageHeader eyebrow={`Market · to ${dateLabel(market.asOf)}`} title={<>The Dubai market, <span className="italic text-gradient-gold">month by month.</span></>}>
        Prices, volumes and rents from every registered sale and new lease. The price index compares like with like, so
        a wave of cheap off-plan launches can&apos;t masquerade as a price fall.
      </PageHeader>
      <MarketView market={market} />
    </>
  );
}
