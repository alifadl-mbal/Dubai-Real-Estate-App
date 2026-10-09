# Skyline — Dubai property, decoded

A free, fast, fully static website that turns every Dubai Land Department (DLD) sale and
Ejari lease into prices, yields, valuations and supply signals.

- **Market**: a mix-adjusted price index since 2010, volumes split off-plan vs ready, rents
  vs prices, and a breakdown by unit type.
- **Map**: every community in 3D, coloured by price, like-for-like growth, yield, liquidity,
  off-plan share, supply pipeline or investor score.
- **Areas**: a sortable screener of every active area, and a profile page for each one. A
  profile has a like-for-like price trend, prices and yields by unit type, top projects,
  coming supply, latest sales and nearby alternatives.
- **Valuation**: fair value for a specific unit from the closest comparable sales (same
  building, then project, then area), adjusted to today's prices. It also estimates rent and
  yield, and has an investment calculator covering fees, mortgage, service charges and
  cash-on-cash return.
- **Yields**: the investor quadrant (growth against yield) and a yield league table.
- **Supply**: units due by year, the biggest projects underway, and each developer's track
  record.
- **Deals**: the biggest and latest registered transactions.
- **Search**: ⌘K / Ctrl K finds any area or project.

No API keys and no server. Every number is computed ahead of time and served as static files.

## How it works

```
data.dubai (DLD open data, no login)          Python pipeline (`dre`)              Next.js static site
──────────────────────────────────────        ───────────────────────              ───────────────────
Real Estate Transactions (1966 →, 1.8M)  ─┐
Rent Contracts / Ejari (≈5 GB)           ─┤   fetch → clean → analyse → JSON  ──►  web/public/data/*.json
Real Estate Projects + Developers        ─┤   (src/dubai_re)                       └► next build → web/out/
DLD live API (days newer than the export)─┘                                          (plain HTML/JS/JSON)
Community boundaries © Dubai Municipality → reference/area_boundaries.geojson
```

| Command | What it does |
|---|---|
| `uv run dre fetch transactions rent_contracts projects developers areas` | Downloads the bulk CSV exports from data.dubai into `data/raw/` |
| `uv run dre import-history` | Builds `data/transactions.parquet` from the transactions export |
| `uv run dre update` | Adds days newer than the export from DLD's live API |
| `uv run dre rents` | Keeps new residential leases from the last three years (`data/rents.parquet`) |
| `uv run dre site` | Computes everything the site shows and writes `web/public/data/` |
| `uv run dre geocode` / `dre boundaries` | Refreshes area points and community shapes (rarely needed) |

### Methods, in brief

- **Prices** are AED per sq ft of single-unit residential sales (apartments and villas).
- **The price index is mix-adjusted.** A raw median jumps when a luxury launch dominates a
  month. The index compares the same area, type and bedroom cells month to month, with
  Jan 2020 = 100.
- **Growth is like-for-like.** It is the median price change across the same projects and
  unit types in both periods.
- **Gross yield** is the median new-lease rent divided by the median sale price, matched by
  area, type and bedrooms. Renewals are excluded because RERA caps them below market.
- **Valuations** use the most recent comparable sales. Each sale is brought to today with the
  area's index, and the range shown is the middle 50%.
- **The investor score** is a percentile blend: yield 35%, 1-year growth 25%, 3-year growth
  15% and liquidity 25%.

## Run it locally

Requires [uv](https://docs.astral.sh/uv/) and Node.js 20+.

```bash
uv sync
uv run dre fetch transactions rent_contracts projects developers areas   # ~6.5 GB, a few minutes
uv run dre import-history && uv run dre update && uv run dre rents && uv run dre site

cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in web/out/
```

## Free hosting

The site is plain static files, so it costs nothing to host.
`.github/workflows/deploy.yml` rebuilds it from fresh DLD data every morning and deploys it:

1. **GitHub Pages (default, no setup):** in the repository go to *Settings → Pages* and set
   *Source* to **GitHub Actions**. Then run the *Build and deploy* workflow once. The site
   appears at `https://<user>.github.io/<repo>/`.
2. **Cloudflare Pages (optional):** gives unlimited bandwidth, a global CDN and an easy
   custom domain. Create a free Cloudflare account and an API token with *Pages: Edit*.
   Then add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The
   same workflow also deploys to `skyline-dubai.pages.dev`.

Any static host (Netlify, Vercel, S3) also works: upload `web/out/`.

## Development

```bash
uv run pytest && uv run ruff check     # pipeline tests and lint
cd web && npm run lint && npm run typecheck
```

```
src/dubai_re/
  opendata.py   data.dubai bulk downloads (signed CDN links, no login)
  ingest.py     DLD live API client
  transform.py  one clean schema for bulk and API transactions
  rents.py      Ejari leases → rents table
  site.py       analytics + JSON export for the web app
  boundaries.py community polygons; geocode.py area points (OpenStreetMap)
web/src/
  app/          one folder per page (all prerendered)
  components/   map (deck.gl + MapLibre), charts (ECharts), page views
  lib/          data types, formatting, metrics, valuation maths
```

## Data and licences

- Transactions, rents, projects and developers: © Dubai Land Department, published as open
  data on [data.dubai](https://data.dubai) under the Dubai Data law.
- Community boundaries: © Dubai Municipality.
- Basemap: © CARTO, © OpenStreetMap contributors.

Figures are derived from public records for research. They are not official DLD statistics
or investment advice. Code: MIT, see [LICENSE](LICENSE).
