import os
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Point the app at a throwaway data directory before dubai_re.store is imported anywhere.
DATA_DIR = Path(tempfile.mkdtemp(prefix="dre-test-"))
os.environ["DRE_DATA_DIR"] = str(DATA_DIR)
os.environ.pop("DRE_DATA_URL", None)


def api_rows(n: int = 400, seed: int = 0) -> pd.DataFrame:
    """Synthetic rows shaped like the DLD open-data API response."""
    rng = np.random.default_rng(seed)
    dates = pd.Timestamp("2026-01-01") + pd.to_timedelta(rng.integers(0, 280, n), unit="D")
    rooms = rng.choice(["Studio", "1 B/R", "2 B/R", "3 B/R", "NA", "PENTHOUSE"], n)
    area = rng.choice(["BUSINESS BAY", "Marsa Dubai", "AL BARSHA FIRST"], n)
    size = rng.uniform(35, 250, n).round(2)
    return pd.DataFrame(
        {
            "TRANSACTION_NUMBER": [f"102-{i}-2026" for i in range(n)],
            "INSTANCE_DATE": dates.strftime("%Y-%m-%dT%H:%M:%S"),
            "GROUP_EN": rng.choice(["Sales", "Mortgage"], n, p=[0.8, 0.2]),
            "PROCEDURE_EN": "Sale",
            "USAGE_EN": "Residential",
            "PROP_TYPE_EN": "Unit",
            "PROP_SB_TYPE_EN": rng.choice(["Flat", "Villa"], n, p=[0.85, 0.15]),
            "ROOMS_EN": rooms,
            "IS_OFFPLAN_EN": rng.choice(["Off-Plan", "Ready"], n),
            "IS_FREE_HOLD_EN": "Free Hold",
            "AREA_EN": area,
            "PROJECT_EN": rng.choice(["Project A", "PROJECT B", None], n),
            "MASTER_PROJECT_EN": None,
            "NEAREST_METRO_EN": "Business Bay",
            "NEAREST_MALL_EN": "Dubai Mall",
            "NEAREST_LANDMARK_EN": "Burj Khalifa",
            "PROCEDURE_AREA": size,
            "TRANS_VALUE": (size * rng.uniform(12_000, 25_000, n)).round(2),
        }
    )


@pytest.fixture(scope="session")
def dataset():
    from dubai_re import store, transform

    df = transform.from_api(api_rows())
    store.save_transactions(df)
    return df
