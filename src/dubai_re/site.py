"""Export the compact JSON files the web app reads (``web/public/data``).

The site is fully static, so every number it shows is computed here. Prices are quoted the
way the Dubai market quotes them: AED per square foot.

Method notes (also shown on the site):
- Price statistics use single-unit residential sales (apartments and villas) only.
- The price index is mix-adjusted: log price per sqft is explained by a fixed effect per
  (area, segment, bedrooms) cell plus a month effect; the month effects are the index. A plain
  median moves when *what* sells changes; this index doesn't.
- Area growth is like-for-like: the median change across (project, bedrooms) cells that sold
  in both periods, so a new launch in an area doesn't fake a price move.
- Gross yield = median new-lease rent / median sale price, matched by area, segment and
  bedrooms, over the last 12 months.
"""

from __future__ import annotations

import json
import logging
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd

from dubai_re.opendata import RAW_DIR
from dubai_re.rents import RENTS_PATH
from dubai_re.store import AREA_COORDINATES_PATH, load_transactions

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "web" / "public" / "data"
BOUNDARIES_PATH = ROOT / "reference" / "area_boundaries.geojson"

SQFT_PER_SQM = 10.7639
INDEX_BASE = "2020-01"
MIN_AREA_SALES = 20  # priced sales in the last 24 months for an area to get a profile
SEGMENTS = {"Flat": "Apartment", "Villa": "Villa", "Stacked Townhouses": "Villa"}
ROOMS = ["Studio", "1 B/R", "2 B/R", "3 B/R", "4 B/R", "5 B/R", "6 B/R", "7+ B/R", "Penthouse"]
ROOM_LABELS = {
    "Studio": "Studio",
    "1 B/R": "1 bed",
    "2 B/R": "2 beds",
    "3 B/R": "3 beds",
    "4 B/R": "4 beds",
    "5 B/R": "5 beds",
    "6 B/R": "6 beds",
    "7+ B/R": "7+ beds",
    "Penthouse": "Penthouse",
}


# Helpers ---------------------------------------------------------------------------------------


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _num(value, digits: int = 0):
    """JSON-safe rounding: NaN/inf become null."""
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return None
    if pd.isna(value):
        return None
    value = float(value)
    return int(round(value)) if digits == 0 else round(value, digits)


def _nums(values, digits: int = 0) -> list:
    return [_num(v, digits) for v in values]


