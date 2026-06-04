import { config as loadDotenv } from "dotenv";

// Base secrets (Supabase URL/keys) live in `.env` and are shared by every
// environment. When APP_ENV is set (e.g. `APP_ENV=test`), the matching
// `.env.<APP_ENV>` file is layered on top and overrides PORT / DB_SCHEMA /
// CORS_ORIGINS for that environment. With APP_ENV unset, behaviour is
// unchanged: just `.env` (which defaults to the prod schema on port 4000).
loadDotenv();
if (process.env.APP_ENV) {
  loadDotenv({ path: `.env.${process.env.APP_ENV}`, override: true });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy supabase/api/.env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  // Optional. Required only for admin user management (create/delete accounts).
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
  // Postgres schema the Data API reads/writes. "public" = prod, "test" = the
  // isolated copy created by migration 0008. Same project either way.
  dbSchema: process.env.DB_SCHEMA?.trim() || "public",
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
