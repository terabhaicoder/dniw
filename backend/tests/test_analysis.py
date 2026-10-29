from datetime import date, time

import pytest

from app import analysis
from app.store import build_dataset

from .conftest import actual_row, forecast_row, utc


def test_deadline_mode_uses_latest_forecast_published_by_cutoff(small_dataset):
    pts = analysis.select_series(small_dataset, date(2026, 1, 10), date(2026, 1, 10), "deadline", time(9, 0))
    assert len(pts) == 24
    first, second = pts[0], pts[1]
    assert (first.forecast, first.actual, first.error) == (1100, 1000, 100)
    assert first.publish_time == utc(2026, 1, 9, 9, 0)
    assert first.horizon_h == 15
    assert second.forecast == 2400 and second.error == 400
    # hours with no data stay None, never zero
    assert pts[5].forecast is None and pts[5].actual is None and pts[5].error is None


def test_earlier_cutoff_falls_back_to_older_forecast(small_dataset):
    pts = analysis.select_series(small_dataset, date(2026, 1, 10), date(2026, 1, 10), "deadline", time(6, 0))
    assert pts[0].forecast == 900


def test_horizon_mode(small_dataset):
    d = date(2026, 1, 10)
    assert (
        analysis.select_series(small_dataset, d, d, "horizon", horizon_h=14)[0].forecast == 1500
    )  # pub 09:30, 14.5h ahead
    assert (
        analysis.select_series(small_dataset, d, d, "horizon", horizon_h=15)[0].forecast == 1100
    )  # pub 09:00, exactly 15h
    assert analysis.select_series(small_dataset, d, d, "horizon", horizon_h=21)[0].forecast is None


@pytest.mark.parametrize(
    ("day", "hours"),
    [(date(2026, 1, 15), 24), (date(2026, 3, 29), 23), (date(2026, 10, 25), 25)],  # GMT, spring-forward, fall-back
)
def test_target_hours_follow_uk_days_across_dst(day, hours):
    assert len(analysis.target_hours(day, day)) == hours


def test_deadline_uses_uk_time_in_summer():
    # 1 Jul 2026 is BST (UTC+1): 09:00 UK on 30 Jun = 08:00 UTC
    assert analysis.deadline_for(utc(2026, 7, 1, 12), time(9, 0)) == utc(2026, 6, 30, 8, 0)


def test_deadline_for_first_hour_of_uk_day():
    # 00:00 UTC on 10 Jan is UK delivery day 10 Jan -> deadline 09:00 on 9 Jan
    assert analysis.deadline_for(utc(2026, 1, 10, 0), time(9, 0)) == utc(2026, 1, 9, 9, 0)


@pytest.mark.parametrize("bad", ["9", "aa:bb", "", "9:00:00"])
def test_parse_cutoff_rejects_garbage(bad):
    with pytest.raises(ValueError):
        analysis.parse_cutoff(bad)


def test_percentile_matches_linear_interpolation():
    xs = [1, 2, 3, 4, 5]
    assert analysis.percentile(xs, 0) == 1
    assert analysis.percentile(xs, 50) == 3
    assert analysis.percentile(xs, 90) == pytest.approx(4.6)
    assert analysis.percentile([7], 10) == 7
    assert analysis.percentile([], 50) is None


def test_error_stats_values(small_dataset):
    pts = analysis.select_series(small_dataset, date(2026, 1, 10), date(2026, 1, 10))
    s = analysis.error_stats(pts)  # errors: +100, +400 ; actuals 1000, 2000
    assert s["count"] == 2
    assert s["mae"] == 250 and s["bias"] == 250
    assert s["rmse"] == pytest.approx(291.5, abs=0.1)
    assert s["nmae_pct"] == pytest.approx(16.67, abs=0.01)
    assert (s["max_over"], s["max_under"]) == (400, 100)
    assert s["coverage_pct"] == pytest.approx(2 / 24 * 100, abs=0.01)


def test_error_stats_empty_is_all_none():
    s = analysis.error_stats([])
    assert s["count"] == 0
    assert all(v is None for k, v in s.items() if k != "count")


def test_histogram_bins_cover_all_errors(small_dataset):
    pts = analysis.select_series(small_dataset, date(2026, 1, 10), date(2026, 1, 10))
    hist = analysis.histogram(pts, bin_mw=250)
    assert sum(b["count"] for b in hist) == 2
    assert hist[0]["bin_start"] == 0 and hist[-1]["bin_end"] == 500
    assert analysis.histogram([]) == []


def test_negative_errors_land_in_negative_bins():
    t = utc(2026, 1, 10, 0)
    ds = build_dataset([actual_row(t, 1000)], [forecast_row(utc(2026, 1, 9, 1), t, 700)], "test")
    pts = analysis.select_series(ds, date(2026, 1, 10), date(2026, 1, 10))
    assert analysis.histogram(pts) == [{"bin_start": -500, "bin_end": 0, "count": 1}]


def test_by_hour_and_daily_shapes(small_dataset):
    pts = analysis.select_series(small_dataset, date(2026, 1, 10), date(2026, 1, 10))
    hours = analysis.by_hour(pts)
    assert len(hours) == 24 and hours[0]["mae"] == 100 and hours[2]["mae"] is None
    days = analysis.daily(pts)
    assert days == [
        {"date": "2026-01-10", "mae": 250, "bias": 250, "actual_mean": 1500, "forecast_mean": 1750, "count": 2}
    ]


def _two_day_dataset():
    """Day 1 errors are all +1000; day 2 errors are all +10. One forecast per hour."""
    actuals, forecasts = [], []
    for day, err in ((10, 1000), (11, 10)):
        for h in range(24):
            t = utc(2026, 1, day, h)
            actuals.append(actual_row(t, 5000))
            forecasts.append(forecast_row(utc(2026, 1, day - 1, 6), t, 5000 + err))
    return build_dataset(actuals, forecasts, "test")


def test_buying_guide_margin_excludes_the_day_itself():
    ds = _two_day_dataset()
    g = analysis.buying_guide(ds, date(2026, 1, 11), time(9, 0), 90)
    assert g["margin_mw"] == 1000  # learned from 10 Jan only, not from 11 Jan's own +10 errors
    first = g["hours"][0]
    assert first["forecast"] == 5010 and first["safe_wind"] == 4010
    assert g["totals"] == {"forecast_mwh": 5010 * 24, "safe_mwh": 4010 * 24, "actual_mwh": 5000 * 24}


def test_buying_guide_never_goes_below_zero():
    ds = _two_day_dataset()
    ds.forecasts[utc(2026, 1, 11, 0)][0] = type(ds.forecasts[utc(2026, 1, 11, 0)][0])(utc(2026, 1, 10, 6), 300)
    g = analysis.buying_guide(ds, date(2026, 1, 11), time(9, 0), 90)
    assert g["hours"][0]["safe_wind"] == 0
