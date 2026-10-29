"""Loading, cleaning and indexing the wind data.

Raw Elexon rows are cleaned once into a `Dataset`:
- actuals: one value per half-hour start time (latest publication wins)
- forecasts: for each target hour, all forecast versions sorted by publish time,
  so "latest forecast published on or before T" is a binary search.
"""

from __future__ import annotations

import bisect
import gzip
import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from . import config, elexon

log = logging.getLogger(__name__)


def parse_utc(value: str) -> datetime:
    """Parse an Elexon timestamp ('2026-01-01T07:30:00Z') into an aware UTC datetime."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class ForecastVersion:
    publish_time: datetime
    generation: float


@dataclass(eq=False)  # identity hash: lets results be cached per loaded dataset
class Dataset:
    actuals: dict[datetime, float]
    # target start time -> versions sorted by publish_time ascending
    forecasts: dict[datetime, list[ForecastVersion]]
    source: str = "snapshot"
    _publish_index: dict[datetime, list[datetime]] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self._publish_index = {t: [v.publish_time for v in vs] for t, vs in self.forecasts.items()}

    @property
    def forecast_versions(self) -> int:
        return len({v.publish_time for vs in self.forecasts.values() for v in vs})

    def latest_forecast(self, target: datetime, published_by: datetime) -> ForecastVersion | None:
        """Latest forecast for `target` with publish_time <= published_by, or None."""
        times = self._publish_index.get(target)
        if not times:
            return None
        i = bisect.bisect_right(times, published_by)
        return self.forecasts[target][i - 1] if i else None


def clean_actuals(rows: list[dict]) -> dict[datetime, float]:
    best: dict[datetime, tuple[datetime, float]] = {}
    for r in rows:
        if r.get("fuelType") != "WIND" or r.get("generation") is None:
            continue
        start, pub = parse_utc(r["startTime"]), parse_utc(r.get("publishTime") or r["startTime"])
        if start not in best or pub >= best[start][0]:
            best[start] = (pub, float(r["generation"]))
    return {t: g for t, (_, g) in best.items()}


def clean_forecasts(rows: list[dict]) -> dict[datetime, list[ForecastVersion]]:
    """Group forecasts by target time. Rows whose target is before their publish time
    (i.e. not a forecast at all) are dropped; duplicate (publish, target) pairs keep the last."""
    dedup: dict[tuple[datetime, datetime], float] = {}
    for r in rows:
        if r.get("generation") is None:
            continue
        pub, start = parse_utc(r["publishTime"]), parse_utc(r["startTime"])
        if start < pub:
            continue
        dedup[(start, pub)] = float(r["generation"])
    out: dict[datetime, list[ForecastVersion]] = {}
    for (start, pub), gen in dedup.items():
        out.setdefault(start, []).append(ForecastVersion(pub, gen))
    for versions in out.values():
        versions.sort(key=lambda v: v.publish_time)
    return out


def build_dataset(actual_rows: list[dict], forecast_rows: list[dict], source: str) -> Dataset:
    return Dataset(actuals=clean_actuals(actual_rows), forecasts=clean_forecasts(forecast_rows), source=source)


# ---- snapshot I/O --------------------------------------------------------------------


def write_snapshot(path: Path, actual_rows: list[dict], forecast_rows: list[dict]) -> None:
    """Store only the fields we use, in a compact gzipped JSON file."""
    payload = {
        "fetched_at": to_iso(datetime.now(UTC)),
        "actuals": [
            [r["startTime"], r.get("publishTime"), r["generation"]] for r in actual_rows if r.get("fuelType") == "WIND"
        ],
        "forecasts": [[r["publishTime"], r["startTime"], r["generation"]] for r in forecast_rows],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))


def read_snapshot(path: Path) -> tuple[list[dict], list[dict]]:
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        payload = json.load(fh)
    actuals = [
        {"startTime": s, "publishTime": p, "generation": g, "fuelType": "WIND"} for s, p, g in payload["actuals"]
    ]
    forecasts = [{"publishTime": p, "startTime": s, "generation": g} for p, s, g in payload["forecasts"]]
    return actuals, forecasts


def fetch_live() -> tuple[list[dict], list[dict]]:
    actuals = elexon.fetch_wind_actuals(config.ACTUALS_SETTLEMENT_FROM, config.ACTUALS_SETTLEMENT_TO)
    forecasts = elexon.fetch_wind_forecasts(config.FORECAST_PUBLISH_FROM, config.FORECAST_PUBLISH_TO)
    return actuals, forecasts


@lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    """Process-wide dataset. Snapshot first (fast, reproducible); live Elexon as fallback."""
    if config.DATA_SOURCE != "live" and config.SNAPSHOT_PATH.exists():
        actuals, forecasts = read_snapshot(config.SNAPSHOT_PATH)
        source = "snapshot"
    else:
        log.warning("Loading data live from Elexon (slow: the forecast stream is large)")
        actuals, forecasts = fetch_live()
        source = "live"
    ds = build_dataset(actuals, forecasts, source)
    log.info("Loaded %d actual points and %d forecast versions (%s)", len(ds.actuals), ds.forecast_versions, source)
    return ds
