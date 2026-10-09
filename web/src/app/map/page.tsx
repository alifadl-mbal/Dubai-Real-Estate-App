import type { Metadata } from "next";

import { MapExplorer } from "@/components/map-explorer";
import { getAreas } from "@/lib/server-data";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const areas = await getAreas();
  return (
    <>
      <h1 className="sr-only">Dubai property map</h1>
      <MapExplorer areas={areas} />
    </>
  );
}
