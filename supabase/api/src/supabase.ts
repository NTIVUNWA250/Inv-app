import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * A bare anon client. Used only for auth flows that don't have a user yet
 * (sign up, log in, refresh) and for verifying access tokens.
 */
export const anon: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Build a Supabase client scoped to a specific user's access token.
 *
 * Every data request goes through one of these, which means the JWT is sent
 * to PostgREST on every query and Row Level Security policies are enforced by
 * Postgres exactly as they are for the clients talking to Supabase directly.
 * The API therefore never has to re-implement (and risk diverging from) the
 * authorization rules in the migration.
 */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Revoke a refresh token via the GoTrue logout endpoint. supabase-js's
 * signOut() relies on a persisted session, which we deliberately don't keep on
 * the server, so we call the endpoint directly with the user's access token.
 */
export async function revokeSession(accessToken: string): Promise<void> {
  await fetch(`${env.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
