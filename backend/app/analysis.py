"""Forecast selection and accuracy metrics. Pure functions over a `Dataset`.

Error convention everywhere: error = forecast - actual (MW).
A positive error means the forecast was too high, i.e. the buyer would be short of power.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal

from . import config
from .store import Dataset, to_iso

Mode = Literal["deadline", "horizon"]
HOUR = timedelta(hours=1)


@dataclass(frozen=True)
class Point:
    time: datetime
    actual: float | None
    forecast: float | None
    publish_time: datetime | None

    @property
    def error(self) -> float | None:
        if self.actual is None or self.forecast is None:
            return None
        return self.forecast - self.actual

    @property
    def horizon_h(self) -> float | None:
        if self.publish_time is None:
            return None
        return (self.time - self.publish_time).total_seconds() / 3600

    def to_dict(self) -> dict:
        return {
            "time": to_iso(self.time),
            "actual": self.actual,
            "forecast": self.forecast,
            "publish_time": to_iso(self.publish_time) if self.publish_time else None,
            "horizon_h": _round(self.horizon_h, 2),
            "error": self.error,
        }


# ---- time helpers -------------------------------------------------------------------


def uk_date(t: datetime) -> date:
    return t.astimezone(config.UK_TZ).date()


def target_hours(start: date, end: date) -> list[datetime]:
    """Every whole UTC hour whose UK-local date falls in [start, end]. DST-safe:
    we step in UTC, so 23- and 25-hour days come out right."""
    lo = datetime.combine(start, time(0), tzinfo=config.UK_TZ).astimezone(UTC)
    hi = datetime.combine(end + timedelta(days=1), time(0), tzinfo=config.UK_TZ).astimezone(UTC)
    out, t = [], lo
    while t < hi:
        out.append(t)
        t += HOUR
    return out


def deadline_for(target: datetime, cutoff: time) -> datetime:
    """Decision deadline for a target hour: `cutoff` UK time on the day before its UK delivery day."""
    day_before = uk_date(target) - timedelta(days=1)
    return datetime.combine(day_before, cutoff, tzinfo=config.UK_TZ).astimezone(UTC)


def parse_cutoff(value: str) -> time:
    try:
        hh, mm = value.split(":")
        return time(int(hh), int(mm))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"cutoff must be HH:MM, got {value!r}") from exc


# ---- selection ----------------------------------------------------------------------


def select_series(
    ds: Dataset,
    start: date,
    end: date,
    mode: Mode = "deadline",
    cutoff: time = time(9, 0),
    horizon_h: float = 24,
) -> list[Point]:
    """For each target hour pick the latest forecast that was available at decision time.

    deadline: published on/before `cutoff` UK time on the day before delivery.
    horizon : published at least `horizon_h` hours before the target hour.
    """
    points = []
    for t in target_hours(start, end):
        published_by = deadline_for(t, cutoff) if mode == "deadline" else t - timedelta(hours=horizon_h)
        fc = ds.latest_forecast(t, published_by)
        points.append(
            Point(
                time=t,
                actual=ds.actuals.get(t),
                forecast=fc.generation if fc else None,
                publish_time=fc.publish_time if fc else None,
            )
        )
    return points


# ---- metrics ------------------------------------------------------------------------


def percentile(values: list[float], q: float) -> float | None:
    """Linear-interpolated percentile (same as numpy's default), q in [0, 100]."""
    if not values:
        return None
    s = sorted(values)
    pos = (len(s) - 1) * q / 100
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def _round(x: float | None, nd: int = 1) -> float | None:
    return None if x is None else round(x, nd)


def _mean(xs: list[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def error_stats(points: list[Point]) -> dict:
    pairs = [(p.error, p.actual) for p in points if p.error is not None]
    errors = [e for e, _ in pairs]
    n = len(errors)
    mean_actual = _mean([a for _, a in pairs])
    mae = _mean([abs(e) for e in errors])
    rmse = math.sqrt(_mean([e * e for e in errors])) if n else None
    nmae = mae / mean_actual * 100 if mae is not None and mean_actual else None
    with_fc = sum(1 for p in points if p.forecast is not None)
    return {
        "count": n,
        "mae": _round(mae),
        "rmse": _round(rmse),
        "bias": _round(_mean(errors)),
        "nmae_pct": _round(nmae, 2),
        "mean_actual": _round(mean_actual),
        "p10": _round(percentile(errors, 10)),
        "p50": _round(percentile(errors, 50)),
        "p90": _round(percentile(errors, 90)),
        "max_over": _round(max(errors)) if n else None,
        "max_under": _round(min(errors)) if n else None,
        "coverage_pct": _round(with_fc / len(points) * 100, 2) if points else None,
    }


def histogram(points: list[Point], bin_mw: float = 500) -> list[dict]:
    errors = [p.error for p in points if p.error is not None]
    if not errors:
        return []
    first = math.floor(min(errors) / bin_mw)
    last = math.floor(max(errors) / bin_mw)
    counts = [0] * (last - first + 1)
    for e in errors:
        counts[math.floor(e / bin_mw) - first] += 1
    return [
        {"bin_start": (first + i) * bin_mw, "bin_end": (first + i + 1) * bin_mw, "count": c}
        for i, c in enumerate(counts)
    ]


def by_hour(points: list[Point]) -> list[dict]:
    buckets: dict[int, list[float]] = {h: [] for h in range(24)}
    for p in points:
        if p.error is not None:
            buckets[p.time.astimezone(config.UK_TZ).hour].append(p.error)
    return [
        {"hour": h, "mae": _round(_mean([abs(e) for e in es])), "bias": _round(_mean(es)), "count": len(es)}
        for h, es in buckets.items()
    ]


def daily(points: list[Point]) -> list[dict]:
    days: dict[date, list[Point]] = {}
    for p in points:
        days.setdefault(uk_date(p.time), []).append(p)
    out = []
    for d, ps in sorted(days.items()):
        errs = [p.error for p in ps if p.error is not None]
        out.append(
            {
                "date": d.isoformat(),
                "mae": _round(_mean([abs(e) for e in errs])),
                "bias": _round(_mean(errs)),
                "actual_mean": _round(_mean([p.actual for p in ps if p.actual is not None])),
                "forecast_mean": _round(_mean([p.forecast for p in ps if p.forecast is not None])),
                "count": len(errs),
            }
        )
    return out


def horizon_curve(ds: Dataset, start: date, end: date, horizons=config.HORIZON_CURVE_POINTS) -> list[dict]:
    out = []
    for h in horizons:
        s = error_stats(select_series(ds, start, end, mode="horizon", horizon_h=h))
        out.append({"horizon_h": h, "mae": s["mae"], "rmse": s["rmse"], "bias": s["bias"], "count": s["count"]})
    return out


def buying_guide(ds: Dataset, day: date, cutoff: time, confidence: int) -> dict:
    """Safe wind level for one delivery day.

    The margin is the `confidence` percentile of forecast error, learned from every *other*
    delivery day in scope at the same cutoff (so the day's own outcome cannot leak in).
    With roughly `confidence`% probability actual >= forecast - margin.
    """
    history = select_series(ds, config.DELIVERY_START, config.DELIVERY_END, "deadline", cutoff)
    errors = [p.error for p in history if p.error is not None and uk_date(p.time) != day]
    margin = percentile(errors, confidence)
    hours = []
    for p in select_series(ds, day, day, "deadline", cutoff):
        safe = max(0.0, p.forecast - margin) if p.forecast is not None and margin is not None else None
        hours.append(
            {
                "time": to_iso(p.time),
                "forecast": p.forecast,
                "safe_wind": _round(safe),
                "actual": p.actual,
                "publish_time": to_iso(p.publish_time) if p.publish_time else None,
            }
        )

    def total(key: str) -> float | None:
        vals = [h[key] for h in hours if h[key] is not None]
        return _round(sum(vals)) if vals else None  # hourly MW values -> MWh

    return {
        "date": day.isoformat(),
        "cutoff": cutoff.strftime("%H:%M"),
        "confidence": confidence,
        "margin_mw": _round(margin),
        "hours": hours,
        "totals": {"forecast_mwh": total("forecast"), "safe_mwh": total("safe_wind"), "actual_mwh": total("actual")},
    }
