"""Fetch transactions from the Dubai Land Department open-data gateway.

The gateway backs the "Real estate data" page on dubailand.gov.ae. It needs no API key, but
only serves roughly the last year of transactions; older history comes from the bulk CSV
(see ``bulk.py``).
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import date, timedelta

import httpx
import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)

API_URL = "https://gateway.dubailand.gov.ae/open-data/transactions"
PAGE_SIZE = 5000
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://dubailand.gov.ae",
    "Referer": "https://dubailand.gov.ae/",
    "User-Agent": "dubai-real-estate-dashboard (+https://github.com/alifadl009/Dubai-Real-Estate-App)",
}


def _payload(start: date, end: date, skip: int) -> dict[str, str]:
    return {
        "P_FROM_DATE": start.strftime("%m/%d/%Y"),
        "P_TO_DATE": end.strftime("%m/%d/%Y"),
        "P_GROUP_ID": "",
        "P_IS_OFFPLAN": "",
        "P_IS_FREE_HOLD": "",
        "P_AREA_ID": "",
        "P_USAGE_ID": "",
        "P_PROP_TYPE_ID": "",
        "P_TAKE": str(PAGE_SIZE),
        "P_SKIP": str(skip),
        "P_SORT": "TRANSACTION_NUMBER_ASC",
    }


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, max=60), reraise=True)
def _fetch_page(client: httpx.Client, start: date, end: date, skip: int) -> list[dict]:
    response = client.post(API_URL, json=_payload(start, end, skip))
    response.raise_for_status()
    body = response.json()
    if body.get("validationErrorsList"):
        raise ValueError(f"DLD API rejected the request: {body['validationErrorsList']}")
    return body["response"]["result"] or []


def _month_windows(start: date, end: date) -> Iterator[tuple[date, date]]:
    """Split [start, end] into calendar-month windows so each query stays small."""
    cursor = start
    while cursor <= end:
        next_month = (cursor.replace(day=1) + timedelta(days=32)).replace(day=1)
        yield cursor, min(end, next_month - timedelta(days=1))
        cursor = next_month


def fetch_transactions(start: date, end: date) -> pd.DataFrame:
    """Download every transaction registered between ``start`` and ``end`` (inclusive)."""
    rows: list[dict] = []
    with httpx.Client(headers=HEADERS, timeout=120) as client:
        for window_start, window_end in _month_windows(start, end):
            skip, total = 0, None
            while total is None or skip < total:
                page = _fetch_page(client, window_start, window_end, skip)
                if not page:
                    break
                total = page[0]["TOTAL"]
                rows.extend(page)
                skip += len(page)
            log.info("Fetched %s to %s: %s rows", window_start, window_end, total or 0)
    return pd.DataFrame(rows)
