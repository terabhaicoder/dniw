"""Product scope and settings in one place."""

from __future__ import annotations

import os
from datetime import UTC, date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")

# Purchase decisions made in January 2026 -> delivery days 2 Jan .. 1 Feb 2026 (UK dates).
DELIVERY_START = date(2026, 1, 2)
DELIVERY_END = date(2026, 2, 1)

DEFAULT_CUTOFF = "09:00"  # UK time on the day before delivery
MAX_HORIZON_H = 48
HORIZON_CURVE_POINTS = (1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 30, 36, 42, 48)
CONFIDENCE_LEVELS = (50, 80, 90, 95)

# Raw-data window fetched from Elexon. Wide enough for a 48h horizon on the first
# delivery hour and for UK-date/UTC edges on both sides.
ACTUALS_SETTLEMENT_FROM = date(2026, 1, 1)
ACTUALS_SETTLEMENT_TO = date(2026, 2, 2)
FORECAST_PUBLISH_FROM = datetime(2025, 12, 30, 0, 0, tzinfo=UTC)
FORECAST_PUBLISH_TO = datetime(2026, 2, 1, 23, 59, 59, tzinfo=UTC)

SNAPSHOT_PATH = Path(os.environ.get("WINDCAST_SNAPSHOT", Path(__file__).parent / "data" / "snapshot.json.gz"))
# "snapshot" (default; falls back to live if the file is missing) or "live".
DATA_SOURCE = os.environ.get("WINDCAST_DATA_SOURCE", "snapshot").lower()

CORS_ORIGINS = [o for o in os.environ.get("WINDCAST_CORS_ORIGINS", "http://localhost:5173").split(",") if o]
