import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Area, AreaDetail, Market, Meta, Pipeline } from "./types";

// Pages are prerendered at build time, so server components read the exported JSON from disk
// and the numbers land in the HTML (fast first paint, crawlable). Heavier files (comps, map
// shapes) are fetched by the browser on demand instead.
const DATA_DIR = path.join(process.cwd(), "public", "data");

async function read<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8")) as T;
}

export const getMeta = () => read<Meta>("meta.json");
export const getMarket = () => read<Market>("market.json");
export const getPipeline = () => read<Pipeline>("pipeline.json");
export const getAreas = async () => (await read<{ areas: Area[] }>("areas.json")).areas;
export const getArea = (slug: string) => read<AreaDetail>(`areas/${slug}.json`);
export const getDeals = () =>
  read<{ asOf: string; top: import("./types").Deal[]; latest: import("./types").Deal[] }>(
    "deals.json",
  );
