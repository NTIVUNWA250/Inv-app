# Deploying to Railway

Two services from this one monorepo, plus the already-hosted Supabase project
(nothing to deploy for the database — it lives on supabase.com).

| Service | Root directory  | Builds with        | Public URL used by |
| ------- | --------------- | ------------------ | ------------------ |
| `api`   | `supabase/api`  | `railway.json`     | the `web` service  |
| `web`   | `web`           | `railway.json`     | end users (browser)|

The browser only ever talks to `web`; `web` calls `api` server-side via
`API_URL`. So `api` can even stay private, but the steps below give it a public
domain for simplicity (and so the mobile app can reach it later).

## One-time setup (Railway dashboard)

1. **New Project → Deploy from GitHub repo** → pick `NTIVUNWA250/Inventory-app`,
   branch **`main`**.
2. This creates one service. Open it → **Settings**:
   - **Service name:** `api`
   - **Root Directory:** `supabase/api`
   - Railway reads `supabase/api/railway.json` automatically (build + start +
     `/health` check).
3. **+ New → GitHub Repo** (same repo) to add the second service → **Settings**:
   - **Service name:** `web`
   - **Root Directory:** `web`
4. On **each** service, **Settings → Networking → Generate Domain** to get a
   public `*.up.railway.app` URL.

## Variables

### `api` service  (Variables tab)
Copy the values from your local `supabase/api/.env`:

| Variable                    | Value                                             |
| --------------------------- | ------------------------------------------------- |
| `SUPABASE_URL`              | from `.env`                                        |
| `SUPABASE_ANON_KEY`         | from `.env`                                        |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env` (needed for admin user create/delete)  |
| `DB_SCHEMA`                 | `public`                                           |
| `CORS_ORIGINS`              | the `web` public URL (or `*` while testing)        |

Do **not** set `PORT` — Railway injects it and the API reads `process.env.PORT`.

### `web` service  (Variables tab)

| Variable  | Value                                                 |
| --------- | ----------------------------------------------------- |
| `API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}`              |

The `${{api.*}}` reference auto-resolves to the `api` service's domain — no need
to hard-code it. Don't set `PORT` (Railway injects it; `next start` honors it).

## Deploys

Every push to `main` rebuilds both services. To redeploy manually, use each
service's **Deploy** button.

## Verify

- `https://<api-domain>/health` → `{"status":"ok","service":"inventory-api"}`
- `https://<web-domain>/` → redirects to `/login`
