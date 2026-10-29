"""WindCast HTTP API. See docs/API.md for the contract."""

from __future__ import annotations

import logging
import time as clock
from datetime import date
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import analysis, config
from .store import Dataset, get_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("windcast")

app = FastAPI(title="WindCast API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


@app.middleware("http")
async def access_log(request: Request, call_next):
    started = clock.perf_counter()
    response = await call_next(request)
    ms = (clock.perf_counter() - started) * 1000
    response.headers["Server-Timing"] = f"app;dur={ms:.1f}"
    log.info("%s %s -> %s in %.1fms", request.method, request.url.path, response.status_code, ms)
    return response


# ---- shared parameters --------------------------------------------------------------

CUTOFF_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
CutoffParam = Annotated[str, Query(pattern=CUTOFF_PATTERN, description="UK time HH:MM on the day before delivery")]


def date_range(
    start: date = config.DELIVERY_START,
    end: date = config.DELIVERY_END,
) -> tuple[date, date]:
    if start > end:
        raise HTTPException(422, "start must be on or before end")
    if start < config.DELIVERY_START or end > config.DELIVERY_END:
        raise HTTPException(422, f"dates must be within {config.DELIVERY_START} and {config.DELIVERY_END}")
    return start, end


DateRange = Annotated[tuple[date, date], Depends(date_range)]


def dataset() -> Dataset:
    return get_dataset()


Data = Annotated[Dataset, Depends(dataset)]


# ---- endpoints ----------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta(ds: Data) -> dict:
    return {
        "delivery_start": config.DELIVERY_START.isoformat(),
        "delivery_end": config.DELIVERY_END.isoformat(),
        "default_cutoff": config.DEFAULT_CUTOFF,
        "max_horizon": config.MAX_HORIZON_H,
        "forecast_versions": ds.forecast_versions,
        "actual_points": len(ds.actuals),
        "source": ds.source,
        "data_note": "Elexon BMRS FUELHH (WIND) and WINDFOR, national level",
    }


@app.get("/api/analysis")
def get_analysis(
    ds: Data,
    rng: DateRange,
    mode: Literal["deadline", "horizon"] = "deadline",
    cutoff: CutoffParam = config.DEFAULT_CUTOFF,
    horizon: Annotated[int, Query(ge=0, le=config.MAX_HORIZON_H)] = 24,
) -> dict:
    return _analysis(ds, rng[0], rng[1], mode, cutoff, horizon)


@lru_cache(maxsize=256)
def _analysis(ds: Dataset, start: date, end: date, mode: str, cutoff: str, horizon: int) -> dict:
    # Results depend only on the (read-only) dataset and the params, so they are safe to cache.
    points = analysis.select_series(ds, start, end, mode, analysis.parse_cutoff(cutoff), horizon)  # type: ignore[arg-type]
    return {
        "params": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "mode": mode,
            "cutoff": cutoff,
            "horizon": horizon,
        },
        "series": [p.to_dict() for p in points],
        "metrics": analysis.error_stats(points),
        "histogram": analysis.histogram(points),
        "by_hour": analysis.by_hour(points),
        "daily": analysis.daily(points),
    }


@app.get("/api/horizon-curve")
def get_horizon_curve(ds: Data, rng: DateRange) -> list[dict]:
    return analysis.horizon_curve(ds, rng[0], rng[1])


@app.get("/api/buying-guide")
def get_buying_guide(
    ds: Data,
    date: date,
    cutoff: CutoffParam = config.DEFAULT_CUTOFF,
    confidence: int = 90,
) -> dict:
    if not config.DELIVERY_START <= date <= config.DELIVERY_END:
        raise HTTPException(422, f"date must be within {config.DELIVERY_START} and {config.DELIVERY_END}")
    if confidence not in config.CONFIDENCE_LEVELS:
        raise HTTPException(422, f"confidence must be one of {list(config.CONFIDENCE_LEVELS)}")
    return analysis.buying_guide(ds, date, analysis.parse_cutoff(cutoff), confidence)