def _clean(value):
    """Recursively turn NaN/inf (and numpy scalars) into JSON-safe values."""
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_clean(v) for v in value]
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _write(name: str, payload) -> None:
    path = OUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(_clean(payload), separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(text, "utf-8")


def _median(series: pd.Series):
    return series.median() if len(series) else np.nan


def _change(now, then):
    if then is None or now is None or pd.isna(now) or pd.isna(then) or then <= 0:
        return None
    return now / then - 1


# Preparation -----------------------------------------------------------------------------------


def _sales(df: pd.DataFrame) -> pd.DataFrame:
    sales = df[df["trans_group"] == "Sales"].copy()
    sales["segment"] = sales["property_sub_type"].astype("string").map(SEGMENTS)
    sales["ppsf"] = sales["meter_sale_price"] / SQFT_PER_SQM
    sales["size_sqft"] = sales["procedure_area"] * SQFT_PER_SQM
    priced = (
        sales["segment"].notna()
        & sales["usage"].eq("Residential")
        & sales["ppsf"].between(150, 15_000)
        & sales["procedure_area"].ge(15)
    )
    sales["priced"] = priced.fillna(False)
    sales["month"] = sales["date"].dt.to_period("M")
    return sales


def _rents() -> pd.DataFrame:
    if not RENTS_PATH.exists():
        log.warning("No rents table (%s); yields will be empty", RENTS_PATH)
        return pd.DataFrame(
            columns=["date", "area_name", "project", "property_sub_type", "rooms", "annual_rent"]
        )
    rents = pd.read_parquet(RENTS_PATH)
    rents["segment"] = rents["property_sub_type"].astype("string").map(SEGMENTS)
    return rents


def _known_as(sales: pd.DataFrame, as_of: pd.Timestamp) -> dict[str, str]:
    """The name most buyers use for a DLD area: its most traded master project."""
    recent = sales[sales["date"] > as_of - pd.DateOffset(years=3)].dropna(subset=["master_project"])
    top = (
        recent.groupby(["area_name", "master_project"], observed=True)
        .size()
        .reset_index(name="n")
        .sort_values("n", ascending=False)
        .drop_duplicates("area_name")
    )
    totals = recent.groupby("area_name", observed=True).size()
    names = {}
    for row in top.itertuples():
        share = row.n / totals.get(row.area_name, 1)
        alias = str(row.master_project)
        if share >= 0.35 and slugify(alias) != slugify(str(row.area_name)):
            names[str(row.area_name)] = alias
    return names


# Price index -----------------------------------------------------------------------------------


def price_index(priced: pd.DataFrame, cell_columns: list[str], min_obs: int = 60) -> pd.Series:
    """Mix-adjusted monthly index (base ``INDEX_BASE`` = 100) by alternating fixed effects."""
    data = priced[priced["month"] >= pd.Period("2007-01", "M")]
    counts = data.groupby("month").size()
    data = data[data["month"].isin(counts[counts >= min_obs].index)]
    if data.empty:
        return pd.Series(dtype=float)
    cells = data[cell_columns].astype("string").fillna("?").agg("|".join, axis=1)
    y = np.log(data["ppsf"].to_numpy())
    cell_codes, cell_index = pd.factorize(cells)
    month_codes, month_index = pd.factorize(data["month"])
    cell_fx = np.zeros(len(cell_index))
    month_fx = np.zeros(len(month_index))
    for _ in range(25):
        resid = y - cell_fx[cell_codes]
        month_fx = np.bincount(month_codes, resid) / np.bincount(month_codes)
        resid = y - month_fx[month_codes]
        cell_fx = np.bincount(cell_codes, resid) / np.bincount(cell_codes)
    index = pd.Series(np.exp(month_fx), index=month_index).sort_index()
    index = index.rolling(3, min_periods=1).mean()  # smooth monthly sampling noise
    base = pd.Period(INDEX_BASE, "M")
    reference = index.get(base, index.iloc[0])
    return index / reference * 100


def matched_growth(
    priced: pd.DataFrame,
    now_start: pd.Timestamp,
    now_end: pd.Timestamp,
    then_start: pd.Timestamp,
    then_end: pd.Timestamp,
    keys: list[str],
    min_cells: int = 3,
):
    """Like-for-like price change: median ratio across cells that sold in both windows."""
    now = priced[(priced["date"] > now_start) & (priced["date"] <= now_end)]
    then = priced[(priced["date"] > then_start) & (priced["date"] <= then_end)]
    a = now.groupby(keys, observed=True)["ppsf"].agg(["median", "size"])
    b = then.groupby(keys, observed=True)["ppsf"].agg(["median", "size"])
    both = a.join(b, lsuffix="_now", rsuffix="_then", how="inner")
    both = both[(both["size_now"] >= 3) & (both["size_then"] >= 3)]
    if len(both) >= min_cells:
        ratio = np.log(both["median_now"] / both["median_then"])
        weights = np.minimum(both["size_now"], both["size_then"])
        order = np.argsort(ratio.to_numpy())
        cum = np.cumsum(weights.to_numpy()[order])
        median = ratio.to_numpy()[order][np.searchsorted(cum, cum[-1] / 2)]
        return float(np.exp(median) - 1)
    if len(now) >= 20 and len(then) >= 20:
        return _change(now["ppsf"].median(), then["ppsf"].median())
    return None


# Yields ----------------------------------------------------------------------------------------


def cell_yields(sales_12m: pd.DataFrame, rents_12m: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Gross yield per cell where both sales and new leases are frequent enough."""
    price = sales_12m.groupby(keys, observed=True)["actual_worth"].agg(["median", "size"])
    rent = rents_12m.groupby(keys, observed=True)["annual_rent"].agg(["median", "size"])
    cells = price.join(rent, lsuffix="_price", rsuffix="_rent", how="inner")
    cells = cells[(cells["size_price"] >= 5) & (cells["size_rent"] >= 5)]
    cells["yield"] = cells["median_rent"] / cells["median_price"]
    return cells[cells["yield"].between(0.01, 0.15)]


def _weighted_yield(cells: pd.DataFrame):
    if cells.empty:
        return None
    weights = np.minimum(cells["size_price"], cells["size_rent"])
    return float(np.average(cells["yield"], weights=weights))


# Builders --------------------------------------------------------------------------------------


def build_market(sales: pd.DataFrame, df: pd.DataFrame, rents: pd.DataFrame, as_of) -> dict:
    priced = sales[sales["priced"]]
    window = pd.Timedelta(days=30)

    def pulse_window(end):
        current = sales[(sales["date"] > end - window) & (sales["date"] <= end)]
        current_priced = current[current["priced"]]
        return {
            "deals": current["transaction_number"].nunique(),
            "value": current["value_share"].sum(),
            "ppsf": _median(current_priced["ppsf"]),
            "offplan": current["is_offplan"].mean() if len(current) else None,
            "price": _median(current_priced["actual_worth"]),
        }

    now = pulse_window(as_of)
    prev = pulse_window(as_of - window)
    last_year = pulse_window(as_of - pd.DateOffset(years=1))

    monthly_sales = sales[sales["date"] >= "2004-01-01"]
    by_month = monthly_sales.groupby("month")
    months = pd.period_range(monthly_sales["month"].min(), sales["month"].max(), freq="M")
    deals = by_month["transaction_number"].nunique().reindex(months)
    value = by_month["value_share"].sum().reindex(months)
    offplan = by_month["is_offplan"].mean().reindex(months)
    monthly_priced = priced[priced["date"] >= "2004-01-01"].groupby("month")
    ppsf = monthly_priced["ppsf"].median().reindex(months)
    seg = priced.pivot_table(
        index="month", columns="segment", values="ppsf", aggfunc="median"
    ).reindex(months)
    index = price_index(priced, ["area_name", "segment", "rooms"]).reindex(months)
    groups = df[df["date"] >= "2004-01-01"].copy()
    groups["month"] = groups["date"].dt.to_period("M")
    mortgages = (
        groups[groups["trans_group"] == "Mortgage"]
        .groupby("month")["transaction_number"]
        .nunique()
        .reindex(months)
    )
    offplan_value = (
        monthly_sales[monthly_sales["is_offplan"].fillna(False)]
        .groupby("month")["value_share"]
        .sum()
        .reindex(months)
    )
    rent_monthly = (
        rents[rents["segment"] == "Apartment"].assign(month=rents["date"].dt.to_period("M"))
        if not rents.empty
        else None
    )
    rent_index = None
    if rent_monthly is not None and not rent_monthly.empty:
        rent_index = (
            rent_monthly.groupby(["month", "area_name", "rooms"], observed=True)["annual_rent"]
            .median()
            .groupby("month")
            .median()
            .reindex(months)
        )
    # The current month is partial; flag it so charts can show it differently.
    partial = as_of.normalize() < (as_of.to_period("M").end_time.normalize())

    weeks = sales[sales["date"] > as_of - pd.Timedelta(weeks=104)]
    weekly = weeks.groupby(pd.Grouper(key="date", freq="W-SUN")).agg(
        deals=("transaction_number", "nunique"), value=("value_share", "sum")
    )

    last12 = priced[priced["date"] > as_of - pd.DateOffset(months=12)]
    rooms = (
        last12.groupby(["segment", "rooms"], observed=True)
        .agg(
            deals=("transaction_number", "nunique"),
            ppsf=("ppsf", "median"),
            price=("actual_worth", "median"),
        )
        .reset_index()
    )

    years = sales[sales["date"] >= "2004-01-01"].groupby(sales["date"].dt.year)
    yearly = pd.DataFrame(
        {
            "deals": years["transaction_number"].nunique(),
            "value": years["value_share"].sum(),
        }
    )

    return {
        "asOf": as_of.strftime("%Y-%m-%d"),
        "pulse": {
            "now": {k: _num(v, 4 if k == "offplan" else 0) for k, v in now.items()},
            "prev": {k: _num(v, 4 if k == "offplan" else 0) for k, v in prev.items()},
            "lastYear": {k: _num(v, 4 if k == "offplan" else 0) for k, v in last_year.items()},
        },
        "monthly": {
            "month": [str(m) for m in months],
            "deals": _nums(deals.fillna(0)),
            "value": _nums(value.fillna(0)),
            "offplanValue": _nums(offplan_value.fillna(0)),
            "offplanShare": _nums(offplan, 4),
            "ppsf": _nums(ppsf),
            "ppsfApartment": _nums(seg.get("Apartment", pd.Series(index=months))),
            "ppsfVilla": _nums(seg.get("Villa", pd.Series(index=months))),
            "index": _nums(index, 1),
            "mortgages": _nums(mortgages.fillna(0)),
            "rentApartment": _nums(rent_index) if rent_index is not None else [],
            "partialLast": bool(partial),
        },
        "weekly": {
            "week": [d.strftime("%Y-%m-%d") for d in weekly.index],
            "deals": _nums(weekly["deals"]),
            "value": _nums(weekly["value"]),
        },
        "yearly": {
            "year": [int(y) for y in yearly.index],
            "deals": _nums(yearly["deals"]),
            "value": _nums(yearly["value"]),
        },
        "rooms": [
            {
                "segment": r.segment,
                "rooms": ROOM_LABELS.get(str(r.rooms), str(r.rooms)),
                "deals": int(r.deals),
                "ppsf": _num(r.ppsf),
                "price": _num(r.price),
            }
            for r in rooms.itertuples()
            if r.deals >= 20
        ],
    }


def build_areas(sales, rents, coords, known_as, as_of):
    priced = sales[sales["priced"]]
    d12, d24, d36 = (as_of - pd.DateOffset(months=m) for m in (12, 24, 36))
    recent24 = priced[priced["date"] > d24]
    counts = recent24.groupby("area_name", observed=True).size()
    areas = counts[counts >= MIN_AREA_SALES].index.astype(str).tolist()
    rents_12m = rents[rents["date"] > d12] if not rents.empty else rents
    sales_12m_priced = priced[priced["date"] > d12]
    all_12m = sales[sales["date"] > d12]
    coords = coords.set_index("area_name")

    yields_all = cell_yields(sales_12m_priced, rents_12m, ["area_name", "segment", "rooms"])

    rows = []
    for area in areas:
        a_sales = sales[sales["area_name"] == area]
        a_priced = priced[priced["area_name"] == area]
        a12 = a_priced[a_priced["date"] > d12]
        a12_all = all_12m[all_12m["area_name"] == area]
        prev12 = a_priced[(a_priced["date"] > d24) & (a_priced["date"] <= d12)]
        keys = ["project", "segment", "rooms"]
        growth_1y = matched_growth(a_priced, d12, as_of, d24, d12, keys)
        growth_3y = matched_growth(
            a_priced, d12, as_of, as_of - pd.DateOffset(months=48), d36, keys
        )
        growth_6m = matched_growth(
            a_priced,
            as_of - pd.DateOffset(months=6),
            as_of,
            d12,
            as_of - pd.DateOffset(months=6),
            keys,
        )
        a_yields = yields_all.loc[area] if area in yields_all.index.get_level_values(0) else None
        gross_yield = _weighted_yield(a_yields) if a_yields is not None else None
        a_rents = rents_12m[rents_12m["area_name"] == area] if not rents_12m.empty else rents_12m
        months = pd.period_range(
            (as_of - pd.DateOffset(months=35)).to_period("M"), as_of.to_period("M")
        )
        spark = a_priced.groupby("month")["ppsf"].median().reindex(months)
        spark = spark.rolling(3, min_periods=1).median()
        segment_mix = a12["segment"].value_counts(normalize=True)
        point = coords.loc[area] if area in coords.index else None
        rows.append(
            {
                "slug": slugify(area),
                "name": area,
                "knownAs": known_as.get(area),
                "lat": _num(point["lat"], 5) if point is not None else None,
                "lng": _num(point["lng"], 5) if point is not None else None,
                "deals12m": int(a12_all["transaction_number"].nunique()),
                "value12m": _num(a12_all["value_share"].sum()),
                "ppsf": _num(_median(a12["ppsf"])),
                "ppsfPrev": _num(_median(prev12["ppsf"])),
                "price": _num(_median(a12["actual_worth"])),
                "growth6m": _num(growth_6m, 4),
                "growth1y": _num(growth_1y, 4),
                "growth3y": _num(growth_3y, 4),
                "yield": _num(gross_yield, 4),
                "rent": _num(_median(a_rents["annual_rent"])) if len(a_rents) else None,
                "offplanShare": _num(a12_all["is_offplan"].mean(), 3) if len(a12_all) else None,
                "villaShare": _num(segment_mix.get("Villa", 0.0), 3),
                "dealsPerMonth": _num(len(a12) / 12, 1),
                "spark": _nums(spark),
                "firstSale": int(a_sales["date"].min().year),
            }
        )
    table = pd.DataFrame(rows)
    # Investor score: percentile blend of yield, momentum, long-run growth and liquidity.
    parts = {"yield": 0.35, "growth1y": 0.25, "growth3y": 0.15, "dealsPerMonth": 0.25}
    score = sum(table[c].rank(pct=True).fillna(0.5) * w for c, w in parts.items())
    table["score"] = (score * 100).round().astype(int)
    return table, yields_all


def build_area_detail(area, row, sales, rents, yields_all, pipeline, neighbours, as_of) -> dict:
    priced = sales[sales["priced"] & (sales["area_name"] == area)]
    a_sales = sales[sales["area_name"] == area]
    d12 = as_of - pd.DateOffset(months=12)

    start = max(pd.Period("2008-01", "M"), priced["month"].min())
    months = pd.period_range(start, as_of.to_period("M"), freq="M")
    g = priced.groupby("month")["ppsf"]
    deals = a_sales.groupby("month")["transaction_number"].nunique().reindex(months).fillna(0)
    offplan = (
        a_sales[a_sales["is_offplan"].fillna(False)]
        .groupby("month")["transaction_number"]
        .nunique()
        .reindex(months)
        .fillna(0)
    )
    series = pd.DataFrame(
        {
            "median": g.median(),
            "p25": g.quantile(0.25),
            "p75": g.quantile(0.75),
            "n": g.size(),
        }
    ).reindex(months)
    thin = series["n"].fillna(0) < 8
    series.loc[thin, ["median", "p25", "p75"]] = np.nan
    smooth = series[["median", "p25", "p75"]].rolling(3, min_periods=1).median()
    index = price_index(priced, ["project", "segment", "rooms"], min_obs=15).reindex(months)

    last12 = priced[priced["date"] > d12]
    rents_12m = (
        rents[(rents["area_name"] == area) & (rents["date"] > d12)] if not rents.empty else rents
    )
    by_rooms = []
    for (segment, rooms), grp in last12.groupby(["segment", "rooms"], observed=True):
        if len(grp) < 5:
            continue
        r = rents_12m[(rents_12m["segment"] == segment) & (rents_12m["rooms"] == rooms)]
        key = (area, segment, rooms)
        y = yields_all.loc[key, "yield"] if key in yields_all.index else None
        by_rooms.append(
            {
                "segment": segment,
                "rooms": ROOM_LABELS.get(str(rooms), str(rooms)),
                "deals": int(len(grp)),
                "price": _num(grp["actual_worth"].median()),
                "ppsf": _num(grp["ppsf"].median()),
                "size": _num(grp["size_sqft"].median()),
                "rent": _num(r["annual_rent"].median()) if len(r) >= 5 else None,
                "yield": _num(y, 4),
                "order": ROOMS.index(str(rooms)) if str(rooms) in ROOMS else 99,
            }
        )
    by_rooms.sort(key=lambda r: (r["segment"], r["order"]))

    projects = []
    for name, grp in last12.dropna(subset=["project"]).groupby("project", observed=True):
        if len(grp) < 5:
            continue
        hist = priced[(priced["project"] == name)]
        growth = matched_growth(
            hist, d12, as_of, as_of - pd.DateOffset(months=24), d12, ["segment", "rooms"], 1
        )
        projects.append(
            {
                "name": str(name),
                "deals": int(len(grp)),
                "ppsf": _num(grp["ppsf"].median()),
                "price": _num(grp["actual_worth"].median()),
                "offplanShare": _num(grp["is_offplan"].mean(), 3),
                "growth1y": _num(growth, 4),
            }
        )
    projects.sort(key=lambda p: -p["deals"])

    recent = priced.sort_values("date", ascending=False).head(60)
    deals_list = [
        {
            "date": r.date.strftime("%Y-%m-%d"),
            "project": None if pd.isna(r.project) else str(r.project),
            "building": None if pd.isna(r.building_name) else str(r.building_name),
            "rooms": ROOM_LABELS.get(str(r.rooms)) if not pd.isna(r.rooms) else None,
            "segment": r.segment,
            "size": _num(r.size_sqft),
            "price": _num(r.actual_worth),
            "ppsf": _num(r.ppsf),
            "offplan": bool(r.is_offplan) if not pd.isna(r.is_offplan) else None,
        }
        for r in recent.itertuples()
    ]

    return {
        **row,
        "series": {
            "month": [str(m) for m in months],
            "median": _nums(smooth["median"]),
            "p25": _nums(smooth["p25"]),
            "p75": _nums(smooth["p75"]),
            "index": _nums(index, 1),
            "deals": _nums(deals),
            "offplanDeals": _nums(offplan),
        },
        "rooms": by_rooms,
        "projects": projects[:30],
        "recent": deals_list,
        "pipeline": pipeline,
        "neighbours": neighbours,
    }


def build_comps(area: str, sales: pd.DataFrame, rents: pd.DataFrame, as_of) -> dict:
    """Recent single-unit sales and rent medians for the valuation tool, column-packed."""
    priced = sales[
        sales["priced"]
        & (sales["area_name"] == area)
        & (sales["date"] > as_of - pd.DateOffset(months=24))
    ]
    projects = sorted(priced["project"].dropna().astype(str).unique())
    buildings = sorted(priced["building_name"].dropna().astype(str).unique())
    p_idx = {p: i for i, p in enumerate(projects)}
    b_idx = {b: i for i, b in enumerate(buildings)}
    epoch = pd.Timestamp("2000-01-01")
    rooms = priced["rooms"].astype("string")
    a_rents = (
        rents[(rents["area_name"] == area) & (rents["date"] > as_of - pd.DateOffset(months=12))]
        if not rents.empty
        else rents
    )
    rent_cells = []
    if not a_rents.empty:
        for keys, grp in a_rents.groupby(
            ["project", "segment", "rooms"], observed=True, dropna=False
        ):
            if len(grp) >= 3:
                project, segment, room = keys
                rent_cells.append(
                    [
                        None if pd.isna(project) else str(project),
                        segment,
                        None if pd.isna(room) else str(room),
                        _num(grp["annual_rent"].median()),
                        int(len(grp)),
                    ]
                )
    return {
        "projects": projects,
        "buildings": buildings,
        "rooms": ROOMS,
        "d": [int((d - epoch).days) for d in priced["date"]],
        "p": [p_idx.get(str(p), -1) if not pd.isna(p) else -1 for p in priced["project"]],
        "b": [b_idx.get(str(b), -1) if not pd.isna(b) else -1 for b in priced["building_name"]],
        "r": [ROOMS.index(r) if isinstance(r, str) and r in ROOMS else -1 for r in rooms],
        "s": [0 if seg == "Apartment" else 1 for seg in priced["segment"]],
        "a": _nums(priced["size_sqft"]),
        "v": _nums(priced["actual_worth"]),
        "o": [1 if o is True else 0 for o in priced["is_offplan"].astype(object)],
        "rents": rent_cells,
    }


def build_pipeline(sales: pd.DataFrame, as_of) -> tuple[dict, pd.DataFrame]:
    """Supply pipeline and developer track record from DLD's projects register."""
    folder = RAW_DIR / "projects"
    files = sorted(folder.glob("*.csv"))
    if not files:
        log.warning("No projects file; run `dre fetch projects developers`")
        return {"byYear": [], "developers": [], "projects": []}, pd.DataFrame()
    projects = pd.read_csv(files[-1], dtype="string")
    dev_files = sorted((RAW_DIR / "developers").glob("*.csv"))
    dev_names = {}
    if dev_files:
        devs = pd.read_csv(dev_files[-1], dtype="string")
        dev_names = dict(
            zip(devs["developer_id"], devs["developer_name_en"].str.title(), strict=True)
        )
    # English project names come from the sales register (projects only list Arabic names).
    english = (
        sales.dropna(subset=["project_number", "project"])
        .assign(project_number=lambda d: d["project_number"].str.replace(r"\.0+$", "", regex=True))
        .groupby("project_number")["project"]
        .agg(lambda s: s.astype(str).mode().iloc[0])
    )
    projects["number"] = projects["project_number"].str.replace(r"\.0+$", "", regex=True)
    projects["name"] = projects["number"].map(english)
    projects["developer"] = projects["developer_id"].map(dev_names)
    projects["developer"] = projects["developer"].str.replace(
        r"\s*(L\.?L\.?C\.?|\(L\.L\.C\)|Llc|L\.L\.C|Co\.?|Fzco|Fze|Pjsc|P\.J\.S\.C)\.?$",
        "",
        regex=True,
    )
    projects["area_name"] = projects["area_name_en"].str.strip()
    for column in ["no_of_units", "no_of_villas", "percent_completed"]:
        projects[column] = pd.to_numeric(projects[column], errors="coerce").fillna(0)
    projects["units"] = projects["no_of_units"] + projects["no_of_villas"]
    for column in ["project_start_date", "project_end_date", "completion_date"]:
        projects[column] = pd.to_datetime(projects[column], errors="coerce")

    upcoming = projects[
        projects["project_status"].isin(
            ["ACTIVE", "NOT_STARTED", "PENDING", "CONDITIONAL_ACTIVATING"]
        )
    ].copy()
    upcoming["expected"] = upcoming["project_end_date"].fillna(upcoming["completion_date"])
    upcoming["year"] = upcoming["expected"].dt.year
    upcoming.loc[upcoming["year"] < as_of.year, "year"] = as_of.year  # overdue: due now
    by_year = (
        upcoming.dropna(subset=["year"])
        .groupby("year")["units"]
        .sum()
        .loc[lambda s: s.index <= as_of.year + 6]
    )
    finished = projects[projects["project_status"] == "FINISHED"].copy()
    # DLD overwrites the planned end date on delivery, so delays can't be measured; build time
    # (start to completion) is the honest track-record measure.
    finished["build_months"] = (
        finished["completion_date"].fillna(finished["project_end_date"])
        - finished["project_start_date"]
    ).dt.days / 30.44
    devs = []
    for developer, grp in projects.dropna(subset=["developer"]).groupby("developer"):
        done = finished[finished["developer"] == developer]
        active = upcoming[upcoming["developer"] == developer]
        if len(grp) < 3:
            continue
        build = done["build_months"].dropna()
        build = build[build.between(3, 180)]
        devs.append(
            {
                "name": developer,
                "projects": int(len(grp)),
                "finished": int(len(done)),
                "active": int(len(active)),
                "unitsDelivered": int(done["units"].sum()),
                "unitsPipeline": int(active["units"].sum()),
                "buildMonths": _num(build.median(), 0) if len(build) >= 2 else None,
                "avgProgress": _num(active["percent_completed"].mean(), 1) if len(active) else None,
            }
        )
    devs.sort(key=lambda d: -(d["unitsDelivered"] + d["unitsPipeline"]))
    upcoming_list = [
        {
            "name": r.name if isinstance(r.name, str) else None,
            "number": r.number,
            "developer": r.developer if isinstance(r.developer, str) else None,
            "area": r.area_name,
            "slug": slugify(r.area_name) if isinstance(r.area_name, str) else None,
            "status": r.project_status,
            "progress": _num(r.percent_completed, 1),
            "units": int(r.units),
            "expected": r.expected.strftime("%Y-%m") if not pd.isna(r.expected) else None,
            "start": r.project_start_date.strftime("%Y-%m")
            if not pd.isna(r.project_start_date)
            else None,
        }
        for r in upcoming.sort_values("units", ascending=False).itertuples()
        if r.units > 0
    ]
    payload = {
        "asOf": as_of.strftime("%Y-%m-%d"),
        "byYear": [{"year": int(y), "units": int(u)} for y, u in by_year.items()],
        "developers": devs[:150],
        "projects": upcoming_list,
        "totals": {
            "units": int(upcoming["units"].sum()),
            "projects": int(len(upcoming)),
            "developers": int(upcoming["developer"].nunique()),
        },
    }
    return payload, upcoming


def build_deals(sales: pd.DataFrame, as_of) -> dict:
    recent = sales[sales["date"] > as_of - pd.Timedelta(days=30)]
    deals = (
        recent.groupby("transaction_number", observed=True)
        .agg(
            date=("date", "max"),
            area=("area_name", "first"),
            project=("project", "first"),
            building=("building_name", "first"),
            type=("property_sub_type", "first"),
            rooms=("rooms", "first"),
            size=("size_sqft", "sum"),
            value=("actual_worth", "first"),
            units=("units_in_transaction", "first"),
            offplan=("is_offplan", "first"),
            procedure=("procedure", "first"),
        )
        .reset_index()
    )

    def pack(frame):
        return [
            {
                "date": r.date.strftime("%Y-%m-%d"),
                "area": str(r.area),
                "slug": slugify(str(r.area)),
                "project": None if pd.isna(r.project) else str(r.project),
                "building": None if pd.isna(r.building) else str(r.building),
                "type": None if pd.isna(r.type) else str(r.type),
                "rooms": ROOM_LABELS.get(str(r.rooms)) if not pd.isna(r.rooms) else None,
                "size": _num(r.size),
                "value": _num(r.value),
                "ppsf": _num(r.value / r.size) if r.size and r.units == 1 else None,
                "units": int(r.units),
                "offplan": bool(r.offplan) if not pd.isna(r.offplan) else None,
            }
            for r in frame.itertuples()
        ]

    top = deals.sort_values("value", ascending=False).head(150)
    latest = deals.sort_values(["date", "value"], ascending=False).head(150)
    return {"asOf": as_of.strftime("%Y-%m-%d"), "top": pack(top), "latest": pack(latest)}


def _neighbours(table: pd.DataFrame, slug: str, k: int = 6) -> list[dict]:
    me = table[table["slug"] == slug].iloc[0]
    if pd.isna(me["lat"]):
        return []
    others = table[(table["slug"] != slug) & table["lat"].notna()].copy()
    others["km"] = np.hypot((others["lat"] - me["lat"]) * 111, (others["lng"] - me["lng"]) * 101)
    return [
        {
            "slug": r.slug,
            "name": r.name,
            "knownAs": r.knownAs,
            "ppsf": r.ppsf,
            "yield": r.yield_,
            "growth1y": r.growth1y,
            "km": round(r.km, 1),
        }
        for r in others.nsmallest(k, "km").rename(columns={"yield": "yield_"}).itertuples()
    ]


def _area_points() -> pd.DataFrame:
    """Area map points: official polygon centres where we have shapes, geocoded points else."""
    coords = pd.read_csv(AREA_COORDINATES_PATH).set_index("area_name")[["lat", "lng"]]
    if BOUNDARIES_PATH.exists():
        from shapely.geometry import shape

        shapes = json.loads(BOUNDARIES_PATH.read_text("utf-8"))
        for feature in shapes["features"]:
            point = shape(feature["geometry"]).representative_point()
            coords.loc[feature["properties"]["area_name"], ["lat", "lng"]] = [point.y, point.x]
    return coords.reset_index()


def build_site() -> None:
    df = load_transactions()
    as_of = df["date"].max().normalize()
    log.info("Building site data as of %s", as_of.date())
    sales = _sales(df)
    rents = _rents()
    coords = _area_points()
    known_as = _known_as(sales, as_of)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    market = build_market(sales, df, rents, as_of)
    _write("market.json", market)
    log.info("market.json")

    table, yields_all = build_areas(sales, rents, coords, known_as, as_of)
    pipeline, upcoming = build_pipeline(sales, as_of)
    _write("pipeline.json", pipeline)
    if not upcoming.empty:
        units_by_area = upcoming.groupby("area_name")["units"].sum()
        table["pipelineUnits"] = table["name"].map(units_by_area).fillna(0).astype(int)
    else:
        table["pipelineUnits"] = 0
    records = table.replace({np.nan: None}).to_dict("records")
    _write("areas.json", {"asOf": market["asOf"], "areas": records})
    log.info("areas.json (%d areas)", len(records))

    for record in records:
        area, slug = record["name"], record["slug"]
        area_pipeline = [p for p in pipeline["projects"] if p["area"] == area][:25]
        detail = build_area_detail(
            area,
            record,
            sales,
            rents,
            yields_all,
            area_pipeline,
            _neighbours(table, slug),
            as_of,
        )
        _write(f"areas/{slug}.json", detail)
        _write(f"comps/{slug}.json", build_comps(area, sales, rents, as_of))
    log.info("area profiles and comps written")

    _write("deals.json", build_deals(sales, as_of))

    projects_12m = (
        sales[sales["priced"] & (sales["date"] > as_of - pd.DateOffset(months=24))]
        .dropna(subset=["project"])
        .groupby(["project", "area_name"], observed=True)
        .size()
        .reset_index(name="n")
        .sort_values("n", ascending=False)
        .drop_duplicates("project")
    )
    profiled = {r["name"] for r in records}
    search = {
        "areas": [[r["slug"], r["name"], r["knownAs"]] for r in records],
        "projects": [
            [str(r.project), slugify(str(r.area_name)), int(r.n)]
            for r in projects_12m.itertuples()
            if str(r.area_name) in profiled and r.n >= 3
        ],
    }
    _write("search.json", search)

    if BOUNDARIES_PATH.exists():
        shapes = json.loads(BOUNDARIES_PATH.read_text("utf-8"))
        slugs = {r["name"]: r["slug"] for r in records}
        for feature in shapes["features"]:
            feature["properties"]["slug"] = slugs.get(feature["properties"]["area_name"])
        _write("areas.geojson", shapes)

    _write(
        "meta.json",
        {
            "asOf": market["asOf"],
            "built": pd.Timestamp.now(tz="Asia/Dubai").strftime("%Y-%m-%d %H:%M"),
            "transactions": int(len(df)),
            "sales": int(len(sales)),
            "leases": int(len(rents)),
            "areas": len(records),
            "firstYear": int(df["date"].min().year),
            "indexBase": INDEX_BASE,
        },
    )
    log.info("Site data written to %s", OUT_DIR)
