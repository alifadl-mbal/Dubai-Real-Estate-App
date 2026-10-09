"""Command-line entry point for the data pipeline: ``uv run dre --help``."""

from __future__ import annotations

import argparse
import logging
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from dubai_re import boundaries, geocode, ingest, opendata, rents, site, store, transform

log = logging.getLogger("dubai_re")

# The live API only serves roughly the current year, so a first run asks for a bit more and
# takes whatever comes back.
FIRST_RUN_LOOKBACK = timedelta(days=400)
# Recently registered deals can be amended for a few days, so each update re-reads a window.
UPDATE_OVERLAP = timedelta(days=14)


def _existing() -> pd.DataFrame:
    if store.TRANSACTIONS_PATH.exists():
        return store.load_transactions()
    return pd.DataFrame(columns=transform.COLUMNS)


def update(since: date | None = None) -> None:
    """Pull new transactions from the live API and merge them into the local dataset."""
    current = _existing()
    today = date.today()
    if since is None:
        since = (
            current["date"].max().date() - UPDATE_OVERLAP
            if not current.empty
            else today - FIRST_RUN_LOOKBACK
        )
    log.info("Fetching transactions from %s to %s", since, today)
    recent = transform.from_api(ingest.fetch_transactions(since, today))
    # The bulk export is richer than the API (building names, project numbers), so the API
    # only fills the days after the latest bulk file.
    bulk = current[current["source"] == "bulk"]
    if not bulk.empty:
        recent = recent[recent["date"].dt.normalize() > bulk["date"].max().normalize()]
    if recent.empty:
        log.info("No API transactions newer than the bulk file; dataset left unchanged")
        return
    store.save_transactions(transform.combine(current, recent))


def _read_bulk(csv_path: Path) -> pd.DataFrame:
    log.info("Reading %s", csv_path)
    header = pd.read_csv(csv_path, nrows=0).columns
    usecols = [c for c in transform.BULK_SOURCE_COLUMNS if c in header]
    return pd.read_csv(csv_path, usecols=usecols, dtype="string", engine="pyarrow")


def import_history(csv_paths: list[Path]) -> None:
    """Load the bulk transactions export as the historical base of the dataset.

    data.dubai splits the export into parts (``transactions_..._0001.csv``, ``_0002.csv``);
    pass them all at once so portfolio deals spanning two parts are still counted once.
    """
    raw = pd.concat([_read_bulk(path) for path in csv_paths], ignore_index=True)
    history = transform.from_bulk(raw)
    log.info(
        "Bulk file covers %s to %s (%s rows)",
        history["date"].min().date(),
        history["date"].max().date(),
        f"{len(history):,}",
    )
    current = _existing()
    recent = current[current["source"] == "api"] if not current.empty else current
    recent = recent[recent["date"].dt.normalize() > history["date"].max().normalize()]
    store.save_transactions(transform.combine(history, recent))


def geocode_areas() -> None:
    df = store.load_transactions()
    geocode.geocode_areas(df["area_name"].dropna().unique())


def main() -> None:
    parser = argparse.ArgumentParser(prog="dre", description="Dubai real estate data pipeline")
    parser.add_argument("-v", "--verbose", action="store_true", help="show debug logs")
    commands = parser.add_subparsers(dest="command", required=True)

    update_cmd = commands.add_parser("update", help="fetch new transactions from the DLD API")
    update_cmd.add_argument(
        "--since", type=date.fromisoformat, help="re-fetch from this date (YYYY-MM-DD)"
    )

    history_cmd = commands.add_parser(
        "import-history", help="load the bulk transactions CSV export for pre-API history"
    )
    history_cmd.add_argument(
        "csv",
        type=Path,
        nargs="*",
        help="the export file(s); defaults to the parts downloaded by `dre fetch transactions`",
    )

    fetch_cmd = commands.add_parser("fetch", help="download bulk exports from data.dubai")
    fetch_cmd.add_argument("datasets", nargs="+", choices=sorted(opendata.DATASETS))
    fetch_cmd.add_argument("--force", action="store_true", help="re-download existing parts")

    commands.add_parser("rents", help="build the rents table from downloaded Ejari contracts")
    commands.add_parser("boundaries", help="rebuild community boundary shapes")
    commands.add_parser("site", help="export the JSON data files the web app reads")
    commands.add_parser("geocode", help="look up map coordinates for new area names")

    args = parser.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.command == "update":
        update(args.since)
    elif args.command == "import-history":
        paths = args.csv or sorted((opendata.RAW_DIR / "transactions").glob("*.csv"))
        if not paths:
            parser.error("no CSV given and none downloaded; run `dre fetch transactions` first")
        import_history(paths)
    elif args.command == "fetch":
        for name in args.datasets:
            opendata.download(name, force=args.force)
    elif args.command == "rents":
        rents.build_rents()
    elif args.command == "boundaries":
        boundaries.build_boundaries()
    elif args.command == "site":
        site.build_site()
    elif args.command == "geocode":
        geocode_areas()
