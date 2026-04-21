# BudJet — Project Log

> A living document tracking every significant change, feature, and architectural decision in BudJet.
> For the full vision and story, see [`docs/story.md`](docs/story.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Change Log](#change-log)
- [Feature Status](#feature-status)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Architecture Phases](#architecture-phases)
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

BudJet started as a lightweight expense tracker and is being rebuilt into a full data platform: OLTP writes stay in Postgres/Express, analytics reads move to a DuckDB + dbt + Dagster medallion pipeline, and an ML/LLM layer handles categorization, forecasting, and natural-language queries.

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
| dbt-duckdb | SQL transformations (dev target) |
| dbt-bigquery | SQL transformations (cloud demo target) |
| Dagster | Pipeline orchestration |
| Parquet | Bronze storage format |
| Streamlit | Internal analyst dashboard (optional) |

---

## Change Log

### v0.4 — Shift Time Entry (April 2026)

| Area | Change |
|---|---|
| **Schema** | Added `jobs` table (id, user_id, name, hourly_rate, is_active) |
| **Schema** | Added `shifts` table (id, user_id, job_id, shift_date, clock_in, clock_out) with 4 indexes |
| **Backend** | New route `/api/jobs` — GET list, POST create, PATCH update (name, rate, active) |
| **Backend** | New route `/api/shifts` — clock in, clock out, update shift, get by month, pay cycle estimate |
| **Backend** | Pay cycle endpoint splits monthly earnings into 3 buckets: days 1–7, 8–15, 16–end; returns expected payouts on 16th and 1st |
| **Frontend** | New page `/shifts` — add jobs, clock in/out with editable date+time, shift history table |
| **Frontend** | Quick stats: avg hours/day worked, total hours in current fortnight |
| **Frontend** | "Pending Salary Received" buttons — one per fortnight payout, posts directly to income transactions |
| **Frontend** | Expected salary panel moved to bottom of page |

---

### v0.3 — Firebase Auth Enforcement (April 2026)

| Area | Change |
|---|---|
| **Backend** | New middleware `backend/src/middleware/firebaseAuth.js` |
| **Backend** | `verifyFirebaseToken` — verifies Firebase ID token on every protected route |
| **Backend** | `requireParamUidMatch` — ensures URL `:userId` matches the token's UID |
| **Backend** | `requireBodyUidMatch` — ensures `user_id` in request body matches the token's UID, auto-injects it if absent |
| **Backend** | Fallback: if no service account JSON is present, verifies tokens via Firebase REST API (`accounts:lookup`) using `VITE_FIREBASE_API_KEY` |
| **Backend** | All transaction, category, budget, job, and shift routes now require a valid Bearer token |
| **Frontend** | `api/client.js` — on 401 response, auto-retries with a force-refreshed Firebase ID token |

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
| **Frontend** | Home dashboard — balance, income/expense summary, category donut, monthly trend chart |
| **Frontend** | Transaction list with category colors |
| **Frontend** | Budget tracking page |

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
| User authentication (Firebase) | ✅ Complete | Google + GitHub OAuth; token verified server-side |
| Transaction CRUD | ✅ Complete | With category, type, date |
| Category management | ✅ Complete | Per-user, color-coded |
| Budget tracking | ✅ Complete | Monthly limits per category |
| Financial summary dashboard | ✅ Complete | Balance, income/expense, trend, pay cycles |
| Shift time tracking | ✅ Complete | Jobs, clock in/out, editable times |
| Pay cycle estimate | ✅ Complete | Semi-monthly buckets, expected payouts |
| Salary → income recording | ✅ Complete | One-click "Pending Salary Received" button |
| Bronze ingestion (Dagster) | 🔲 Planned | Phase 5 |
| Silver/Gold dbt models | 🔲 Planned | Phase 6 |
| Analytics API (`/api/analytics/*`) | 🔲 Planned | Phase 7 |
| Insights UI page | 🔲 Planned | Phase 8 |
| Recurring transactions | 🔲 Planned | Phase 2 schema addition |
| Change log CDC trigger | 🔲 Planned | Phase 2 schema addition |
| ML auto-categorizer | 🔲 Planned | Milestone M1 |
| Spend forecast | 🔲 Planned | Milestone M2 |
| Anomaly detection | 🔲 Planned | Milestone M3 |
| NL-to-SQL (Claude API) | 🔲 Planned | Milestone M4 |
| Receipt OCR | 🔲 Planned | Milestone M5 |
| Streamlit internal dashboard | 🔲 Optional | Phase 9 |
| CI/CD pipeline | 🔲 Planned | Phase 10 |

---

## Database Schema

### Existing Tables

```
users              uid PK · email · display_name · created_at
categories         id PK · user_id FK · name · type[income|expense] · color
transactions       id PK · user_id FK · category_id FK · amount · description · type · transaction_date
budgets            id PK · user_id FK · category_id FK · amount · month[YYYY-MM]  ← unique(user,cat,month)
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
| POST | `/api/budgets` | Bearer | Create or update budget |

### Jobs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/:userId` | Bearer | List jobs |
| POST | `/api/jobs` | Bearer | Create job |
| PATCH | `/api/jobs/:jobId` | Bearer | Update job name, rate, active status |

### Shifts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/shifts/:userId?month=YYYY-MM` | Bearer | List shifts for a month |
| POST | `/api/shifts/clock-in` | Bearer | Start a shift |
| PATCH | `/api/shifts/:shiftId/clock-out` | Bearer | End a shift |
| PATCH | `/api/shifts/:shiftId` | Bearer | Edit shift date/times |
| GET | `/api/shifts/pay-cycle/:userId?year=&month=` | Bearer | Semi-monthly pay cycle estimate |

---

## Architecture Phases

| Phase | Description | Status |
|---|---|---|
| 0 | Baseline & safety — branch strategy, API snapshots | ✅ |
| 1 | Firebase auth enforcement on all protected routes | ✅ |
| 2 | OLTP schema expansion — shifts, jobs, recurring_txns, change_log | ⏳ Partial (shifts + jobs done) |
| 3 | Transaction route cleanup & validation | ✅ |
| 4 | Analytics scaffold — dbt project, DuckDB + BigQuery targets | 🔲 |
| 5 | Bronze ingestion with Dagster assets + schedules | 🔲 |
| 6 | Silver/Gold dbt models + tests | 🔲 |
| 7 | Analytics serving API (`/api/analytics/*`) | 🔲 |
| 8 | Frontend Insights page with Recharts | 🔲 |
| 9 | Optional Streamlit internal dashboard | 🔲 |
| 10 | CI/CD + deployment runbook | 🔲 |
| 11 | Cutover — route UI to Gold-backed endpoints, deprecate legacy logic | 🔲 |

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
| `VITE_FIREBASE_API_KEY` | No* | Firebase Web API key — used as fallback for token verification |

> \* At least one Firebase credential path must be configured. If no service account is present, `VITE_FIREBASE_API_KEY` is used for REST-based token verification.

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

---

*Last updated: April 2026*
