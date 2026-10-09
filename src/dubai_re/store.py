"""Where the cleaned dataset lives on disk."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("DRE_DATA_DIR", ROOT / "data"))
TRANSACTIONS_PATH = DATA_DIR / "transactions.parquet"
AREA_COORDINATES_PATH = ROOT / "reference" / "area_coordinates.csv"


def load_transactions(path: Path = TRANSACTIONS_PATH) -> pd.DataFrame:
    return pd.read_parquet(path)


def save_transactions(df: pd.DataFrame, path: Path = TRANSACTIONS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    df.to_parquet(tmp, index=False, compression="zstd")
    tmp.replace(path)  # atomic swap so the app never reads a half-written file
    log.info("Saved %s rows to %s", f"{len(df):,}", path)
