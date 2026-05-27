# Architecture

```
┌────────────────┐        ┌────────────────┐
│  Web (Next.js) │        │ Mobile (Flutter)│
│  TypeScript +  │        │  Android + iOS  │
│  Tailwind      │        │                 │
└────────┬───────┘        └────────┬────────┘
         │                         │
         │  @supabase/ssr          │  supabase_flutter
         │  (cookies-based auth)   │  (secure storage)
         │                         │
         └─────────┬───────────────┘
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

## Auth flow

1. User signs in via login form (web or mobile) → Supabase returns a JWT session.
2. Web: session is stored in cookies via `@supabase/ssr`; the Next.js `proxy.ts` refreshes it on every request and gates protected routes.
3. Mobile: `supabase_flutter` persists the session in secure storage; `_AuthGate` in `main.dart` listens to `onAuthStateChange` to swap between login and home.
4. New signups trigger the `on_auth_user_created` Postgres trigger, which auto-creates a `public.profiles` row.

## Data model

- **profiles** — display name + role (`member` / `admin`), one row per auth user.
- **locations** — physical places stock lives.
- **items** — catalog (sku, name, description).
- **item_stock** — current quantity per `(item, location)`; updated by trigger.
- **stock_movements** — append-only log: `(item, location, user, delta, note, created_at)`. Negative delta = checked out; positive = checked in. The "who took what" view is just a query against this table.

## Authorization

All tables enable RLS:
- Any authenticated user can **read** items, locations, stock, movements, and profiles.
- Any authenticated user can **insert** their own stock movement (the trigger then updates `item_stock`).
- Only **admins** (profiles.role = 'admin') can create/edit/delete items and locations.
- Users can only update their own profile.

To promote a user to admin, run from the SQL editor:
```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```
