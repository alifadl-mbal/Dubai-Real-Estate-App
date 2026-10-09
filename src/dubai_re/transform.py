"""Normalise raw DLD data (live API or bulk CSV) into one tidy schema."""

from __future__ import annotations

import numpy as np
import pandas as pd

# Canonical schema shared by every source. Everything downstream relies on these names.
COLUMNS = [
    "transaction_number",
    "date",
    "trans_group",
    "procedure",
    "usage",
    "property_type",
    "property_sub_type",
    "rooms",
    "is_offplan",
    "is_freehold",
    "area_name",
    "project",
    "project_number",
    "master_project",
    "building_name",
    "nearest_metro",
    "nearest_mall",
    "nearest_landmark",
    "procedure_area",
    "actual_worth",
    "units_in_transaction",
    "value_share",
    "meter_sale_price",
    "source",
]

CATEGORICAL = [
    "trans_group",
    "procedure",
    "usage",
    "property_type",
    "property_sub_type",
    "rooms",
    "area_name",
    "project",
    "master_project",
    "nearest_metro",
    "nearest_mall",
    "nearest_landmark",
    "source",
]

# Room labels drift between sources ("NA", "PENTHOUSE", blanks); map them onto one vocabulary.
ROOMS_ORDER = [
    "Studio",
    "1 B/R",
    "2 B/R",
    "3 B/R",
    "4 B/R",
    "5 B/R",
    "6 B/R",
    "7+ B/R",
    "Penthouse",
]
_ROOM_ALIASES = {"STUDIO": "Studio", "PENTHOUSE": "Penthouse", "SINGLE ROOM": "Studio"}

EARLIEST_DATE = pd.Timestamp("1960-01-01")

_GROUP_ALIASES = {"Mortgages": "Mortgage", "Gift": "Gifts"}
# The API and the bulk export label a few things differently; use the bulk wording, since it
# covers most of the history.
_PROCEDURE_ALIASES = {"Sale": "Sell"}
_USAGE_ALIASES = {"أخرى": "Other"}  # Arabic "Other" in a few bulk rows

# Bulk CSV (Dubai Pulse / data.dubai "Transactions.csv") column → canonical column.
_BULK_COLUMNS = {
    "transaction_id": "transaction_number",
    "instance_date": "date",
    "trans_group_en": "trans_group",
    "procedure_name_en": "procedure",
    "property_usage_en": "usage",
    "property_type_en": "property_type",
    "property_sub_type_en": "property_sub_type",
    "rooms_en": "rooms",
    "reg_type_en": "is_offplan",
    "area_name_en": "area_name",
    "project_name_en": "project",
    "project_number": "project_number",
    "master_project_en": "master_project",
    "building_name_en": "building_name",
    "nearest_metro_en": "nearest_metro",
    "nearest_mall_en": "nearest_mall",
    "nearest_landmark_en": "nearest_landmark",
    "procedure_area": "procedure_area",
    "actual_worth": "actual_worth",
}
BULK_SOURCE_COLUMNS = list(_BULK_COLUMNS)

_API_COLUMNS = {
    "TRANSACTION_NUMBER": "transaction_number",
    "INSTANCE_DATE": "date",
    "GROUP_EN": "trans_group",
    "PROCEDURE_EN": "procedure",
    "USAGE_EN": "usage",
    "PROP_TYPE_EN": "property_type",
    "PROP_SB_TYPE_EN": "property_sub_type",
    "ROOMS_EN": "rooms",
    "IS_OFFPLAN_EN": "is_offplan",
    "IS_FREE_HOLD_EN": "is_freehold",
    "AREA_EN": "area_name",
    "PROJECT_EN": "project",
    "MASTER_PROJECT_EN": "master_project",
    "NEAREST_METRO_EN": "nearest_metro",
    "NEAREST_MALL_EN": "nearest_mall",
    "NEAREST_LANDMARK_EN": "nearest_landmark",
    "PROCEDURE_AREA": "procedure_area",
    "TRANS_VALUE": "actual_worth",
}


def _clean_text(series: pd.Series) -> pd.Series:
    cleaned = series.astype("string").str.strip().str.replace(r"\s+", " ", regex=True)
    return cleaned.mask(cleaned.isin(["", "NA", "N/A", "null", "None"]))


def _title_if_single_case(series: pd.Series) -> pd.Series:
    """'BUSINESS BAY' / 'azizi venice' -> title case; already mixed-case names are kept."""
    single_case = (series.str.isupper() | series.str.islower()).fillna(False)
    series = series.where(~single_case, series.str.title())
    return series.str.replace(r"^AL ", "Al ", regex=True)


def normalise_rooms(series: pd.Series) -> pd.Series:
    rooms = _clean_text(series)
    upper = rooms.str.upper()
    rooms = rooms.where(~upper.isin(_ROOM_ALIASES), upper.map(_ROOM_ALIASES))
    count = pd.to_numeric(rooms.str.extract(r"^(\d+)\s*B/?R", expand=False), errors="coerce")
    rooms = rooms.where(count.isna(), count.map(lambda n: f"{n:.0f} B/R" if n < 7 else "7+ B/R"))
    # Anything left that is not a residential room count (Office, Shop, Hotel...) is not a room.
    return rooms.where(rooms.isin(ROOMS_ORDER))


