from app.store import build_dataset, clean_actuals, clean_forecasts, read_snapshot, write_snapshot

from .conftest import actual_row, forecast_row, utc


def test_actuals_keep_latest_publication_and_ignore_other_fuels():
    t = utc(2026, 1, 5, 12)
    rows = [
        actual_row(t, 100, published=utc(2026, 1, 5, 13)),
        actual_row(t, 120, published=utc(2026, 1, 5, 14)),  # revision wins
        {**actual_row(t, 999), "fuelType": "CCGT"},
        {**actual_row(utc(2026, 1, 5, 13), 1), "generation": None},
    ]
    assert clean_actuals(rows) == {t: 120.0}


def test_forecasts_drop_rows_targeting_the_past_and_sort_versions():
    t = utc(2026, 1, 5, 12)
    rows = [
        forecast_row(utc(2026, 1, 5, 9), t, 3),
        forecast_row(utc(2026, 1, 5, 3), t, 1),
        forecast_row(utc(2026, 1, 5, 13), t, 99),  # published after its target: not a forecast
    ]
    versions = clean_forecasts(rows)[t]
    assert [v.generation for v in versions] == [1.0, 3.0]


def test_duplicate_forecast_versions_are_collapsed():
    t, p = utc(2026, 1, 5, 12), utc(2026, 1, 5, 3)
    assert len(clean_forecasts([forecast_row(p, t, 1), forecast_row(p, t, 2)])[t]) == 1


def test_latest_forecast_boundaries(small_dataset):
    t0 = utc(2026, 1, 10, 0)
    assert small_dataset.latest_forecast(t0, utc(2026, 1, 9, 9, 0)).generation == 1100  # inclusive
    assert small_dataset.latest_forecast(t0, utc(2026, 1, 9, 8, 59)).generation == 900
    assert small_dataset.latest_forecast(t0, utc(2026, 1, 9, 3, 0)) is None  # nothing published yet
    assert small_dataset.latest_forecast(utc(2030, 1, 1), utc(2030, 1, 1)) is None  # unknown target


def test_snapshot_round_trip(tmp_path):
    t = utc(2026, 1, 5, 12)
    actuals, forecasts = [actual_row(t, 10)], [forecast_row(utc(2026, 1, 5, 1), t, 11)]
    path = tmp_path / "snap.json.gz"
    write_snapshot(path, actuals, forecasts)
    ds = build_dataset(*read_snapshot(path), "snapshot")
    assert ds.actuals == {t: 10}
    assert ds.latest_forecast(t, t).generation == 11
