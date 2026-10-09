import json
import math

import numpy as np
import pandas as pd
import pytest

from dubai_re import rents, site


def _priced(rows):
    df = pd.DataFrame(rows, columns=["date", "area_name", "project", "segment", "rooms", "ppsf"])
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.to_period("M")
    return df


def test_price_index_ignores_changes_in_what_sells():
    # Two cells whose prices never move. Early months are mostly the cheap cell, later months
    # mostly the expensive one, so a raw median would jump; the index must stay flat.
    rows = []
    for month in pd.period_range("2019-01", "2020-12", freq="M"):
        cheap_share = 0.8 if month < pd.Period("2020-01", "M") else 0.2
        for i in range(100):
            cheap = i < cheap_share * 100
            rows.append(
                [
                    month.to_timestamp(),
                    "A" if cheap else "B",
                    None,
                    "Apartment",
                    "1 B/R",
                    1000.0 if cheap else 3000.0,
                ]
            )
    index = site.price_index(_priced(rows), ["area_name", "segment", "rooms"])
    assert index.max() / index.min() == pytest.approx(1.0, abs=1e-6)
    assert index[pd.Period("2020-01", "M")] == pytest.approx(100)


def test_price_index_tracks_a_uniform_rise():
    rows = []
    for k, month in enumerate(pd.period_range("2019-07", "2020-06", freq="M")):
        for area, base in [("A", 1000.0), ("B", 2000.0)]:
            rows += [[month.to_timestamp(), area, None, "Apartment", "1 B/R", base * 1.01**k]] * 40
    index = site.price_index(_priced(rows), ["area_name", "segment", "rooms"])
    # A 1% monthly rise: three-month smoothing lags it but keeps the slope.
    assert index.iloc[-1] / index.iloc[-2] == pytest.approx(1.01, rel=1e-3)


def test_matched_growth_compares_like_with_like():
    rows = []
    # Project P rises 10%; a new, pricier project Q only sells in the later window.
    rows += [["2024-03-01", "X", "P", "Apartment", "1 B/R", 1000.0]] * 10
    rows += [["2025-03-01", "X", "P", "Apartment", "1 B/R", 1100.0]] * 10
    rows += [["2024-03-01", "X", "R", "Apartment", "2 B/R", 2000.0]] * 10
    rows += [["2025-03-01", "X", "R", "Apartment", "2 B/R", 2200.0]] * 10
    rows += [["2024-03-01", "X", "S", "Apartment", "Studio", 500.0]] * 10
    rows += [["2025-03-01", "X", "S", "Apartment", "Studio", 550.0]] * 10
    rows += [["2025-03-01", "X", "Q", "Apartment", "1 B/R", 5000.0]] * 30
    df = _priced(rows)
    growth = site.matched_growth(
        df,
        pd.Timestamp("2024-12-31"),
        pd.Timestamp("2025-12-31"),
        pd.Timestamp("2023-12-31"),
        pd.Timestamp("2024-12-31"),
        ["project", "segment", "rooms"],
    )
    assert growth == pytest.approx(0.10)


def test_cell_yields_need_both_sides_and_plausible_values():
    sales = pd.DataFrame(
        {
            "area_name": ["A"] * 10 + ["B"] * 10,
            "segment": ["Apartment"] * 20,
            "rooms": ["1 B/R"] * 20,
            "actual_worth": [1_000_000] * 10 + [1_000_000] * 10,
        }
    )
    leases = pd.DataFrame(
        {
            "area_name": ["A"] * 6 + ["B"] * 6,
            "segment": ["Apartment"] * 12,
            "rooms": ["1 B/R"] * 12,
            "annual_rent": [70_000] * 6 + [400_000] * 6,  # B: 40% "yield" is a data error
        }
    )
    cells = site.cell_yields(sales, leases, ["area_name", "segment", "rooms"])
    assert list(cells.index.get_level_values(0)) == ["A"]
    assert cells["yield"].iloc[0] == pytest.approx(0.07)


def test_ejari_room_labels_map_to_sale_labels():
    labels = pd.Series(["Studio", "1bed room+Hall", "2 bed rooms+hall", "9 bed rooms+hall", "Room"])
    assert rents._rooms(labels).tolist()[:4] == ["Studio", "1 B/R", "2 B/R", "7+ B/R"]
    assert pd.isna(rents._rooms(labels).iloc[4])


def test_exported_json_never_contains_nan():
    payload = {"a": float("nan"), "b": [1.0, math.inf, np.float64(2.5)], "c": {"d": np.int64(3)}}
    assert json.loads(json.dumps(site._clean(payload), allow_nan=False)) == {
        "a": None,
        "b": [1.0, None, 2.5],
        "c": {"d": 3},
    }


def test_slugs_are_url_safe():
    assert site.slugify("Al Barsha South Fourth") == "al-barsha-south-fourth"
    assert site.slugify("Al-Souq Al Kabeer (Deira)") == "al-souq-al-kabeer-deira"
