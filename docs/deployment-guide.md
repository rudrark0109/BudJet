# BudJet Deployment Guide

Audience: cloud operator deploying API (Express + PostgreSQL) and SPA (Vite/React with Firebase Auth).

## Components
- Backend: Node/Express in backend/, exposes /api and /health on PORT (default 5000).
- Database: PostgreSQL; schema in backend/schema.sql.
- Frontend: Vite-built static assets in frontend/dist served by any static host or CDN.

## Pre-Deployment Checklist
- Choose environment: dev/stage/prod with distinct Postgres instances.
- Create secrets for backend and frontend env vars.
- Allow outbound network from API to Postgres; open API port only to frontend/edge.
- Decide on TLS: set PG_SSL=true when using managed Postgres with SSL.

## Environment Variables
Backend (.env on server):
| Name | Required | Description |
| --- | --- | --- |
| PORT | no | API port (default 5000) |
| CORS_ORIGIN | yes | Deployed frontend origin (e.g., https://app.example.com) |
| PG_HOST | yes | Postgres host |
| PG_PORT | no | Postgres port (default 5432) |
| PG_DATABASE | yes | Database name |
| PG_USER | yes | Database user |
| PG_PASSWORD | yes | Database password |
| PG_SSL | no | true/false; true for managed SSL (rejectUnauthorized=false) |

Frontend (.env.production or host-specific secrets):
| Name | Required | Description |
| --- | --- | --- |
| VITE_API_URL | yes | Public API base URL (e.g., https://api.example.com) |
| VITE_FIREBASE_API_KEY | yes | Firebase web API key |
| VITE_FIREBASE_AUTH_DOMAIN | yes | Firebase auth domain |
| VITE_FIREBASE_PROJECT_ID | yes | Firebase project id |
| VITE_FIREBASE_STORAGE_BUCKET | no | Firebase storage bucket |
| VITE_FIREBASE_MESSAGING_SENDER_ID | no | Messaging sender id |
| VITE_FIREBASE_APP_ID | yes | Firebase app id |
| VITE_FIREBASE_MEASUREMENT_ID | no | GA measurement id |

## Database Provisioning
1) Create Postgres instance and user with privileges on target database.
2) Apply schema
```
psql "$CONNECTION_STRING" -f backend/schema.sql
```
3) No manual seed needed; default categories are created when a user registers via /api/auth/register.

## Backend Deployment Steps (generic Linux host)
1) Upload source or build artifact for backend/.
2) Create backend/.env with values above.
3) Install dependencies
```
cd backend
npm ci
```
4) Start with a process manager (systemd/pm2). Example with npm:
```
npm run start
```
5) Expose only PORT through reverse proxy (nginx/ALB); ensure HTTPS termination.
6) Health checks: GET /health (app up) and /api/test-db (DB connectivity).

## Frontend Deployment Steps
1) Build assets
```
cd frontend
npm ci
npm run build
```
2) Deploy frontend/dist to static hosting (S3+CloudFront, Vercel static, Netlify, Nginx). Ensure VITE_API_URL points to live API before building.
3) If hosting behind CDN, configure caching for static files and ensure SPA fallback to index.html.

## CORS and Origins
- Set CORS_ORIGIN on backend to the deployed frontend origin; for multiple origins, use a comma-separated list or adjust middleware to an allowlist.
- Ensure the frontend uses HTTPS and the API endpoint matches VITE_API_URL.

## Logging and Monitoring
- Stdout logs from node; hook into your log shipper (e.g., CloudWatch, ELK).
- Track 5xx rates; alert on repeated DB connection errors or auth failures.

## Troubleshooting
- CORS errors: confirm CORS_ORIGIN matches the browser origin exactly (scheme + host + port).
- DB connection errors: verify security group/firewall, PG_SSL value, and credentials; test /api/test-db.
- 404 on API: ensure reverse proxy routes /api/* to backend and does not cache 404s.
- Firebase auth issues: confirm frontend Firebase config matches the Firebase project; ensure sign-in providers are enabled.

## Release Notes / Versioning
- Tag backend/frontend releases together; record changes in CHANGELOG.md.
- On schema changes, add migration steps and apply before deploying new API code.
