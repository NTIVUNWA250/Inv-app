import { Router } from "express";
import { z } from "zod";
import { service } from "../supabase.js";
import { asyncHandler, HttpError } from "../http.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

function requireService() {
  if (!service) {
    throw new HttpError(
      501,
      "User management is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the API.",
      "service_role_missing",
    );
  }
  return service;
}

const createBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().trim().optional(),
  role: z.enum(["member", "admin"]).default("member"),
});

/** Create a new account by email (admin only). Confirms the email immediately. */
usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const svc = requireService();
    const { email, password, full_name, role } = createBody.parse(req.body);

    const { data, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? "" },
    });
    if (error) throw new HttpError(400, error.message, "create_user_failed");

    // The on_auth_user_created trigger inserts the profile; promote if needed.
    if (role === "admin" && data.user) {
      const { error: roleErr } = await svc
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", data.user.id);
      if (roleErr) throw roleErr;
    }

    res.status(201).json({ user: data.user });
  }),
);

/** Delete an account (admin only). Cascades to the profile row. */
usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const svc = requireService();
    if (req.params.id === req.user.id) {
      throw new HttpError(400, "You can't delete your own account.", "cannot_delete_self");
    }

    const { error } = await svc.auth.admin.deleteUser(req.params.id);
    if (error) throw new HttpError(400, error.message, "delete_user_failed");

    res.status(204).send();
  }),
);
