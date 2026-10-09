"""Residential rents from DLD's Ejari rent-contract export, tidied for yield analysis.

The export is large (about 5 GB across parts), so each part is read with only the columns we
need and filtered straight away. Only *new* single-property residential leases are kept:
renewals are capped by the RERA rent index, so they lag the market.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from dubai_re.opendata import RAW_DIR
from dubai_re.store import DATA_DIR
from dubai_re.transform import _clean_text, _title_if_single_case

log = logging.getLogger(__name__)

RENTS_PATH = DATA_DIR / "rents.parquet"

_COLUMNS = {
    "contract_start_date": "date",
    "area_name_en": "area_name",
    "project_name_en": "project",
    "master_project_en": "master_project",
    "ejari_property_type_en": "property_type",
    "ejari_property_sub_type_en": "sub_type",
    "actual_area": "size_sqm",
    "annual_amount": "annual_rent",
    "contract_reg_type_en": "reg_type",
    "property_usage_en": "usage",
    "no_of_prop": "units",
}
# Ejari property types mapped onto the sale-side sub-types used everywhere else.
_TYPES = {
    "Flat": "Flat",
    "Studio": "Flat",
    "Villa": "Villa",
    "Complex Villas": "Villa",
}


def _rooms(sub_type: pd.Series) -> pd.Series:
    """'2 bed rooms+hall' -> '2 B/R', 'Studio' -> 'Studio', '9 bed rooms+hall' -> '7+ B/R'."""
    count = pd.to_numeric(sub_type.str.extract(r"^(\d+)\s*bed", expand=False), errors="coerce")
    rooms = count.map(lambda n: f"{n:.0f} B/R" if n < 7 else "7+ B/R", na_action="ignore")
    rooms = rooms.where(count.notna(), sub_type.where(sub_type.isin(["Studio", "Penthouse"])))
    return rooms.astype("string")


def _read_part(path: Path, since: pd.Timestamp) -> pd.DataFrame:
    raw = pd.read_csv(path, usecols=list(_COLUMNS), dtype="string", engine="pyarrow")
    df = raw.rename(columns=_COLUMNS)
    df["date"] = pd.to_datetime(df["date"], format="ISO8601", errors="coerce")
    keep = (
        (df["date"] >= since)
        & (df["date"] <= pd.Timestamp.today())
        & df["usage"].eq("Residential")
        & df["reg_type"].eq("New")
        & df["units"].eq("1")
        & df["property_type"].isin(list(_TYPES))
    )
    df = df[keep.fillna(False)].copy()
    df["property_sub_type"] = df["property_type"].map(_TYPES)
    df["rooms"] = _rooms(df["sub_type"]).where(df["property_type"] != "Studio", "Studio")
    df["size_sqm"] = pd.to_numeric(df["size_sqm"], errors="coerce")
    df["annual_rent"] = pd.to_numeric(df["annual_rent"], errors="coerce")
    for column in ["area_name", "project", "master_project"]:
        df[column] = _title_if_single_case(_clean_text(df[column]))
    return df[
        [
            "date",
            "area_name",
            "project",
            "master_project",
            "property_sub_type",
            "rooms",
            "size_sqm",
            "annual_rent",
        ]
    ]


def build_rents(years: int = 3) -> pd.DataFrame:
    """Read every downloaded rent-contract part and save the tidy rents table."""
    parts = sorted((RAW_DIR / "rent_contracts").glob("*.csv"))
    if not parts:
        raise FileNotFoundError("No rent contracts downloaded; run `dre fetch rent_contracts`")
    since = pd.Timestamp.today().normalize() - pd.DateOffset(years=years)
    frames = []
    for path in parts:
        log.info("Reading %s", path.name)
        frames.append(_read_part(path, since))
    rents = pd.concat(frames, ignore_index=True)
    # Drop obvious data-entry errors: rents outside AED 5k-5M a year or sizes under 15 sqm.
    rents = rents[rents["annual_rent"].between(5_000, 5_000_000)]
    rents = rents[rents["size_sqm"].isna() | (rents["size_sqm"] >= 15)]
    rents = rents.sort_values("date", ignore_index=True)
    for column in ["area_name", "project", "master_project", "property_sub_type", "rooms"]:
        rents[column] = rents[column].astype("category")
    RENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    rents.to_parquet(RENTS_PATH, index=False)
    log.info("Saved %s new leases to %s", f"{len(rents):,}", RENTS_PATH)
    return rents
