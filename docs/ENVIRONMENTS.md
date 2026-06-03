# Environments: test & prod

Test and prod run against **one** Supabase project, isolated by Postgres schema:

| | Schema | API port | Web port | Data |
|---|---|---|---|---|
| **prod** | `public` | 4000 | 3000 | the real data (unchanged) |
| **test** | `test`   | 4001 | 3001 | a copy created by migration `0008` |

Auth (`auth.users`) is project-wide, so **both environments share the same login
accounts**. Each schema keeps its own `profiles` row per user, so a user's
role/blocked status is independent between test and prod.

> ⚠️ Shared database, schema-isolated data. A test write can never touch a prod
> row, but the two are still in the same project — there is no separate billing,
> separate auth, or separate backups. For hard isolation you'd need a second
> Supabase project.

---

## One-time Supabase setup (required before test works)

These two steps need the Supabase dashboard / DB credentials — they can't be done
from the API keys alone.

**1. Create the `test` schema** — run `supabase/migrations/0008_test_schema.sql`:
   - Dashboard → **SQL Editor** → paste the file → **Run**, _or_
   - CLI (if linked with the DB password):
     `supabase db execute --file supabase/migrations/0008_test_schema.sql`

   This recreates every table/function/trigger/RLS policy in a `test` schema and
   copies the current prod data in as a starting snapshot. (Comment out the final
   "Initial data snapshot" block in the SQL to start test empty instead.)

**2. Expose the schema to the Data API** — Dashboard → **Project Settings → API →
   Exposed schemas** → add **`test`** (alongside `public`, `graphql_public`).
   PostgREST returns 404 for every test query until this is set.

---

## Running

### API (`supabase/api/`)
Shared secrets stay in `.env`. `PORT` / `DB_SCHEMA` / `CORS_ORIGINS` are overridden
per environment by `.env.production` and `.env.test`, selected with `APP_ENV`.

```bash
npm run build         # once, then:
npm run start:prod    # public schema, :4000   (== npm start)
npm run start:test    # test schema,   :4001
# dev (tsx watch): npm run dev:prod / npm run dev:test
```

### Web (`web/`)
Same build, the start script points it at the matching API and port.

```bash
npm run build
npm run start:prod    # -> API :4000, serves :3000
npm run start:test    # -> API :4001, serves :3001
# dev: npm run dev:prod / npm run dev:test
```

### Mobile (`mobile/`)
Pick the API at launch with `--dart-define` (overrides the bundled `.env`).
Remember to forward the matching port to the emulator.

```bash
# prod (default):
flutter run -d emulator-5554

# test:
adb reverse tcp:4001 tcp:4001
flutter run -d emulator-5554 --dart-define=API_URL=http://10.0.2.2:4001
```

---

## How the switch works (no new dependencies)

- **API** — `src/env.ts` loads `.env`, then layers `.env.$APP_ENV` on top
  (`override: true`). `DB_SCHEMA` is passed as `db: { schema }` to every
  Supabase client in `src/supabase.ts`, so all `.from(...)` queries hit the
  chosen schema.
- **Web** — `process.env` wins over `.env*` in Next's load order, so the inline
  `API_URL=...` in each `start:*` / `dev:*` script selects the API. (Server-side
  reads are in `src/lib/api/server.ts` and `src/lib/session-middleware.ts`.)
- **Mobile** — `lib/config/api_client.dart` prefers a compile-time
  `String.fromEnvironment('API_URL')`, falling back to `.env`, then the
  `10.0.2.2:4000` emulator default.
