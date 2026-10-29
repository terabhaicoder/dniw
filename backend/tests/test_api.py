import pytest
from fastapi.testclient import TestClient

from app.main import _analysis, app, dataset


@pytest.fixture
def client(small_dataset):
    app.dependency_overrides[dataset] = lambda: small_dataset
    yield TestClient(app)
    app.dependency_overrides.clear()
    _analysis.cache_clear()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta(client):
    body = client.get("/api/meta").json()
    assert body["delivery_start"] == "2026-01-02" and body["source"] == "test"
    assert body["forecast_versions"] == 3


def test_analysis_contract(client):
    r = client.get("/api/analysis", params={"start": "2026-01-10", "end": "2026-01-10"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"params", "series", "metrics", "histogram", "by_hour", "daily"}
    assert body["series"][0] == {
        "time": "2026-01-10T00:00:00Z",
        "actual": 1000.0,
        "forecast": 1100.0,
        "publish_time": "2026-01-09T09:00:00Z",
        "horizon_h": 15.0,
        "error": 100.0,
    }
    assert body["metrics"]["count"] == 2
    assert "Server-Timing" in r.headers


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2026-01-11", "end": "2026-01-10"},  # reversed
        {"start": "2025-12-01"},  # out of scope
        {"cutoff": "24:00"},
        {"cutoff": "9am"},
        {"mode": "weekly"},
        {"mode": "horizon", "horizon": 49},
        {"mode": "horizon", "horizon": -1},
    ],
)
def test_analysis_rejects_bad_input(client, params):
    assert client.get("/api/analysis", params=params).status_code == 422


def test_horizon_curve(client):
    rows = client.get("/api/horizon-curve", params={"start": "2026-01-10", "end": "2026-01-10"}).json()
    assert [r["horizon_h"] for r in rows][:3] == [1, 2, 3]
    assert all({"mae", "rmse", "bias", "count"} <= set(r) for r in rows)


def test_buying_guide_validation(client):
    assert client.get("/api/buying-guide", params={"date": "2026-01-10", "confidence": 70}).status_code == 422
    assert client.get("/api/buying-guide", params={"date": "2026-03-01"}).status_code == 422
    assert client.get("/api/buying-guide", params={"date": "2026-01-10"}).status_code == 200
