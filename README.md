# Expense Tracker

Backend-first budget tracker with Express API and vanilla JS frontend.

## Features
- Add/delete entries (income and expense)
- Manage sections and categories
- Budget/actual/difference calculations on the backend
- Monobank exchange rates fetched and cached on the backend
- Storage driver support:
  - JSON file (`STORAGE_DRIVER=json`)
  - Postgres (`STORAGE_DRIVER=postgres`)

## Run (local JSON mode)
1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open dashboard:
   - [http://localhost:3000/index.html](http://localhost:3000/index.html)

## Postgres mode
- Set env vars:
  - `STORAGE_DRIVER=postgres`
  - `DATABASE_URL=<postgres connection string>`
- Start app:
  - `npm start`

## Migrate JSON state to Postgres
- One-time command:
  - `npm run migrate:json-to-pg`
- Requires `DATABASE_URL` env var.
- Safe to rerun (idempotent full-state sync).

## API
- `GET /healthz`
- `GET /api/bootstrap?year=YYYY&month=MM`
- `POST /api/entries`
- `DELETE /api/entries/:id`
- `PATCH /api/categories/:id/budget`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
- `POST /api/sections`
- `DELETE /api/sections/:id`
- `GET /api/exchange-rates`
- `POST /api/exchange-rates/refresh`

## Render deployment
- `render.yaml` is included with:
  - web service (`npm install` / `npm start`)
  - health check: `/healthz`
  - Postgres database and `DATABASE_URL` wiring

## Tests
- `npm test` (or run test files directly in restricted environments)
