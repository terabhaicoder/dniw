"""Download the January 2026 wind data from Elexon and save it as the app's snapshot.

Usage (from backend/):  python -m scripts.fetch_snapshot
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config, store  # noqa: E402


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.info("Fetching actuals and forecasts from Elexon (forecasts can take ~1 minute)...")
    actuals, forecasts = store.fetch_live()
    store.write_snapshot(config.SNAPSHOT_PATH, actuals, forecasts)
    ds = store.build_dataset(actuals, forecasts, "snapshot")
    logging.info(
        "Saved %s: %d actual rows, %d forecast rows -> %d actual points, %d forecast versions",
        config.SNAPSHOT_PATH,
        len(actuals),
        len(forecasts),
        len(ds.actuals),
        ds.forecast_versions,
    )


if __name__ == "__main__":
    main()
