# Architecture

```
┌────────────────┐        ┌─────────────────┐
│  Web (Next.js) │        │ Mobile (Flutter)│
│  TypeScript +  │        │  Android + iOS  │
│  Tailwind      │        │                 │
└────────┬───────┘        └────────┬────────┘
         │  fetch (server-side)     │  http
         │  Bearer <jwt>            │  Bearer <jwt>
         └─────────┬────────────────┘
                   ▼
         ┌──────────────────────┐
         │  inventory-api        │   Express + TypeScript
         │  (supabase/api)       │   verifies JWT, runs every
         │                       │   query as the calling user
         └──────────┬───────────┘
                    │  user-scoped supabase-js client
                    ▼
         ┌──────────────────────┐
         │      Supabase        │
         │  ┌────────────────┐  │
         │  │  Auth          │  │  email / password
         │  ├────────────────┤  │
         │  │  Postgres      │  │  profiles, locations,
         │  │  + RLS         │  │  items, item_stock,
         │  │                │  │  stock_movements
         │  └────────────────┘  │
         └──────────────────────┘
```

Both clients talk **only** to `inventory-api` — they no longer use the Supabase
SDKs directly. The API is a thin shared backend-for-frontend: it proxies auth to
Supabase and runs all data queries through a Supabase client **scoped to the
caller's JWT**, so the Row Level Security policies in the migration remain the
single source of truth for authorization. See [`../supabase/api/README.md`](../supabase/api/README.md).

## Auth flow

1. User submits the login form (web) or login screen (mobile).
2. The client calls `POST /auth/login` on the API, which calls Supabase Auth and
   returns the session (`access_token` + `refresh_token`).
3. **Web** stores the tokens in httpOnly cookies (`web/src/lib/session.ts`). The
   `proxy.ts` proxy validates the access token on every request, refreshes it via
   `POST /auth/refresh` shortly before expiry, and gates protected vs. auth routes.
   All API calls happen server-side (`web/src/lib/api/server.ts`) so tokens stay httpOnly.
4. **Mobile** stores the tokens in secure storage (`mobile/lib/config/api_client.dart`)
   and attaches the Bearer token to every request, auto-refreshing once on a 401.
   `ApiClient.isAuthenticated` drives the `_AuthGate` in `main.dart`.
5. Sign out calls `POST /auth/logout` to revoke the session, then clears local tokens.
6. New signups still trigger the `on_auth_user_created` Postgres trigger, which
   auto-creates a `public.profiles` row.

> **Note:** OAuth / email-confirmation PKCE exchange is not routed through the API
> yet (email + password only). The web `/auth/callback` route just redirects to login.

## Data model

- **profiles** — display name + role (`member` / `admin`), one row per auth user.
- **locations** — physical places stock lives.
- **items** — catalog (sku, name, description).
- **item_stock** — current quantity per `(item, location)`; updated by trigger.
- **stock_movements** — append-only log: `(item, location, user, delta, note, created_at)`. Negative delta = checked out; positive = checked in. The "who took what" view is just a query against this table.

## Authorization

All tables enable RLS, enforced by Postgres on every API query (the API does not
re-implement these rules):
- Any authenticated user can **read** items, locations, stock, movements, and profiles.
- Any authenticated user can **insert** their own stock movement (the trigger then updates `item_stock`).
- Only **admins** (profiles.role = 'admin') can create/edit/delete items and locations.
  The API surfaces RLS denials as `403`.
- Users can only update their own profile.

To promote a user to admin, run from the SQL editor:
```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```
