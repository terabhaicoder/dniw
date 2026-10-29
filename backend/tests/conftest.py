from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.store import build_dataset


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def actual_row(start: datetime, mw: float, published: datetime | None = None) -> dict:
    return {"fuelType": "WIND", "startTime": iso(start), "publishTime": iso(published or start), "generation": mw}


def forecast_row(published: datetime, start: datetime, mw: float) -> dict:
    return {"publishTime": iso(published), "startTime": iso(start), "generation": mw}


@pytest.fixture
def small_dataset():
    """Two delivery hours on 2026-01-10 with three forecast versions around the 09:00 cutoff on 01-09."""
    t0, t1 = utc(2026, 1, 10, 0), utc(2026, 1, 10, 1)
    actuals = [actual_row(t0, 1000), actual_row(t1, 2000)]
    forecasts = [
        forecast_row(utc(2026, 1, 9, 3, 30), t0, 900),
        forecast_row(utc(2026, 1, 9, 9, 0), t0, 1100),  # exactly at the cutoff -> allowed
        forecast_row(utc(2026, 1, 9, 9, 30), t0, 1500),  # after the cutoff -> must be ignored
        forecast_row(utc(2026, 1, 9, 3, 30), t1, 2400),
    ]
    return build_dataset(actuals, forecasts, "test")
