# What the January 2026 data says

Scope: GB national wind, delivery days 2 Jan – 1 Feb 2026 (744 hours), Elexon FUELHH (WIND) vs WINDFOR.
Default view: the latest forecast published by **09:00 UK time on the day before delivery**.
Error = forecast − actual, so a positive error means the forecast was too high.

## Headline numbers (09:00 day-ahead cutoff)

| Metric | Value | In plain words |
|---|---|---|
| Average wind (actual) | 11.3 GW | range 1.7 – 17.8 GW |
| MAE | 2.02 GW | a typical hour was off by about 2 GW |
| Error as % of average wind | 17.9 % | |
| RMSE | 2.50 GW | big misses happen, not just small ones |
| Bias | **+1.75 GW** | forecasts were **too high in 85 % of hours** |
| P10 / P50 / P90 error | −0.43 / +1.58 / +4.15 GW | 9 hours in 10, the forecast was at most 4.15 GW too high |
| Forecast age at decision time | 16.5 – 39.5 h | depends on the target hour within the delivery day |

## Findings

1. **Forecasts are too high almost all the time.** The bias stays at about +1.5 GW even **1 hour ahead**,
   so this is not mainly about forecasting the weather. The most likely reason is that WINDFOR forecasts
   the wind power that *could* be generated, while FUELHH reports metered output after curtailment
   (wind farms paid to turn down when the grid is congested), and does not include smaller embedded
   wind. *This is a hypothesis to check with the client; the data alone cannot prove it.*
2. **Removing the average bias alone cuts MAE from 2.02 GW to 1.38 GW (−32 %).** A simple, explainable
   correction gives the buying team a better central estimate straight away.
3. **Accuracy drops steadily with forecast age:** MAE is 1.68 GW at 1 h ahead, 1.93 GW at 24 h, and
   2.30 GW at 48 h. The day-ahead decision sits in the 16–40 h range, so it always carries this extra error.
4. **Moving the cutoff between 06:00 and 11:00 changes very little** (MAE 2.00 – 2.02 GW), because forecasts
   are re-published only about every 3 hours. Waiting for a later forecast is not worth much.
5. **Early-morning hours (03:00–05:00 UK) are the worst** (MAE about 2.4 GW, nearly all over-forecast);
   evening hours (21:00–22:00) are the best (about 1.75 GW).
6. **Bad days are very bad.** On 28 Jan the forecast averaged 11.1 GW but actual wind averaged only
   5.8 GW (a miss of 5.3 GW for the whole day). On such days the team would have been short of power
   by a large amount at day-ahead prices, and then forced to buy in the more expensive balancing market.

## How the buying guide uses this

For a chosen delivery day and confidence level (for example 90 %), the safety margin is the 90th percentile of
forecast error on **all other days** at the same cutoff. The day itself is left out, so the margin does not
use information the team would not have had.
`safe wind = max(0, forecast − margin)` → "with about 90 % confidence, at least this much wind will turn up;
buy the rest from the day-ahead market."

## Limits

- One month of winter data. Percentiles from 744 hours are a starting point, not a final risk model.
- Forecasts are hourly and actuals are half-hourly; we compare on the hour only (the :30 actual is not used).
- National level only; no prices, so the cost of an error is not measured in money yet.
- The pilot uses a fixed snapshot of Elexon data (it can be rebuilt with `backend/scripts/fetch_snapshot.py`).

## Next steps we would propose

Bias-corrected forecast as a separate line in the app, error by wind level (low/high wind regimes), price-weighted
cost of error, a rolling 30-day window updated daily, and alerts when the latest forecast moves a lot between
versions.
