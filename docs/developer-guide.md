# BudJet Developer Guide

## Stack and Layout
- Backend: Node 18+, Express, PostgreSQL (pg), dotenv, cors, firebase-admin (reserved for token verification), entry at backend/src/index.js
- Frontend: React 18, Vite, Tailwind, React Router, Firebase client auth; entry at frontend/src/main.jsx
- Key routes: backend/src/routes/{auth,categories,transactions,budgets}.js
- Database schema: backend/schema.sql

## Prerequisites
- Node.js 18 or newer
- PostgreSQL 14+ reachable from your machine
- npm
- (Optional) psql CLI for applying schema

## Environment Variables
Create backend/.env:
```
PORT=5000
CORS_ORIGIN=http://localhost:5173
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=budjet
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_SSL=false
```

Create frontend/.env.local (Vite loads VITE_*):
```
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## Setup
1) Install dependencies
```
cd backend && npm install
cd ../frontend && npm install
```
2) Provision PostgreSQL database and user matching backend env vars.
3) Apply schema
```
psql "$CONNECTION_STRING" -f backend/schema.sql
```
(Seed categories happen automatically on first user registration via auth route.)

## Running Locally
- Backend
```
cd backend
npm run dev
# listens on PORT (default 5000)
```
- Frontend
```
cd frontend
npm run dev
# Vite dev server on 5173 by default
```

## API Quick Reference
Base URL: `${VITE_API_URL}` (frontend) or `http://localhost:5000` in dev.
- Auth
  - POST /api/auth/register { uid, email, displayName } → upserts user; seeds default categories for new users
  - POST /api/auth/login { uid } → verifies user exists
  - GET /api/auth/user/:uid → returns profile
- Categories
  - GET /api/categories/:userId
  - POST /api/categories { user_id, name, type, color? }
- Transactions
  - GET /api/transactions/:userId (last 50)
  - POST /api/transactions { user_id, category_id?, amount, description?, type, transaction_date? }
  - GET /api/transactions/summary/:userId → summary + category breakdown + trend + pay-cycle savings
- Budgets
  - GET /api/budgets/:userId
  - POST /api/budgets { user_id, category_id, amount, month }
- Health
  - GET /health
  - GET /api/test-db (checks DB connectivity)

Example curl (create transaction):
```
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uid>","amount":42,"type":"expense","description":"Lunch"}'
```

## Frontend Notes
- API client base URL in frontend/src/api/client.js uses VITE_API_URL.
- Firebase config lives in frontend/src/firebase.js; auth UID is stored in localStorage as `uid`.
- Data fetching endpoints assume authenticated UID is provided in payload/params; there is no JWT enforcement in backend yet.

## Database Notes
- See backend/schema.sql for tables: users, categories, transactions, budgets.
- Default categories are inserted for a new user during POST /api/auth/register.

## Coding Conventions
- Backend uses ES modules and async/await; prefer parameterized queries via pg Pool.
- Keep CORS_ORIGIN aligned with deployed frontend.
- Add new routes under backend/src/routes and mount in backend/src/index.js.

## When Adding Features
- Update API docs here and in deployment guide if env vars change.
- Consider adding migrations if schema evolves; currently schema.sql is the source of truth.
- If enforcing auth, wire firebase-admin token verification middleware before routes.

## Quick Smoke Checklist
- /health returns ok
- /api/test-db returns connected
- Register/login flow works and seeds categories
- Transactions create/read works and summary aggregates look reasonable
