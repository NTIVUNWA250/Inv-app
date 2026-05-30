import { config as loadDotenv } from "dotenv";

loadDotenv();

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
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
