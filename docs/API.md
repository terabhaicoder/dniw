# WindCast API contract

Base path: `/api`. All times are ISO-8601 UTC strings ending in `Z`. All power values are MW.
Delivery days are UK local dates (Europe/London).

**Error convention:** `error = forecast - actual` (MW).
Positive error = forecast was too high (over-forecast) = utility would be *short* of power.

## Common query parameters (analysis endpoints)

| name | type | default | notes |
|---|---|---|---|
| `start` | `YYYY-MM-DD` | `2026-01-02` | first delivery day (inclusive, UK date) |
| `end` | `YYYY-MM-DD` | `2026-02-01` | last delivery day (inclusive, UK date) |
| `mode` | `deadline` \| `horizon` | `deadline` | how the forecast is chosen for each target hour |
| `cutoff` | `HH:MM` | `09:00` | deadline mode: latest forecast published on or before this UK time on the day **before** delivery |
| `horizon` | int 0–48 | `24` | horizon mode: latest forecast published at least this many hours before the target time |

Invalid input -> HTTP 422 with FastAPI's standard `{"detail": ...}` body.

## `GET /api/health`
`{"status": "ok"}`

## `GET /api/meta`
```json
{
  "delivery_start": "2026-01-02",
  "delivery_end": "2026-02-01",
  "default_cutoff": "09:00",
  "max_horizon": 48,
  "forecast_versions": 272,
  "actual_points": 1584,
  "source": "snapshot",
  "data_note": "Elexon BMRS FUELHH (WIND) and WINDFOR, national level"
}
```

## `GET /api/analysis`
Params: common params.
```json
{
  "params": {"start": "2026-01-02", "end": "2026-02-01", "mode": "deadline", "cutoff": "09:00", "horizon": 24},
  "series": [
    {
      "time": "2026-01-02T00:00:00Z",
      "actual": 14202.0,            // number | null (null if actual missing)
      "forecast": 13800.0,          // number | null (null if no forecast qualifies)
      "publish_time": "2026-01-01T07:30:00Z",  // string | null
      "horizon_h": 16.5,            // hours between publish_time and time | null
      "error": -402.0               // forecast - actual | null if either missing
    }
  ],
  "metrics": {
    "count": 744,          // points where both actual and forecast exist
    "mae": 1234.5,
    "rmse": 1600.2,
    "bias": 120.3,         // mean(error); >0 means forecasts run high
    "nmae_pct": 9.8,       // mae / mean_actual * 100
    "mean_actual": 12500.0,
    "p10": -1900.0,        // percentiles of error
    "p50": 50.0,
    "p90": 2100.0,
    "max_over": 6000.0,    // largest positive error
    "max_under": -5500.0,  // most negative error
    "coverage_pct": 99.6   // % of target hours that have a qualifying forecast
  },
  "histogram": [ {"bin_start": -6000.0, "bin_end": -5500.0, "count": 3} ],
  "by_hour": [ {"hour": 0, "mae": 1100.0, "bias": 50.0, "count": 31} ],   // hour = UK local hour 0..23
  "daily": [
    {"date": "2026-01-02", "mae": 900.0, "bias": -100.0, "actual_mean": 14000.0, "forecast_mean": 13900.0, "count": 24}
  ]
}
```
All metric numbers may be `null` when `count` is 0.

## `GET /api/horizon-curve`
Params: `start`, `end` (horizon list fixed: 1,2,3,4,6,8,12,16,20,24,30,36,42,48).
```json
[ {"horizon_h": 1, "mae": 400.0, "rmse": 550.0, "bias": 10.0, "count": 740} ]
```

## `GET /api/buying-guide`
Params: `date` (`YYYY-MM-DD`, single delivery day), `cutoff` (`HH:MM`, default `09:00`),
`confidence` (int, one of 50, 80, 90, 95; default 90).

The safety margin is learned from the **errors of all other delivery days** in the dataset at
the same cutoff (so the chosen day's own outcome is not used to size its margin).
`safe_wind = max(0, forecast - margin)` where `margin` = the `confidence` percentile of error.
Meaning: with roughly `confidence`% probability, actual wind will be at least `safe_wind`.
```json
{
  "date": "2026-01-15",
  "cutoff": "09:00",
  "confidence": 90,
  "margin_mw": 2100.0,
  "hours": [
    {"time": "2026-01-15T00:00:00Z", "forecast": 15000.0, "safe_wind": 12900.0, "actual": 14100.0, "publish_time": "2026-01-14T07:30:00Z"}
  ],
  "totals": {"forecast_mwh": 360000.0, "safe_mwh": 309600.0, "actual_mwh": 340000.0}
}
```
