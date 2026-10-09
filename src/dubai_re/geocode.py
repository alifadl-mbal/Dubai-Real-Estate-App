"""Look up a map point for every DLD area name, cached in ``reference/area_coordinates.csv``.

Geocoding is per *area* (a few hundred names), not per transaction, so it is cheap to run
and the result is small enough to commit. Uses OpenStreetMap Nominatim: free, keyless, and
limited to one request per second. Areas with an official boundary shape use its centre
instead (see ``site._area_points``); these points cover the rest.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Iterable

import httpx
import pandas as pd

from dubai_re.store import AREA_COORDINATES_PATH

log = logging.getLogger(__name__)

# Rough bounding box of the Emirate of Dubai; anything outside it is a bad match.
_LAT_RANGE = (24.6, 25.45)
_LNG_RANGE = (54.85, 56.0)
_USER_AGENT = "dubai-real-estate-dashboard (+https://github.com/alifadl009/Dubai-Real-Estate-App)"


# DLD spellings that differ from the names map providers know.
_SPELLINGS = {
    "Jabal Ali": "Jebel Ali",
    "Al Yelayiss": "Al Yalayis",
    "Al Barshaa": "Al Barsha",
    "Down Town": "Downtown",
    "Madinat Dubai Almelaheyah": "Dubai Maritime City",
    "Al Merkadh": "Mohammed Bin Rashid City",
    "Marsa Dubai": "Dubai Marina",
    "Ph ": "Phase ",
}
# Numbered sub-zones ("Al Hebiah Fifth", "Al Yelayiss 1") fall back to the parent district.
_SUBZONE = re.compile(
    r"\s+(First|Second|Third|Fourth|Fifth|Sixth|\d+|Ph(ase)?\s*[\d&\s]+)$", re.IGNORECASE
)


def candidate_queries(name: str) -> list[str]:
    """Queries to try in order, from the exact DLD name to looser fallbacks."""
    respelled = name
    for dld, common in _SPELLINGS.items():
        respelled = respelled.replace(dld, common)
    names = [name, respelled, _SUBZONE.sub("", respelled)]
    return [f"{n}, Dubai, United Arab Emirates" for n in dict.fromkeys(names) if n]


def _in_dubai(lat: float, lng: float) -> bool:
    return _LAT_RANGE[0] <= lat <= _LAT_RANGE[1] and _LNG_RANGE[0] <= lng <= _LNG_RANGE[1]


def _nominatim(client: httpx.Client, query: str) -> tuple[float, float] | None:
    time.sleep(1.1)  # Nominatim usage policy: max 1 request per second
    response = client.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "ae"},
    )
    response.raise_for_status()
    results = response.json()
    if not results:
        return None
    return float(results[0]["lat"]), float(results[0]["lon"])


def load_coordinates() -> pd.DataFrame:
    if AREA_COORDINATES_PATH.exists():
        return pd.read_csv(AREA_COORDINATES_PATH)
    return pd.DataFrame(columns=["area_name", "lat", "lng", "provider"])


def geocode_areas(area_names: Iterable[str]) -> pd.DataFrame:
    """Geocode any area not already cached and return the full lookup table."""
    cached = load_coordinates()
    missing = sorted(set(area_names) - set(cached["area_name"]))
    if not missing:
        log.info("All areas already geocoded")
        return cached

    provider = "nominatim"
    log.info("Geocoding %d new areas with OpenStreetMap", len(missing))

    found = []
    with httpx.Client(headers={"User-Agent": _USER_AGENT}, timeout=30) as client:
        for name in missing:
            point = None
            for query in candidate_queries(name):
                try:
                    point = _nominatim(client, query)
                except httpx.HTTPError as exc:
                    log.warning("Geocoding failed for %s: %s", query, exc)
                if point and _in_dubai(*point):
                    break
                point = None
            if point:
                found.append(
                    {"area_name": name, "lat": point[0], "lng": point[1], "provider": provider}
                )
            else:
                log.info("No match inside Dubai for %s", name)

    result = pd.concat([cached, pd.DataFrame(found)], ignore_index=True)
    result = result.sort_values("area_name", ignore_index=True)
    AREA_COORDINATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(AREA_COORDINATES_PATH, index=False, float_format="%.6f")
    log.info("Geocoded %d of %d new areas", len(found), len(missing))
    return result
