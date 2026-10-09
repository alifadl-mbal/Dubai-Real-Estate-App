import pandas as pd

from dubai_re import transform
from tests.conftest import api_rows


def test_api_rows_map_to_canonical_schema():
    df = transform.from_api(api_rows(50))
    assert list(df.columns) == transform.COLUMNS
    assert df["date"].is_monotonic_increasing
    assert set(df["source"]) == {"api"}


def test_names_and_rooms_are_normalised():
    df = transform.from_api(api_rows(200))
    assert "Business Bay" in set(df["area_name"])
    assert "Al Barsha First" in set(df["area_name"])
    assert "Marsa Dubai" in set(df["area_name"])  # mixed case left alone
    assert set(df["rooms"].dropna()) <= set(transform.ROOMS_ORDER)
    assert "Penthouse" in set(df["rooms"])
    assert df["rooms"].isna().any()  # "NA" becomes missing, not a room type


def test_rooms_above_six_bedrooms_are_grouped():
    rooms = transform.normalise_rooms(pd.Series(["7 B/R", "9 B/R", "2 B/R", "Office", "studio"]))
    assert rooms.tolist()[:3] == ["7+ B/R", "7+ B/R", "2 B/R"]
    assert pd.isna(rooms.iloc[3])
    assert rooms.iloc[4] == "Studio"


def test_portfolio_deals_are_counted_once():
    raw = api_rows(3)
    raw["TRANSACTION_NUMBER"] = "101-10-2026"  # three units, one deal
    raw["TRANS_VALUE"] = 3_000_000
    df = transform.from_api(raw)
    assert df["units_in_transaction"].eq(3).all()
    assert df["value_share"].sum() == 3_000_000
    assert df["meter_sale_price"].isna().all()  # unit price unknown for a portfolio deal


def test_exact_duplicate_rows_are_dropped():
    raw = api_rows(5)
    df = transform.from_api(pd.concat([raw, raw.iloc[[0]]]))
    assert len(df) == 5


def test_bulk_file_maps_to_canonical_schema():
    bulk = pd.DataFrame(
        {
            "transaction_id": ["1-1-2010", "1-2-2010"],
            "instance_date": ["15-03-2010", "16-03-2010"],
            "trans_group_en": ["Sales", "Mortgages"],
            "procedure_name_en": ["Sell", "Mortgage Registration"],
            "property_usage_en": ["Residential"] * 2,
            "property_type_en": ["Unit"] * 2,
            "property_sub_type_en": ["Flat"] * 2,
            "rooms_en": ["1 B/R", "Studio"],
            "reg_type_en": ["Off-Plan Properties", "Existing Properties"],
            "area_name_en": ["Business Bay"] * 2,
            "building_name_en": ["Tower A", None],
            "procedure_area": ["80", "40"],
            "actual_worth": ["1000000", "500000"],
        }
    )
    df = transform.from_bulk(bulk)
    assert df["date"].tolist() == [pd.Timestamp("2010-03-15"), pd.Timestamp("2010-03-16")]
    assert df["trans_group"].tolist() == ["Sales", "Mortgage"]
    assert df["is_offplan"].tolist() == [True, False]
    assert df["meter_sale_price"].iloc[0] == 12_500


def test_bulk_iso_dates_are_not_read_day_first():
    bulk = pd.DataFrame(
        {
            "transaction_id": ["1-102-2020-1", "1-102-2010-2"],
            "instance_date": ["2020-11-05", "05-11-2010"],
            "trans_group_en": ["Sales"] * 2,
            "reg_type_en": ["Existing Properties"] * 2,
            "actual_worth": ["1000000"] * 2,
        }
    )
    df = transform.from_bulk(bulk)
    assert df["date"].tolist() == [pd.Timestamp("2010-11-05"), pd.Timestamp("2020-11-05")]


def test_combine_prefers_recent_source_where_dates_overlap():
    history = transform.from_api(api_rows(100, seed=1)).assign(source="bulk")
    recent = transform.from_api(api_rows(100, seed=2))
    cutoff = recent["date"].min().normalize()
    merged = transform.combine(history, recent)
    assert (merged.loc[merged["source"] == "bulk", "date"] < cutoff).all()
    assert (merged["source"] == "api").sum() == len(recent)


def test_geocoding_falls_back_to_common_spellings_and_parent_district():
    from dubai_re.geocode import candidate_queries

    queries = candidate_queries("Jabal Ali First")
    assert queries[0].startswith("Jabal Ali First,")
    assert queries[1].startswith("Jebel Ali First,")
    assert queries[2].startswith("Jebel Ali,")
    assert candidate_queries("Al Yelayiss 1")[-1].startswith("Al Yalayis,")
    assert len(candidate_queries("Business Bay")) == 1


def test_api_labels_match_bulk_wording():
    raw = api_rows(4)
    raw["PROP_TYPE_EN"] = ["Building", "Building", "Unit", "Land"]
    raw["PROP_SB_TYPE_EN"] = ["Villa", None, "Flat", None]
    raw["PROCEDURE_EN"] = "Sale"
    df = transform.from_api(raw).sort_values("transaction_number")
    assert set(df["property_type"]) == {"Villa", "Building", "Unit", "Land"}
    assert (df.loc[df["property_sub_type"] == "Villa", "property_type"] == "Villa").all()
    assert set(df["procedure"]) == {"Sell"}
