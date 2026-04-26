# BudJet

A personal finance tracker built as a full data platform — not just a CRUD app. OLTP writes stay in Postgres/Express; analytics reads are moving to a DuckDB + dbt + Dagster medallion pipeline. An ML/LLM layer is planned for auto-categorization, forecasting, and natural-language queries.

For the full story behind the project, see [`docs/story.md`](docs/story.md).

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Change Log](#change-log)
- [Feature Status](#feature-status)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Architecture Phases](#architecture-phases)
- [Future Plans](#future-plans)
- [Environment Variables](#environment-variables)

---

## Project Overview

| Field | Details |
|---|---|
| **Name** | BudJet |
| **Author** | Rudraksha Ravindra Kokane |
| **Contact** | rudrark0109@gmail.com |
| **Purpose** | Personal finance tracker with shift-based income tracking and a medallion analytics pipeline |
| **Status** | Active — OLTP complete, data platform in progress |
| **License** | All rights reserved. Viewing permitted; copying/redistribution requires written consent. |

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18.3 | UI framework |
| Vite | 5.1 | Build tool & dev server |
| React Router | 7.10 | Client-side routing |
| Recharts | 2.10 | Data visualization |
| Tailwind CSS | 4.1 | Utility styling |
| Firebase (client) | 12.6 | Authentication |
| Lucide React | 0.344 | Icon library |

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 20+ | Runtime |
| Express | 4.18 | HTTP framework |
| PostgreSQL | — | Primary OLTP database |
| pg (node-postgres) | 8.12 | DB driver |
| firebase-admin | 12.6 | Server-side token verification |
| dotenv | 16.4 | Environment config |
| cors | 2.8 | Cross-origin requests |

### Data Platform (planned / in progress)

| Technology | Role |
|---|---|
| DuckDB | Local analytics warehouse |
| dbt-duckdb | SQL transformations (local dev target) |
| dbt-bigquery | SQL transformations (cloud / demo target) |
| Dagster | Pipeline orchestration & asset lineage |
| Parquet | Bronze storage format |
| Streamlit | Internal analyst dashboard (optional) |

---

## Quick Start

```bash
# Backend
cd backend
npm install
# create backend/.env (see Environment Variables section)
npm run dev            # http://localhost:5000

# Frontend
cd frontend
npm install
# create frontend/.env (see Environment Variables section)
npm run dev            # http://localhost:5173
```

Apply the schema to your Postgres instance:

```bash
psql "$CONNECTION_STRING" -f backend/schema.sql
```

Default categories are seeded on first user registration via `/api/auth/register`.

### Health Checks

| Endpoint | Description |
|---|---|
| `GET /health` | App health check |
| `GET /api/test-db` | Database connectivity check |

### Scripts

| Context | Command | Description |
|---|---|---|
| Backend | `npm run dev` | Start with nodemon |
| Backend | `npm start` | Start without watch |
| Frontend | `npm run dev` | Vite dev server |
| Frontend | `npm run build` | Production build |
| Frontend | `npm run preview` | Preview production build locally |

---

## Change Log

### v0.5 — Shift Delete & Auth Hardening (April 2026)

| Area | Change |
|---|---|
| **Backend** | New `DELETE /api/shifts/:shiftId` route — removes a shift, enforces ownership via `requireBodyUidMatch` |
| **Frontend** | Delete button on every row in the shifts history table; confirms before deleting |
| **Frontend** | `deleteShift(shiftId, userId)` added to `api/shifts.js` |
| **Frontend** | `api.delete()` method added to `api/client.js` |
| **Backend** | Firebase auth middleware now supports three credential paths: service account JSON file → individual env vars → REST API fallback (`accounts:lookup`) |
| **Frontend** | On 401 response, `api/client.js` automatically force-refreshes the Firebase ID token and retries the request once |

---

### v0.4 — Shift Time Entry (April 2026)

| Area | Change |
|---|---|
| **Schema** | Added `jobs` table (id, user_id, name, hourly_rate, is_active) |
| **Schema** | Added `shifts` table (id, user_id, job_id, shift_date, clock_in, clock_out) with 4 indexes |
| **Backend** | New route `/api/jobs` — GET list, POST create, PATCH update (name, rate, active status) |
| **Backend** | New route `/api/shifts` — clock in, clock out, update shift, get by month, pay cycle estimate |
| **Backend** | Pay cycle endpoint: splits monthly earnings into 3 buckets (days 1–7, 8–15, 16–end); returns expected payouts on the 16th and 1st of next month |
| **Frontend** | New page `/shifts` — add jobs, clock in/out with editable date and time, shift history table |
| **Frontend** | Quick stats: avg hours/day worked and total hours in current fortnight |
| **Frontend** | "Pending Salary Received" buttons — one per fortnight payout, posts directly to income transactions and updates dashboard balance |
| **Frontend** | Expected salary panel placed at bottom of page, below shift history |

---

### v0.3 — Firebase Auth Enforcement (April 2026)

| Area | Change |
|---|---|
| **Backend** | New middleware `backend/src/middleware/firebaseAuth.js` |
| **Backend** | `verifyFirebaseToken` — verifies Firebase ID token on every protected route |
| **Backend** | `requireParamUidMatch` — ensures URL `:userId` matches the authenticated token's UID |
| **Backend** | `requireBodyUidMatch` — ensures `user_id` in request body matches the token's UID; auto-injects it if absent |
| **Backend** | REST fallback: if no service account is present, verifies tokens via Firebase `accounts:lookup` REST API using `VITE_FIREBASE_API_KEY` |
| **Backend** | All transaction, category, budget, job, and shift routes now require a valid Bearer token |

---

### v0.2 — Core Finance Features (December 2025)

| Area | Change |
|---|---|
| **Schema** | `transactions` table with category join, type enum (income/expense), transaction_date |
| **Schema** | `categories` table per user with color and type |
| **Schema** | `budgets` table with unique constraint on (user_id, category_id, month) |
| **Backend** | `/api/transactions` — CRUD + financial summary with category breakdown, monthly trend, pay-cycle savings |
| **Backend** | `/api/categories` — CRUD per user |
| **Backend** | `/api/budgets` — CRUD with month-scoped budget limits |
| **Frontend** | Home dashboard — balance, income/expense summary, category donut chart, monthly trend chart |
| **Frontend** | Transaction list with category colors |
| **Frontend** | Budget tracking page with per-category limits |

---

### v0.1 — Initial Setup (December 2025)

| Area | Change |
|---|---|
| **Project** | Monorepo scaffold: `frontend/`, `backend/`, `docs/` |
| **Schema** | `users` table linked to Firebase UID |
| **Backend** | `/api/auth` — register/login user profile in Postgres after Firebase auth |
| **Backend** | Health check `/health`, DB test `/api/test-db` |
| **Frontend** | Login page with Google + GitHub OAuth via Firebase |
| **Frontend** | Navbar with route links |
| **Docs** | Developer guide, deployment guide |

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| User authentication (Firebase) | ✅ Complete | Google + GitHub OAuth; token verified server-side with REST fallback |
| Transaction CRUD | ✅ Complete | With category, type, and date |
| Category management | ✅ Complete | Per-user, color-coded |
| Budget tracking | ✅ Complete | Monthly limits per category |
| Financial summary dashboard | ✅ Complete | Balance, income/expense, trend, pay cycle |
| Shift time tracking | ✅ Complete | Jobs, clock in/out, editable date/times |
| Delete shift records | ✅ Complete | Per-row delete with ownership enforcement |
| Pay cycle estimate | ✅ Complete | Semi-monthly buckets, expected payouts |
| Salary → income recording | ✅ Complete | One-click "Pending Salary Received" button |
| Recurring transactions | ⏳ Planned | Phase 2 schema addition |
| Change log CDC trigger | ⏳ Planned | Phase 2 schema addition |
| Bronze ingestion (Dagster) | 🔲 Planned | Phase 5 |
| Silver/Gold dbt models | 🔲 Planned | Phase 6 |
| Analytics API (`/api/analytics/*`) | 🔲 Planned | Phase 7 |
| Insights UI page (Recharts) | 🔲 Planned | Phase 8 |
| ML auto-categorizer | 🔲 Planned | Milestone M1 |
| Spend forecast | 🔲 Planned | Milestone M2 |
| Anomaly detection | 🔲 Planned | Milestone M3 |
| NL-to-SQL (Claude API) | 🔲 Planned | Milestone M4 |
| Receipt OCR | 🔲 Planned | Milestone M5 |
| Streamlit internal dashboard | 🔲 Optional | Phase 9 |
| CI/CD pipeline | 🔲 Planned | Phase 10 |

---

## Database Schema

### Current Tables

```
users              uid PK · email · display_name · created_at
categories         id PK · user_id FK · name · type[income|expense] · color
transactions       id PK · user_id FK · category_id FK · amount · description · type · transaction_date
budgets            id PK · user_id FK · category_id FK · amount · month[YYYY-MM]  ← unique(user, cat, month)
jobs               id PK · user_id FK · name · hourly_rate · is_active · created_at
shifts             id PK · user_id FK · job_id FK · shift_date · clock_in · clock_out · created_at · updated_at
```

### Planned Additions

```
recurring_txns     id PK · user_id FK · category_id FK · amount · cadence · next_due_date · description · active
change_log         id PK · source_table · source_id · op · payload JSONB · ts
```

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create user profile after Firebase signup |

### Transactions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/transactions/:userId` | Bearer | List last 50 transactions |
| POST | `/api/transactions` | Bearer | Create transaction |
| GET | `/api/transactions/summary/:userId` | Bearer | Financial summary, trends, pay cycles |

### Categories

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/categories/:userId` | Bearer | List categories |
| POST | `/api/categories` | Bearer | Create category |
| PATCH | `/api/categories/:id` | Bearer | Update category |
| DELETE | `/api/categories/:id` | Bearer | Delete category |

### Budgets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/budgets/:userId` | Bearer | List budgets |
| POST | `/api/budgets` | Bearer | Create or update a budget |

### Jobs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/:userId` | Bearer | List jobs |
| POST | `/api/jobs` | Bearer | Create job |
| PATCH | `/api/jobs/:jobId` | Bearer | Update job name, rate, or active status |

### Shifts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/shifts/:userId?month=YYYY-MM` | Bearer | List shifts for a month |
| POST | `/api/shifts/clock-in` | Bearer | Start a new shift |
| PATCH | `/api/shifts/:shiftId/clock-out` | Bearer | End an active shift |
| PATCH | `/api/shifts/:shiftId` | Bearer | Edit shift date and/or times |
| DELETE | `/api/shifts/:shiftId` | Bearer | Delete a shift record |
| GET | `/api/shifts/pay-cycle/:userId?year=&month=` | Bearer | Semi-monthly pay cycle estimate |

---

## Architecture Phases

| Phase | Description | Status |
|---|---|---|
| 0 | Baseline & safety — branch strategy, API snapshots | ✅ Done |
| 1 | Firebase auth enforcement on all protected routes | ✅ Done |
| 2 | OLTP schema expansion — shifts, jobs, recurring_txns, change_log | ⏳ Partial (shifts + jobs done) |
| 3 | Transaction route cleanup & validation | ✅ Done |
| 4 | Analytics scaffold — dbt project init, DuckDB + BigQuery targets | 🔲 |
| 5 | Bronze ingestion with Dagster assets and schedules | 🔲 |
| 6 | Silver/Gold dbt models + tests | 🔲 |
| 7 | Analytics serving API (`/api/analytics/*`) backed by Gold marts | 🔲 |
| 8 | Frontend Insights page consuming analytics API via Recharts | 🔲 |
| 9 | Optional Streamlit internal dashboard | 🔲 |
| 10 | CI/CD + deployment runbook | 🔲 |
| 11 | Cutover — route UI to Gold-backed endpoints, deprecate legacy inline queries | 🔲 |

---

## Future Plans

The OLTP layer is stable. Everything from here is additive — no existing functionality breaks.

### Near-Term (Phase 2–3 Completions)

| Item | Description |
|---|---|
| Recurring transactions | Auto-generate income/expense entries on a cadence (weekly, monthly, etc.) |
| Change log trigger | Postgres CDC trigger populating a `change_log` table for bronze extraction |
| Shift editing UI | Inline edit for shift date and times directly in the history table (currently requires delete + re-add) |
| Budget alerts | Visual indicator when a category is over or near its monthly budget limit |

### Data Platform (Phases 4–8)

The write path stays in Postgres. The analytics read path moves to a DuckDB + dbt + Dagster medallion pipeline:

| Layer | What it holds | Tools |
|---|---|---|
| Bronze | Raw snapshots extracted from Postgres — immutable, timestamped Parquet files | Dagster assets |
| Silver | Cleaned, typed, deduplicated tables with dbt tests and contracts | dbt-duckdb |
| Gold | Business-facing marts: spend by category, budget vs actual, cashflow, pay cycles, earnings summaries | dbt-duckdb / dbt-bigquery |

The Insights page in the React app consumes Gold mart APIs — users see analytics without needing a separate BI tool.

### ML / LLM Layer (Milestones M1–M5)

| Milestone | Feature | Description |
|---|---|---|
| M1 | Auto-categorizer | Classify new transactions into categories using a fine-tuned or few-shot model |
| M2 | Spend forecast | Project next month's spending per category based on historical patterns |
| M3 | Anomaly detection | Flag unusual transactions or sudden category spikes |
| M4 | NL-to-SQL (Claude API) | Ask natural-language questions ("how much did I spend on food last quarter?") — Claude generates SQL, a parser validates it, Gold mart answers it |
| M5 | Receipt OCR | Photograph a receipt to auto-log the transaction: amount, merchant, suggested category |

### Infrastructure

| Item | Description |
|---|---|
| CI/CD | GitHub Actions pipeline: lint, test, build, deploy on push to `main` |
| Cloud deployment | Frontend on Vercel or Netlify; backend on Railway or Fly.io; DuckDB/Dagster on a lightweight VPS |
| BigQuery demo target | dbt-bigquery profile for cloud-scale query demo without changing any SQL |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default 5000) |
| `CORS_ORIGIN` | Yes | Frontend origin (e.g. `http://localhost:5173`) |
| `PG_HOST` | Yes | Postgres host |
| `PG_PORT` | No | Postgres port (default 5432) |
| `PG_DATABASE` | Yes | Database name |
| `PG_USER` | Yes | Database user |
| `PG_PASSWORD` | Yes | Database password |
| `PG_SSL` | No | Set `true` for SSL connections |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No* | Path to service account JSON (e.g. `./serviceAccountKey.json`) |
| `FIREBASE_PROJECT_ID` | No* | Firebase project ID (if not using service account file) |
| `FIREBASE_CLIENT_EMAIL` | No* | Service account client email |
| `FIREBASE_PRIVATE_KEY` | No* | Service account private key |
| `VITE_FIREBASE_API_KEY` | No* | Firebase Web API key — used as REST fallback for token verification |

> \* At least one Firebase credential path must be configured. If no service account is present, `VITE_FIREBASE_API_KEY` alone is sufficient — the backend verifies tokens via the Firebase REST API.

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend base URL (e.g. `http://localhost:5000`) |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Firebase analytics measurement ID |

### Docs

- Developer guide: [`docs/developer-guide.md`](docs/developer-guide.md)
- Deployment guide: [`docs/deployment-guide.md`](docs/deployment-guide.md)
- Architecture workflow plan: [`docs/workflow-implementation-plan.md`](docs/workflow-implementation-plan.md)
- Project story: [`docs/story.md`](docs/story.md)

---

*Last updated: April 2026*

Copyright (c) 2025–2026 Rudraksha Ravindra Kokane. All rights reserved. Viewing the source is allowed; copying, modifying, or redistributing any part of this project requires prior written consent.
