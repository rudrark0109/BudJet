# BudJet Architecture Change Workflow (Chronological)

This document describes what should change, and in what order, as BudJet moves from the current monolithic OLTP-focused setup to the redesigned OLTP + analytics architecture.

## Goal
- Keep the existing app stable while introducing a reliable analytics pipeline and insights serving layer.
- Ship in phases so each milestone is testable and reversible.

## Working Rules
- Do not break current core flows: register, login, add transaction, view summary.
- Each phase must end with a smoke test before moving to the next phase.
- Prefer additive changes first; remove legacy logic only after replacement is verified.

## Phase 0 - Baseline and Safety (Day 0)
### Changes
- Create a feature branch for the architecture rollout.
- Keep one stable branch as the current version snapshot (for example: `main` + one `feature/*` branch for new architecture work).
- Capture current API behavior with simple request/response snapshots.
- Add a backup/export plan for current Postgres data.

### Files/Areas
- `backend/src/routes/*.js`
- `backend/schema.sql`
- `docs/developer-guide.md`

### Done Criteria
- Baseline endpoints are documented and manually verified.
- Code rollback path is clear (switch back to stable branch and redeploy previous backend build).
- Data rollback path is clear (restore Postgres from a DB backup; branches alone do not back up database data).

## Phase 1 - Auth and Security Foundation (Day 1)
### Changes
- Add Firebase ID token verification middleware in backend.
- Enforce authenticated access for transaction, budget, and category routes.
- Keep one public health route for platform checks.

### Files/Areas
- `backend/src/index.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/transactions.js`
- `backend/src/routes/budgets.js`
- `backend/src/routes/categories.js`
- `backend/package.json` (if auth middleware dependency updates are needed)

### Done Criteria
- Protected routes reject missing/invalid tokens with 401.
- Existing frontend can still call API after passing Firebase token.

## Phase 2 - OLTP Schema Expansion (Day 2)
### Changes
- Add new operational tables planned in architecture:
  - `shifts`
  - `recurring_transactions` (or `recurring_txns`, pick one canonical name)
  - `change_log`
- Add indexes and foreign keys for query performance and integrity.
- Keep changes backward compatible with existing tables.

### Files/Areas
- `backend/schema.sql`
- New migration files (recommended): `backend/migrations/*`

### Done Criteria
- Schema applies cleanly on a fresh database.
- Existing endpoints still work without requiring new table fields.

## Phase 3 - Transaction Route Cleanup and Domain Alignment (Day 3)
### Changes
- Refactor transaction summary logic so business metrics are clear and deterministic.
- Move pay-cycle style calculations out of overloaded transactional routes if needed.
- Add route-level validation for required fields and enums (`income`/`expense`).

### Files/Areas
- `backend/src/routes/transactions.js`
- `backend/src/routes/budgets.js`

### Done Criteria
- Transaction CRUD and summary endpoints are stable and validated.
- No duplicate metric logic across routes.

## Phase 4 - Analytics Project Scaffold (Day 4)
### Changes
- Create a new `data_platform/` workspace section.
- Set up dbt project structure for medallion layers.
- Set up DuckDB local target and optional BigQuery demo target.

### Files/Areas
- `data_platform/dbt_project.yml`
- `data_platform/profiles.yml` (or profile documentation)
- `data_platform/models/bronze/*`
- `data_platform/models/silver/*`
- `data_platform/models/gold/*`

### Done Criteria
- `dbt debug` and `dbt run` succeed locally against DuckDB.
- Model folders are in place even if some models are initially placeholders.

## Phase 5 - Bronze Ingestion with Dagster (Day 5)
### Changes
- Create Dagster assets that ingest OLTP tables into raw Parquet/DuckDB bronze objects.
- Add partitioning strategy (daily) and schedule definitions.
- Add lightweight data quality checks (row count > 0 for active users).

### Files/Areas
- `data_platform/dagster/*`
- `data_platform/storage/bronze/*`

### Done Criteria
- One scheduled run creates expected bronze artifacts.
- Pipeline can be re-run idempotently for the same partition.

## Phase 6 - Silver/Gold Transformations in dbt (Days 6-7)
### Changes
- Build Silver models for cleaned/typed/deduplicated transactional data.
- Build Gold marts:
  - `fct_transactions`
  - `dim_categories`
  - `mart_monthly_spend`
  - `mart_budget_vs_actual`
  - `mart_earnings_summary`
  - `mart_cashflow`
  - `mart_pay_cycle`
