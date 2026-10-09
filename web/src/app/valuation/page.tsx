import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ValuationTool } from "@/components/valuation-tool";
import { getAreas } from "@/lib/server-data";

export const metadata: Metadata = { title: "Valuation" };

export default async function ValuationPage() {
  const areas = await getAreas();
  return (
    <>
      <PageHeader eyebrow="Valuation" title={<>What is it <span className="italic text-gradient-gold">really</span> worth?</>}>
        Fair value from the closest comparable sales: same building first, then project, then area, each brought to
        today&apos;s prices. Plus the rent it should fetch and what it returns after costs.
      </PageHeader>
      <Suspense fallback={<div className="mx-auto h-96 max-w-7xl px-4 sm:px-6"><div className="skeleton h-full" /></div>}>
        <ValuationTool areas={areas} />
      </Suspense>
    </>
  );
}
