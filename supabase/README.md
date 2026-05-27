# Supabase

Database schema, auth config, and Row Level Security (RLS) policies for the Inventory app. Used by both `web/` and `mobile/`.

## Prerequisites

Install the Supabase CLI: https://supabase.com/docs/guides/cli/getting-started

## First-time setup

```bash
cd supabase

# Generate the standard config.toml + .gitignore + seed.sql layout
supabase init

# Start the local Supabase stack (Postgres + Auth + Storage in Docker)
supabase start
```

`supabase start` prints out the local `API URL` and `anon key` — copy them into:

- [`web/.env.local`](../web/.env.example)
- [`mobile/.env`](../mobile/.env.example)

## Applying migrations

Migrations in [migrations/](migrations/) are SQL files run in order. Apply them to your local stack with:

```bash
supabase db reset    # wipes + reapplies all migrations + seed.sql
```

To create a new migration:

```bash
supabase migration new <name>
```

## Pushing to a hosted Supabase project

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Layout

```
supabase/
├── config.toml          Created by `supabase init` — local stack settings
├── seed.sql             Created by `supabase init` — optional seed data
├── migrations/
│   └── 0001_profiles_and_inventory.sql   Initial schema
└── README.md
```

## Schema overview

- `public.profiles` — extends `auth.users` with display name + role
- `public.locations` — physical stock locations (stockroom, lab A, etc.)
- `public.items` — catalog of items, total quantity per location
- `public.stock_movements` — append-only log of check-outs / check-ins (who, what, when, how many)

All tables have RLS enabled. See the migration for policy details.
