"""Polygon boundaries for DLD areas, written to ``reference/area_boundaries.geojson``.

DLD's ``area_name`` is (mostly) a Dubai Municipality *community*, e.g. "Marsa Dubai" is
community 392 and "Al Barsha South Fourth" is 681. Dubai Municipality publishes the community
polygons as open data on Dubai Data (data.dubai); the portal needs a login, so we read a public
GeoJSON export of that layer pinned to a fixed commit, and match each DLD name to a community
by a spelling-insensitive key.

Marketing names that DLD also uses ("Dubai Marina", "Jumeirah Village Circle") sit inside a
community that already has its own DLD name, so they are left without a polygon rather than
sharing one. Matching by geocoded point was tried and dropped: the Nominatim points in
``area_coordinates.csv`` are too rough and put parent districts into the wrong sub-community.

Attribution: community boundaries (c) Dubai Municipality, Dubai Data open data.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from collections.abc import Iterable, Mapping
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import httpx
import pandas as pd
from shapely.geometry import mapping, shape

from dubai_re.geocode import load_coordinates
from dubai_re.store import ROOT, TRANSACTIONS_PATH

log = logging.getLogger(__name__)

AREA_BOUNDARIES_PATH = ROOT / "reference" / "area_boundaries.geojson"

SOURCE_ID = "dm-communities"
# Dubai Municipality community layer (222 polygons, WGS84), mirrored from Dubai Data.
SOURCE_URL = (
    "https://raw.githubusercontent.com/martaferreirahuspy/dubai-realestate-gis/"
    "8253feccf199276878259c5db07e2adcd072e099/dubai_communities.geojson"
)
ATTRIBUTION = "Community boundaries © Dubai Municipality (Dubai Data open data)"

_SIMPLIFY_TOLERANCE = 0.0002  # degrees, roughly 20 m
_PRECISION = 5  # decimal places, roughly 1 m
_MIN_SIMILARITY = 0.7  # key matches must also look alike, so "Mira" never lands on "Al Murar"

# DLD names whose spelling is too far from the Dubai Municipality name for the key to catch.
_ALIASES = {
    "Palm Jumeirah": "Nakhlat Jumeira",
    "Palm Deira": "Nakhlat Deira",
    "Island 2": "Jumeira Island 2",
    "Madinat Dubai Almelaheyah": "Madinat Dubai al Melaheyah",
    "Rega Al Buteen": "Riggat al Buteen",
    "Al Dhagaya": "Al Daghaya",
    "Al Eyas": "Aleyas",
    "Saih Aldahal": "Saih al Dahal",
    "Wadi Al Amardi": "Wadi Alamardi",
    "Dubai International Airport": "Dubai Int'l Airport",
}
# Whole-word respellings applied before building the key.
_WORDS = {
    "goze": "qouz",
    "industrial": "ind",
    "jumeirah": "jumeira",
    "umm": "um",
    "first": "1",
    "second": "2",
    "third": "3",
    "fourth": "4",
    "fifth": "5",
    "sixth": "6",
    "seventh": "7",
}


def name_key(name: str) -> str:
    """Spelling-insensitive key: "Al Barshaa South Third" and "Al Barsha South Third" agree.

    Drops "Al", punctuation and vowels, numbers ordinals and collapses doubled letters, which
    absorbs most transliteration differences (Kheeran/Khairan, Thanyah/Thanayah, Nad/Nadd).
    """
    text = re.sub(r"[^a-z0-9 ]", " ", name.lower().replace("'", ""))
    text = re.sub(r"([a-z])(\d)", r"\1 \2", text)
    words = [_WORDS.get(word, word) for word in text.split() if word != "al"]
    key = re.sub(r"[aeiou]", "", "".join(words))
    return re.sub(r"(.)\1+", r"\1", key)


def _similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= _MIN_SIMILARITY


def fetch_communities(url: str = SOURCE_URL) -> list[dict[str, Any]]:
    """Download the community layer and return its GeoJSON features."""
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    features = response.json()["features"]
    log.info("Fetched %d community polygons from %s", len(features), SOURCE_ID)
    return features


def default_area_counts() -> dict[str, int]:
    """Every known DLD area name with its transaction count (0 if only in the geocode cache)."""
    counts = dict.fromkeys(load_coordinates()["area_name"], 0)
    if TRANSACTIONS_PATH.exists():
        areas = pd.read_parquet(TRANSACTIONS_PATH, columns=["area_name"])["area_name"]
        counts.update(areas.value_counts().to_dict())
    return counts


def match_by_name(
    area_names: Iterable[str], communities: list[str], weights: Mapping[str, int] | None = None
) -> dict[str, int]:
    """Map DLD area name -> community index where an alias, the exact name or the key agrees.

    DLD sometimes has two spellings of one community ("Warsan First" and "Al Warsan First");
    the polygon goes to the one with more transactions (then the closer spelling), so no
    polygon is ever shared.
    """
    weights = weights or {}
    exact = {community.casefold(): index for index, community in enumerate(communities)}
    by_key = defaultdict(list)
    for index, community in enumerate(communities):
        by_key[name_key(community)].append(index)

    claims: dict[int, list[tuple[int, int, str]]] = defaultdict(list)
    for name in area_names:
        target = _ALIASES.get(name, name).casefold()
        candidates = by_key.get(name_key(name), [])
        if target in exact:
            index, rank = exact[target], 0
        elif len(candidates) == 1 and _similar(name, communities[candidates[0]]):
            index, rank = candidates[0], 1
        else:
            continue
        claims[index].append((-weights.get(name, 0), rank, name))

    matched = {}
    for index, names in claims.items():
        names.sort()
        if len(names) > 1:
            others = ", ".join(name for *_, name in names[1:])
            log.info("%s: keeping %s, skipping %s", communities[index], names[0][2], others)
        matched[names[0][2]] = index
    return matched


def _simplify(geometry: dict[str, Any]) -> dict[str, Any]:
    """Simplify to ~20 m and round to 5 decimals, falling back to the original if invalid."""
    original = shape(geometry)
    simple = original.simplify(_SIMPLIFY_TOLERANCE, preserve_topology=True)
    if simple.is_empty or not simple.is_valid:
        simple = original
    return json.loads(
        json.dumps(mapping(simple)), parse_float=lambda v: round(float(v), _PRECISION)
    )


def build_boundaries(
    area_names: Iterable[str] | None = None, path: Path = AREA_BOUNDARIES_PATH
) -> dict[str, Any]:
    """Match DLD area names to community polygons and write them as a GeoJSON file."""
    weights = default_area_counts()
    names = sorted(set(area_names) if area_names is not None else weights)
    features = fetch_communities()
    communities = [feature["properties"]["shapeName"] for feature in features]

    matched = match_by_name(names, communities, weights)
    output = [
        {
            "type": "Feature",
            "properties": {"area_name": name, "source": SOURCE_ID, "match": "name"},
            "geometry": _simplify(features[index]["geometry"]),
        }
        for name, index in sorted(matched.items())
    ]

    collection = {"type": "FeatureCollection", "attribution": ATTRIBUTION, "features": output}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), "utf-8")

    unmatched = sorted(set(names) - set(matched))
    log.info(
        "Wrote %d area polygons to %s (%d areas without a polygon)",
        len(output),
        path,
        len(unmatched),
    )
    log.debug("Areas without a polygon: %s", ", ".join(unmatched))
    return collection
