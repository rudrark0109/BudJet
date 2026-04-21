# The BudJet Story

## Where It Started

BudJet started as a weekend project born out of a simple frustration: every budgeting app I tried was either too complex, too opinionated, or locked behind a subscription. I wanted something that felt mine — no ads, no upsells, no dark patterns nudging me toward premium tiers.

The first version was as basic as it gets. A React frontend, an Express backend, and a PostgreSQL database. You could log a transaction, pick a category, and see a summary. That was it. It did the job.

But "doing the job" changed over time.

---

## The Problem With Simple

The moment you have a few months of data, a simple CRUD app stops being enough. You stop asking *"what did I spend yesterday?"* and start asking harder questions:

- Is my spending trending up or down?
- Which categories keep creeping past budget?
- I work two part-time jobs — how much should I expect on my next paycheck?
- Am I actually saving anything this month?

These aren't transaction questions. They're analytics questions. And wedging them into a transactional SQL database — with ever-growing `GROUP BY` queries stuffed into route handlers — is the path to a mess no one wants to maintain.

---

## The Shift Tracking Problem

The second turning point came from real life. I started working hourly shifts at two places simultaneously, with semi-monthly payouts — once on the 16th, once on the 1st of the next month. Tracking expected earnings in a spreadsheet felt like a step backward.

So the shift tracker became part of BudJet. Clock in. Clock out. Edit times if you forgot. See your expected payout split by fortnight. When the salary lands, hit one button and it records as income — your balance updates, your earnings history grows.

It sounds small. It changed how I use the app every day.

---

## The Architecture Decision

At some point the codebase reached a fork in the road: keep bolting analytics onto the OLTP layer, or build it right.

The right way is a **medallion data pipeline**:

- **Bronze** — raw data extracted from Postgres, immutable, timestamped
- **Silver** — cleaned, typed, deduplicated, contracted with dbt tests
- **Gold** — business-facing marts: spend by category, budget vs actual, cashflow, pay cycles, earnings summaries

The write path stays in Postgres — ACID, fast, reliable. The read-for-insight path moves to DuckDB + dbt, portable across local and cloud (BigQuery) targets without changing a line of SQL.

Dagster orchestrates everything. Assets map to tables. Lineage is visible. Backfills are one click. The pipeline runs on a schedule, or on demand.

---

## The Vision

BudJet is becoming a full data platform that happens to look like a personal finance app:

- **ML layer** — transaction auto-categorization, spend forecasting, anomaly detection
- **NL-to-SQL** — ask "how much did I spend on food last quarter?" and get an answer, powered by Claude and protected by a query parser
- **Receipt OCR** — photograph a receipt, have it logged automatically
- **Insights page** — Recharts dashboards consuming Gold mart APIs, no second UI to learn

Every milestone is a self-contained deliverable. Each one adds something useful now and something impressive on a resume later.

---

## The Philosophy

Two principles have guided every decision:

**1. The write path is sacred.** Adding a transaction, starting a shift, setting a budget — these must always work. Fast, simple, reliable. No analytics complexity bleeds into the operational layer.

**2. The app is the analytics surface.** There's no separate BI tool for users to learn. The React app is where insights live. The data platform is the engine room, invisible to the user but essential to what the app can answer.

---

## Where Things Stand

The foundation is solid. Auth is enforced end-to-end. The shift tracker is live. The schema is expanded. The architecture plan is written and phased.

The data platform is next.

Every phase from here is additive. Nothing breaks. Each step makes the app smarter, the data richer, and the resume stronger.

That's the story so far.
