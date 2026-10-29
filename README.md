# WindCast: day-ahead wind forecast monitor (GB)

WindCast helps a UK utility's day-ahead power buying team answer two questions:

1. **What did the national wind forecast say when we had to place our order?** For each target hour,
   it picks the latest Elexon WINDFOR forecast published before the decision deadline.
2. **How much can we trust that forecast?** It measures error against Elexon FUELHH wind actuals
   (MAE, RMSE, bias, P10/P50/P90, by hour of day, by forecast age) and turns the error spread into a
   **safe wind level** to plan purchases around.

Scope: delivery days **2 Jan – 1 Feb 2026**, which covers purchase decisions made in January 2026.

**Live app:** https://dniw.vercel.app · **API docs (Swagger):** https://dniw.vercel.app/api/docs
**Key findings:** [docs/ANALYSIS.md](docs/ANALYSIS.md) · **API contract:** [docs/API.md](docs/API.md)

---

## Quick start

### Docker (recommended)
```bash
docker compose up --build
# app:  http://localhost:8080
# api:  http://localhost:8000/api/docs
```

### Without Docker
```bash
# backend (Python 3.11+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# frontend (Node 20+), in another terminal
cd frontend
npm ci
npm run dev            # http://localhost:5173 (proxies /api to :8000)
```

### Tests and checks
```bash
cd backend  && ruff check . && ruff format --check . && pytest
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```
CI (`.github/workflows/ci.yml`) runs all of the above plus `docker compose build` on every push.

### Refresh the data snapshot (optional)
```bash
cd backend && python -m scripts.fetch_snapshot   # ~1 minute; the WINDFOR stream is large
```

---

## How it works

```
 Elexon BMRS API ──(fetch_snapshot.py, once)──► backend/app/data/snapshot.json.gz  (113 KB)
                                                        │ loaded once per process
                                     ┌──────────────────▼───────────────────┐
                                     │ FastAPI backend (backend/app)         │
                                     │  store.py     clean + index data      │
                                     │  analysis.py  pick forecast, metrics  │
                                     │  main.py      HTTP API, validation    │
                                     └──────────────────┬───────────────────┘
                                                        │ JSON  /api/*
                                     ┌──────────────────▼───────────────────┐
                                     │ React + TypeScript frontend           │
                                     │  React Query cache, URL-synced state  │
                                     │  Recharts dashboards                  │
                                     └──────────────────────────────────────┘
 Docker: backend (uvicorn) + frontend (nginx, proxies /api) via docker-compose
 Vercel: frontend as static site + backend as one Python serverless function (api/index.py)
```

### Choosing the right forecast
Elexon re-publishes the wind forecast about 8 times a day, each version covering up to ~66 hours ahead.
For each target hour `t`:

- **Decision-deadline mode (default):** the latest version with `publishTime ≤ cutoff`, where the cutoff is
  `HH:MM` UK time on the day **before** the UK delivery day of `t` (default 09:00, before the GB day-ahead
  auctions). This is exactly what the buyer knew when ordering.
- **Horizon mode:** the latest version with `publishTime ≤ t − N hours` (N = 0–48), used to study how
  accuracy changes with forecast age.

Implementation: forecast versions are grouped by target hour and sorted by publish time once at load,
so each lookup is a binary search (`Dataset.latest_forecast`).

### Design decisions
| Decision | Why |
|---|---|
| Bundled data snapshot instead of live calls | January 2026 data is historical and fixed. The WINDFOR stream takes ~50 s to download, which is too slow for a serverless request, and a snapshot makes results reproducible. Live loading is still available (`WINDCAST_DATA_SOURCE=live`, or automatically if the snapshot is missing). |
| Times stored in UTC, delivery days in UK time | Avoids DST bugs; tested on 23- and 25-hour days. |
| `error = forecast − actual` | Positive = forecast too high = buyer is short of power, the risk the team cares about. |
| Rows published after their own target time are dropped | They are not forecasts. |
| Missing values are `null`, never `0` | A gap must look like a gap on the chart, not like zero wind. |
| Buying-guide margin learned from *other* days | Prevents the chosen day's outcome leaking into its own margin. |
| Server-side metrics, cached per parameter set | One source of truth for numbers; the frontend stays thin and fast. |
| No login | The brief does not need it, reviewers must open the app in incognito, and the data is public. For a real client we would add SSO (e.g. Azure AD). |
| Compare on the hour only | Forecasts are hourly and actuals half-hourly; we do not invent forecast values. |