- Add dbt tests (not null, unique, accepted values, relationship tests).

### Files/Areas
- `data_platform/models/silver/*.sql`
- `data_platform/models/gold/*.sql`
- `data_platform/models/**/*.yml`

### Done Criteria
- `dbt run` and `dbt test` pass for DuckDB target.
- Gold models match expected numbers for sample users.

## Phase 7 - Analytics Serving API (Day 8)
### Changes
- Add `/api/analytics/*` routes in backend, reading from DuckDB Gold models.
- Keep transactional API separate from analytics API to avoid coupling.
- Add caching for heavy analytics queries where useful.

### Files/Areas
- `backend/src/routes/analytics.js` (new)
- `backend/src/index.js` (mount analytics router)
- `backend/package.json` (DuckDB dependency)

### Done Criteria
- New endpoints return expected payloads for summary, cashflow, monthly spend, budget vs actual, pay cycles, earnings.
- Existing `/api/transactions/*` remains functional.

## Phase 8 - Frontend Insights Experience (Day 9)
### Changes
- Create or update Insights page to consume `/api/analytics/*` endpoints.
- Keep Home/dashboard lightweight; route advanced analytics to `/insights`.
- Add loading/error states and empty-state UX.

### Files/Areas
- `frontend/src/pages/Insights.jsx` (or equivalent location)
- `frontend/src/api/*.js`
- `frontend/src/App.jsx`

### Done Criteria
- Insights page renders analytics successfully for authenticated users.
- Frontend gracefully handles API downtime or empty datasets.

## Phase 9 - Optional Internal Dashboard (Day 10)
### Changes
- Add Streamlit dashboard for internal/ops exploration (optional).
- Focus on debugging views, quality checks, and trend validation.

### Files/Areas
- `data_platform/dashboards/streamlit_app.py`

### Done Criteria
- Team can inspect core marts quickly without touching production UI.

## Phase 10 - CI/CD and Deployment Alignment (Days 11-12)
### Changes
- Add CI jobs for backend lint/tests, dbt run/test, and frontend build.
- Update deployment process for multi-surface system:
  - Frontend hosting
  - Backend API hosting
  - Postgres
  - Analytics jobs
- Document environment variables for all layers.

### Files/Areas
- `.github/workflows/*` (if using GitHub Actions)
- `docs/deployment-guide.md`
- `docs/developer-guide.md`

### Done Criteria
- CI validates all major surfaces on pull request.
- Deploy runbook is complete and reproducible.

## Phase 11 - Controlled Cutover and Cleanup (Day 13)
### Changes
- Route analytics UI and dashboards fully to Gold-backed endpoints.
- Remove or deprecate overlapping legacy summary logic.
- Keep feature flags for rollback during first production week.

### Files/Areas
- `backend/src/routes/transactions.js`
- `backend/src/routes/analytics.js`
- `frontend/src/*`

### Done Criteria
- No user-facing regression in transactional features.
- Analytics numbers align with dbt Gold sources.

## Suggested Branching Strategy
- `feature/auth-hardening`
- `feature/oltp-schema-expansion`
- `feature/data-platform-scaffold`
- `feature/dagster-bronze`
- `feature/dbt-silver-gold`
- `feature/analytics-api`
- `feature/insights-ui`
- `chore/cicd-deployment-updates`

## Testing Checklist per Phase
- API smoke tests for auth + core routes.
- Schema migration test on clean DB.
- dbt run + dbt test.
- End-to-end flow: login -> add transaction -> analytics visible in insights.

## Risks and Mitigation
- Risk: Breaking current transaction summary while migrating analytics.
  - Mitigation: Keep old summary path until `/api/analytics/*` is fully verified.
- Risk: Data mismatch between OLTP and Gold marts.
  - Mitigation: Add reconciliation checks in daily pipeline.
- Risk: Operational overhead from new services.
  - Mitigation: Start local-first (DuckDB + scheduled jobs), then scale to cloud warehouse only when needed.

## Definition of Complete Migration
- Auth enforcement is active for protected routes.
- OLTP schema additions are deployed and stable.
- Bronze/Silver/Gold pipeline runs daily with passing quality tests.
- Insights UI reads analytics APIs backed by Gold models.
- Documentation and deployment runbooks are updated.
