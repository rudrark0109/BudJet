# BudJet

Budgeting web app with React/Vite frontend and Express/PostgreSQL backend. Firebase handles user auth. Built to track my own expenses; I’ll also mirror a version in Notion, but this site is for anyone who prefers a lightweight web app instead of using Notion.

## Stack
- Frontend: React 18, Vite, Tailwind, React Router, Firebase client SDK.
- Backend: Node 18+, Express, PostgreSQL (pg), dotenv, cors, firebase-admin (reserved for token verification).

## Quick Start
```
# Backend
cd backend
npm install
# create backend/.env with PG_* vars, CORS_ORIGIN, PORT
npm run dev            # http://localhost:5000

# Frontend
cd ../frontend
npm install
# create frontend/.env.local with VITE_API_URL and Firebase keys
npm run dev            # http://localhost:5173
```
Apply the schema to your Postgres instance:
```
psql "$CONNECTION_STRING" -f backend/schema.sql
```
Default categories seed on first user registration via /api/auth/register.

## Scripts
- Backend: npm run dev, npm start
- Frontend: npm run dev, npm run build, npm run preview

## Docs
- Developer guide: docs/developer-guide.md
- Deployment guide: docs/deployment-guide.md

## Health Checks
- Backend: /health (app) and /api/test-db (DB)

## Usage / License
Copyright (c) 2025 Rudraksha (rudrark0109). All rights reserved. Viewing the source is allowed; copying, modifying, or redistributing any part of this project requires my prior written consent.