def _finalise(df: pd.DataFrame, source: str) -> pd.DataFrame:
    for column in COLUMNS:
        if column not in df:
            df[column] = pd.NA

    for column in CATEGORICAL + ["transaction_number", "building_name", "project_number"]:
        if column != "rooms":
            df[column] = _clean_text(df[column])
    for column in ["area_name", "project", "master_project", "building_name"]:
        df[column] = _title_if_single_case(df[column])

    df["trans_group"] = df["trans_group"].replace(_GROUP_ALIASES)
    df["procedure"] = df["procedure"].replace(_PROCEDURE_ALIASES)
    df["usage"] = df["usage"].replace(_USAGE_ALIASES)
    # The API files villas as property type "Building" with sub-type "Villa".
    api_villa = df["property_type"].eq("Building") & df["property_sub_type"].eq("Villa")
    df["property_type"] = df["property_type"].mask(api_villa.fillna(False), "Villa")
    df["rooms"] = normalise_rooms(df["rooms"])
    df["procedure_area"] = pd.to_numeric(df["procedure_area"], errors="coerce")
    df["actual_worth"] = pd.to_numeric(df["actual_worth"], errors="coerce")
    df["is_offplan"] = df["is_offplan"].astype("boolean")
    df["is_freehold"] = df["is_freehold"].astype("boolean")
    df["source"] = source

    df = df.dropna(subset=["date", "actual_worth"])
    # A handful of old records carry Hijri years (1416 = 1995) and can't be placed reliably.
    df = df[df["date"] >= EARLIEST_DATE]
    df = df[df["actual_worth"] > 0]
    df = df.drop_duplicates()

    # Portfolio deals repeat the full deal value on every unit row. Count each deal once for
    # market totals (value_share) and keep only single-unit rows for per-unit prices.
    units = df.groupby("transaction_number")["transaction_number"].transform("size")
    df["units_in_transaction"] = units.fillna(1).astype("int32")
    df["value_share"] = df["actual_worth"] / df["units_in_transaction"]
    single_unit = (df["units_in_transaction"] == 1) & (df["procedure_area"] > 0)
    df["meter_sale_price"] = np.where(
        single_unit, df["actual_worth"] / df["procedure_area"], np.nan
    )

    df = df[COLUMNS].sort_values("date", ignore_index=True)
    for column in CATEGORICAL:
        df[column] = df[column].astype("category")
    df["rooms"] = df["rooms"].cat.set_categories(ROOMS_ORDER, ordered=True)
    return df


def from_api(raw: pd.DataFrame) -> pd.DataFrame:
    """Normalise rows returned by ``ingest.fetch_transactions``."""
    if raw.empty:
        return pd.DataFrame(columns=COLUMNS)
    df = raw.rename(columns=_API_COLUMNS)[list(_API_COLUMNS.values())].copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["is_offplan"] = df["is_offplan"].eq("Off-Plan")
    df["is_freehold"] = df["is_freehold"].eq("Free Hold")
    return _finalise(df, source="api")


def from_bulk(raw: pd.DataFrame) -> pd.DataFrame:
    """Normalise the bulk ``Transactions.csv`` export."""
    df = raw.rename(columns=_BULK_COLUMNS)
    df = df[[c for c in _BULK_COLUMNS.values() if c in df]].copy()
    # data.dubai exports use ISO dates; older Dubai Pulse files were day-first (15-03-2010).
    # Read ISO strictly first so "2020-11-05" is never mistaken for 11 May.
    dates = pd.to_datetime(df["date"], format="ISO8601", errors="coerce")
    other = dates.isna() & df["date"].notna()
    if other.any():
        dates[other] = pd.to_datetime(
            df.loc[other, "date"], format="mixed", dayfirst=True, errors="coerce"
        )
    df["date"] = dates
    df["is_offplan"] = df["is_offplan"].astype("string").str.contains("Off", na=False)
    df["is_freehold"] = pd.NA
    return _finalise(df, source="bulk")


def combine(history: pd.DataFrame, recent: pd.DataFrame) -> pd.DataFrame:
    """Merge two canonical frames, letting ``recent`` win from its first date onwards.

    Bulk and API exports use different transaction-number formats, so we cannot dedupe on
    the number alone; instead one source owns every day it covers. Callers pass only the API
    days the bulk file doesn't cover yet, since the bulk file is richer (building names,
    project numbers).
    """
    if history.empty:
        return recent
    if recent.empty:
        return history
    cutoff = recent["date"].min().normalize()
    merged = pd.concat([history[history["date"] < cutoff], recent], ignore_index=True)
    for column in CATEGORICAL:
        merged[column] = merged[column].astype("category")
    merged["rooms"] = merged["rooms"].cat.set_categories(ROOMS_ORDER, ordered=True)
    return merged.sort_values("date", ignore_index=True)