### Engineering practices
- **Tests:** backend pytest suite (37 tests) covering cutoff boundaries (inclusive deadline, forecast
  published after deadline ignored), DST days, data cleaning, metric maths, histogram binning, the
  no-leak buying guide and API validation (422s). Frontend suite (60 tests, Vitest + Testing Library)
  covering URL state (parse, fallbacks, back/forward), UK-time formatting across DST, CSV export
  (escaping and formula-injection guard), plain-English insight text, and app render tests
  (loading → data, mode switch, 500 with retry, readable 422 message, empty state).
- **Frontend state:** all view settings live in the URL (shareable links, back button works), React Query
  caches responses per parameter set and keeps the previous result on screen while new data loads,
  the horizon slider is debounced, and derived chart data is memoised.
- **Lint/format:** ruff (Python), ESLint + strict TypeScript (frontend).
- **CI:** GitHub Actions on every push.
- **Observability:** every request is logged with its duration and returns a `Server-Timing` header.
- **Validation:** typed query parameters; dates outside scope, bad cutoffs or horizons return clear 422 errors.

---

## Files and directories

```
.
├── api/index.py                 Vercel entry point (wraps the FastAPI app)
├── backend/
│   ├── app/
│   │   ├── config.py            scope (dates, cutoff, horizons) and settings
│   │   ├── elexon.py            Elexon BMRS API client (FUELHH, WINDFOR)
│   │   ├── store.py             cleaning, indexing, snapshot read/write, live fallback
│   │   ├── analysis.py          forecast selection, metrics, horizon curve, buying guide
│   │   ├── main.py              FastAPI app, endpoints, validation, logging
│   │   └── data/snapshot.json.gz  Jan 2026 data from Elexon
│   ├── scripts/fetch_snapshot.py  rebuilds the snapshot from Elexon
│   ├── tests/                   pytest suite
│   ├── Dockerfile, requirements*.txt, pyproject.toml
├── frontend/
│   ├── src/api/                 typed API client + types matching docs/API.md
│   ├── src/hooks/               data hooks (React Query) and URL-state hook
│   ├── src/components/          dashboard sections and charts
│   ├── src/lib/                 formatting, UK dates, CSV, chart data and insight-text helpers
│   ├── Dockerfile, nginx.conf   production image (nginx serves the build, proxies /api)
├── docs/
│   ├── API.md                   API contract
│   └── ANALYSIS.md              findings from the January 2026 data
├── docker-compose.yml
├── vercel.json, requirements.txt  Vercel deployment config
└── .github/workflows/ci.yml     CI pipeline
```

## Environment variables (all optional)
| Name | Default | Purpose |
|---|---|---|
| `WINDCAST_DATA_SOURCE` | `snapshot` | `live` forces loading from Elexon |
| `WINDCAST_SNAPSHOT` | `backend/app/data/snapshot.json.gz` | snapshot path |
| `WINDCAST_CORS_ORIGINS` | `http://localhost:5173` | comma-separated allowed origins |
| `VITE_API_BASE` (frontend, build time) | `''` (same origin) | API base URL |

## Use of AI tools
This project was built with help from an AI coding assistant (Claude Code), which was used for scaffolding,
writing code and tests, and drafting documentation. I reviewed, ran and checked all code, analysis and
numbers, and I made the product and design decisions.

## Data source
Elexon BMRS Insights API (no key needed):
[FUELHH](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) (fuelType = WIND) and
[WINDFOR](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream).
