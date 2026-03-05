# Expense Tracker

Backend-first budget tracker with Express API and vanilla JS frontend.

## Features
- Add/delete entries (income and expense)
- Manage sections and categories
- Budget/actual/difference calculations on the backend
- Monobank exchange rates fetched and cached on the backend
- JSON-file persistence via repository interface (DB-ready)

## Run
1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open dashboard:
   - [http://localhost:3000/index.html](http://localhost:3000/index.html)

## API
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

## Tests
- `npm test`
