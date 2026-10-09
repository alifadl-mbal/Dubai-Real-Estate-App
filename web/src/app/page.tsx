import { DealTicker, Hero, IndexStory, Leaderboards, PulseStrip, Tools } from "@/components/home";
import { getAreas, getDeals, getMarket, getMeta } from "@/lib/server-data";

export default async function Home() {
  const [market, areas, deals, meta] = await Promise.all([getMarket(), getAreas(), getDeals(), getMeta()]);
  return (
    <>
      <Hero market={market} areas={areas} meta={meta} />
      <DealTicker deals={deals.top} />
      <div className="px-4 sm:px-6">
        <PulseStrip market={market} />
      </div>
      <IndexStory market={market} />
      <Leaderboards areas={areas} />
      <Tools />
    </>
  );
}
