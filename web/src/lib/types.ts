// Shapes of the JSON files written by `dre site` (src/dubai_re/site.py).

export type Num = number | null;

export interface PulseWindow {
  deals: Num;
  value: Num;
  ppsf: Num;
  offplan: Num;
  price: Num;
}

export interface Market {
  asOf: string;
  pulse: { now: PulseWindow; prev: PulseWindow; lastYear: PulseWindow };
  monthly: {
    month: string[];
    deals: Num[];
    value: Num[];
    offplanValue: Num[];
    offplanShare: Num[];
    ppsf: Num[];
    ppsfApartment: Num[];
    ppsfVilla: Num[];
    index: Num[];
    mortgages: Num[];
    rentApartment: Num[];
    partialLast: boolean;
  };
  weekly: { week: string[]; deals: Num[]; value: Num[] };
  yearly: { year: number[]; deals: Num[]; value: Num[] };
  rooms: { segment: string; rooms: string; deals: number; ppsf: Num; price: Num }[];
}

export interface Area {
  slug: string;
  name: string;
  knownAs: string | null;
  lat: Num;
  lng: Num;
  deals12m: number;
  value12m: Num;
  ppsf: Num;
  ppsfPrev: Num;
  price: Num;
  growth6m: Num;
  growth1y: Num;
  growth3y: Num;
  yield: Num;
  rent: Num;
  offplanShare: Num;
  villaShare: Num;
  dealsPerMonth: Num;
  spark: Num[];
  firstSale: number;
  score: number;
  pipelineUnits: number;
}

export interface AreaDetail extends Area {
  series: {
    month: string[];
    median: Num[];
    p25: Num[];
    p75: Num[];
    index: Num[];
    deals: Num[];
    offplanDeals: Num[];
  };
  rooms: {
    segment: string;
    rooms: string;
    deals: number;
    price: Num;
    ppsf: Num;
    size: Num;
    rent: Num;
    yield: Num;
  }[];
  projects: {
    name: string;
    deals: number;
    ppsf: Num;
    price: Num;
    offplanShare: Num;
    growth1y: Num;
  }[];
  recent: Deal[];
  pipeline: PipelineProject[];
  neighbours: {
    slug: string;
    name: string;
    knownAs: string | null;
    ppsf: Num;
    yield: Num;
    growth1y: Num;
    km: number;
  }[];
}

export interface Deal {
  date: string;
  area?: string;
  slug?: string;
  project: string | null;
  building: string | null;
  type?: string | null;
  segment?: string;
  rooms: string | null;
  size: Num;
  price?: Num;
  value?: Num;
  ppsf: Num;
  units?: number;
  offplan: boolean | null;
}

export interface PipelineProject {
  name: string | null;
  number: string;
  developer: string | null;
  area: string;
  slug: string | null;
  status: string;
  progress: Num;
  units: number;
  expected: string | null;
  start: string | null;
}

export interface Pipeline {
  asOf: string;
  byYear: { year: number; units: number }[];
  developers: {
    name: string;
    projects: number;
    finished: number;
    active: number;
    unitsDelivered: number;
    unitsPipeline: number;
    buildMonths: Num;
    avgProgress: Num;
  }[];
  projects: PipelineProject[];
  totals: { units: number; projects: number; developers: number };
}

export interface Comps {
  projects: string[];
  buildings: string[];
  rooms: string[];
  d: number[];
  p: number[];
  b: number[];
  r: number[];
  s: number[];
  a: Num[];
  v: Num[];
  o: number[];
  rents: [string | null, string, string | null, number, number][];
}

export interface Meta {
  asOf: string;
  built: string;
  transactions: number;
  sales: number;
  leases: number;
  areas: number;
  firstYear: number;
  indexBase: string;
}

export interface SearchIndex {
  areas: [string, string, string | null][];
  projects: [string, string, number][];
}
