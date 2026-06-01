import { Router } from "express";
import { z } from "zod";
import { anon, revokeSession } from "../supabase.js";
import { env } from "../env.js";
import { asyncHandler, HttpError } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupBody = credentials.extend({
  full_name: z.string().trim().min(1).optional(),
});

/** Create a new account. Returns the session if email confirmation is disabled. */
authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = signupBody.parse(req.body);

    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: { data: { full_name: full_name ?? "" } },
    });
    if (error) throw new HttpError(400, error.message, "signup_failed");

    res.status(201).json({ user: data.user, session: data.session });
  }),
);

/** Email/password sign in. Returns the Supabase session (access + refresh tokens). */
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);

    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error) throw new HttpError(401, error.message, "invalid_credentials");

    res.json({ user: data.user, session: data.session });
  }),
);

/** Exchange a refresh token for a fresh session. */
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refresh_token } = z.object({ refresh_token: z.string().min(1) }).parse(req.body);

    const { data, error } = await anon.auth.refreshSession({ refresh_token });
    if (error) throw new HttpError(401, error.message, "refresh_failed");

    res.json({ user: data.user, session: data.session });
  }),
);

/** Revoke the current session. */
authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSession(req.accessToken);
    res.status(204).send();
  }),
);

/**
 * Change the signed-in user's password. Verifies the current password first
 * (re-authenticating with the anon client), then updates it through GoTrue
 * using the caller's own access token — no service-role key required.
 */
const changePasswordBody = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6),
});

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = changePasswordBody.parse(req.body);

    if (!req.user.email) {
      throw new HttpError(400, "This account has no email to verify against.", "no_email");
    }

    const { error: verifyError } = await anon.auth.signInWithPassword({
      email: req.user.email,
      password: current_password,
    });
    if (verifyError) {
      throw new HttpError(400, "Current password is incorrect.", "invalid_current_password");
    }

    const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${req.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: new_password }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { msg?: string; error_description?: string };
      throw new HttpError(
        400,
        body.msg ?? body.error_description ?? "Could not change password.",
        "change_password_failed",
      );
    }

    res.status(204).send();
  }),
);

/** Current user + their profile row. */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: profile, error } = await req.supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error) throw error;

    res.json({ user: req.user, profile });
  }),
);
