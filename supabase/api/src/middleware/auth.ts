import type { Request, Response, NextFunction } from "express";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { anon, userClient } from "../supabase.js";
import { HttpError } from "../http.js";

// Augment Express's Request with the authenticated user + their scoped client.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User;
      supabase: SupabaseClient;
      accessToken: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Require a valid Supabase access token. Verifies the JWT, then attaches:
 *  - req.user        the authenticated user
 *  - req.supabase    a Supabase client scoped to that user (RLS applies)
 *  - req.accessToken the raw token (for logout, etc.)
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) {
      throw new HttpError(401, "Missing or malformed Authorization header.", "no_token");
    }

    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) {
      throw new HttpError(401, "Invalid or expired session.", "invalid_token");
    }

    req.user = data.user;
    req.accessToken = token;
    req.supabase = userClient(token);
    next();
  } catch (err) {
    next(err);
  }
}
