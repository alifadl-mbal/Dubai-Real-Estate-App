import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PipelineView } from "@/components/pipeline-view";
import { getPipeline } from "@/lib/server-data";

export const metadata: Metadata = { title: "Supply pipeline" };

export default async function PipelinePage() {
  const pipeline = await getPipeline();
  return (
    <>
      <PageHeader eyebrow="Supply pipeline" title={<>Know what&apos;s <span className="italic text-gradient-gold">coming.</span></>}>
        Every project registered with the Dubai Land Department that hasn&apos;t completed yet: how many units land each
        year, where, and which developers are building them.
      </PageHeader>
      <PipelineView pipeline={pipeline} />
    </>
  );
}
