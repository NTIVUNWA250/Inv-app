# Inventory API

A small **Express** service that both the `web/` and `mobile/` apps talk to. It is the
single shared backend-for-frontend: clients never call Supabase directly anymore.

## Why it exists

- One place for auth + data logic shared by web and mobile (no more duplicated queries).
- Authorization is **not** re-implemented here. Every request is verified and then run
  through a Supabase client **scoped to the caller's JWT**, so the Row Level Security
  policies in [`../migrations/0001_profiles_and_inventory.sql`](../migrations/0001_profiles_and_inventory.sql)
  remain the single source of truth.

```
web / mobile  ──►  inventory-api (Express)  ──►  Supabase (Auth + Postgres/RLS)
```

## Setup

```bash
cd supabase/api
cp .env.example .env     # fill in SUPABASE_URL + SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:4000 (tsx watch)
```

| Variable            | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL`      | Project URL, e.g. `https://<ref>.supabase.co`                      |
| `SUPABASE_ANON_KEY` | Anon/publishable key (safe — every query is still user-scoped)     |
| `PORT`              | Listen port (default `4000`)                                       |
| `CORS_ORIGINS`      | Comma-separated allowed origins, or `*` (dev only)                 |

```bash
npm run build && npm start   # compile to dist/ and run with node
npm run typecheck            # tsc --noEmit
```

## Auth model

Clients send the Supabase **access token** as `Authorization: Bearer <jwt>`. The
`requireAuth` middleware verifies it, then attaches a user-scoped Supabase client to the
request. Auth endpoints (`/auth/*`) proxy to Supabase Auth so clients get their tokens
from this API rather than calling Supabase themselves.

## Endpoints

All routes except `/health` and the `/auth/*` entry points require a Bearer token.

### Health
- `GET /health`

### Auth
- `POST /auth/signup` — `{ email, password, full_name? }`
- `POST /auth/login` — `{ email, password }` → `{ user, session }`
- `POST /auth/refresh` — `{ refresh_token }` → `{ user, session }`
- `POST /auth/logout` — revokes the current session *(auth required)*
- `GET  /auth/me` — `{ user, profile }` *(auth required)*

### Profiles
- `GET   /profiles` — all profiles (to resolve display names in the log)
- `GET   /profiles/me`
- `PATCH /profiles/me` — `{ full_name }`

### Locations  *(writes are admin-only via RLS)*
- `GET /locations` · `GET /locations/:id`
- `POST /locations` — `{ name }`
- `PATCH /locations/:id` — `{ name? }`
- `DELETE /locations/:id`

### Items  *(writes are admin-only via RLS)*
- `GET /items?search=&limit=&offset=` · `GET /items/:id`
- `GET /items/:id/stock` — per-location stock for one item
- `POST /items` — `{ name, sku?, description? }`
- `PATCH /items/:id` · `DELETE /items/:id`

### Stock
- `GET /stock?item_id=&location_id=` — current levels, item + location joined in

### Movements (check-out / check-in log)
- `GET /movements?item_id=&location_id=&user_id=&mine=&limit=&offset=` — activity log
- `POST /movements` — `{ item_id, location_id, delta, note? }` (negative = out, positive = in)
- `POST /movements/check-out` — `{ item_id, location_id, quantity, note? }`
- `POST /movements/check-in` — `{ item_id, location_id, quantity, note? }`

The Postgres trigger keeps `item_stock` in sync on every movement insert.

## Error shape

```json
{ "error": { "message": "human readable", "code": "machine_code" } }
```

RLS denials map to `403`, unique violations to `409`, check violations (e.g. stock would
go negative) to `422`, and validation failures to `422` with a `details` field.
