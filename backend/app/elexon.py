"""Thin client for the Elexon BMRS Insights API (no API key needed).

Only the two datasets this product uses are wrapped:
- FUELHH  : half-hourly outturn generation by fuel type (we keep WIND)
- WINDFOR : national wind generation forecasts, re-published several times a day
"""

from __future__ import annotations

from datetime import date, datetime

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_wind_actuals(settlement_from: date, settlement_to: date, client: httpx.Client | None = None) -> list[dict]:
    """Return raw FUELHH rows for fuelType=WIND between two settlement dates (inclusive)."""
    params = {
        "settlementDateFrom": settlement_from.isoformat(),
        "settlementDateTo": settlement_to.isoformat(),
        "fuelType": "WIND",
    }
    return _get("FUELHH/stream", params, client)


def fetch_wind_forecasts(
    publish_from: datetime, publish_to: datetime, client: httpx.Client | None = None
) -> list[dict]:
    """Return raw WINDFOR rows published between two UTC instants (inclusive)."""
    params = {"publishDateTimeFrom": _iso(publish_from), "publishDateTimeTo": _iso(publish_to)}
    return _get("WINDFOR/stream", params, client)


def _get(path: str, params: dict, client: httpx.Client | None) -> list[dict]:
    own = client is None
    client = client or httpx.Client(timeout=TIMEOUT)
    try:
        resp = client.get(f"{BASE_URL}/{path}", params=params)
        resp.raise_for_status()
        rows = resp.json()
    finally:
        if own:
            client.close()
    if not isinstance(rows, list):
        raise ValueError(f"Unexpected Elexon response for {path}: {type(rows).__name__}")
    return rows
