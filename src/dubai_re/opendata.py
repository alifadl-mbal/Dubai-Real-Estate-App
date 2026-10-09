"""Download bulk exports from data.dubai (the successor to Dubai Pulse).

Each dataset page offers CSV exports, larger ones split into parts. The page's download
button asks ``dataset-download`` for short-lived signed CDN links; we do the same, no login
needed. Files are saved decompressed under ``data/raw/<name>/``.
"""

from __future__ import annotations

import gzip
import logging
import shutil
from pathlib import Path

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from dubai_re.store import DATA_DIR

log = logging.getLogger(__name__)

_METADATA_URL = "https://data.dubai/o/dda/data-services/dataset-download"
_HEADERS = {"User-Agent": "dubai-real-estate-dashboard (+https://github.com/alifadl009)"}

# data.dubai dataset ids (the number in https://data.dubai/en/l/<id>).
DATASETS = {
    "transactions": 470061,
    "rent_contracts": 468586,
    "projects": 467654,
    "developers": 462802,
    "areas": 465592,
}

RAW_DIR = DATA_DIR / "raw"


@retry(stop=stop_after_attempt(4), wait=wait_exponential(min=2, max=30), reraise=True)
def csv_parts(dataset_id: int) -> list[dict]:
    """Signed links (valid ~10 minutes) for every CSV part of a dataset, oldest export first."""
    response = httpx.get(
        _METADATA_URL,
        params={"datasetId": dataset_id, "page": 1, "pageSize": 100, "sortDir": "desc"},
        headers=_HEADERS,
        timeout=60,
    )
    response.raise_for_status()
    files = [f for m in response.json()["data"]["metadata"] for f in m["files"]]
    parts = [f for f in files if f["file_extension"] == "csv"]
    return sorted(parts, key=lambda f: f["file_name"])


def _save(url: str, target: Path) -> None:
    partial = target.with_suffix(target.suffix + ".part")
    with httpx.stream("GET", url, headers=_HEADERS, timeout=600, follow_redirects=True) as r:
        r.raise_for_status()
        with partial.open("wb") as out:
            for chunk in r.iter_raw(chunk_size=1 << 20):
                out.write(chunk)
    # The CDN serves gzip either as the file itself or as transport encoding; normalise to CSV.
    with partial.open("rb") as f:
        is_gzip = f.read(2) == b"\x1f\x8b"
    if is_gzip:
        with gzip.open(partial, "rb") as src, target.open("wb") as out:
            shutil.copyfileobj(src, out, length=1 << 20)
        partial.unlink()
    else:
        partial.replace(target)


def download(name: str, force: bool = False) -> list[Path]:
    """Download every CSV part of ``name`` (a key of ``DATASETS``); returns the local paths."""
    folder = RAW_DIR / name
    folder.mkdir(parents=True, exist_ok=True)
    paths = []
    for part in csv_parts(DATASETS[name]):
        target = folder / part["file_name"].removesuffix(".gz")
        paths.append(target)
        if target.exists() and not force:
            log.info("Already have %s", target.name)
            continue
        # Links expire after ten minutes, so fetch a fresh one right before each part.
        fresh = next(p for p in csv_parts(DATASETS[name]) if p["file_name"] == part["file_name"])
        log.info("Downloading %s (%.0f MB)", target.name, int(part["file_size"]) / 1e6)
        _save(fresh["file_url"], target)
    # Drop parts from older exports so readers never mix two snapshots.
    for stale in set(folder.glob("*.csv")) - set(paths):
        stale.unlink()
    return paths
