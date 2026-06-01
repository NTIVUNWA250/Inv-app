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

const blockBody = z.object({ blocked: z.boolean() });

/**
 * Block or unblock an account (admin only). Reversible. The profiles.blocked
 * flag is checked in requireAuth, so a blocked user is denied on their very next
 * request. If the service-role key is configured we also ban/unban the user in
 * GoTrue as defense in depth (revokes their refresh token immediately); without
 * it, the requireAuth check alone still enforces the block through this API.
 */
usersRouter.patch(
  "/:id/block",
  asyncHandler(async (req, res) => {
    const { blocked } = blockBody.parse(req.body);
    if (req.params.id === req.user.id) {
      throw new HttpError(400, "You can't block your own account.", "cannot_block_self");
    }

    // Persist the flag. RLS (profiles_update_admin) + the block trigger allow an
    // admin to do this through their own scoped client.
    const { data, error } = await req.supabase
      .from("profiles")
      .update({ blocked })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Best effort: also reflect the block in GoTrue when we can.
    if (service) {
      await service.auth.admin.updateUserById(req.params.id, {
        ban_duration: blocked ? "876000h" : "none", // ~100 years / lift ban
      });
    }

    res.json(data);
  }),
);

const updateUserBody = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  })
  .refine(
    (b) => b.full_name !== undefined || b.email !== undefined || b.password !== undefined,
    { message: "Provide a name, email, or password to update." },
  );

/**
 * Update another user's account (admin only): display name, email, and/or
 * password — handy when something is wrong on the user's side and they can't fix
 * it themselves. Email and password live on the auth.users record and go through
 * the GoTrue admin API (service-role key required); full_name lives on the
 * profiles row. The email is auto-confirmed and a password change takes effect
 * immediately, suitable for this internal, admin-managed tool. At least one
 * field must be provided.
 */
usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const svc = requireService();
    const body = updateUserBody.parse(req.body);

    if (req.params.id === req.user.id) {
      throw new HttpError(
        400,
        "Use Settings to change your own account.",
        "cannot_edit_self",
      );
    }

    if (body.email !== undefined || body.password !== undefined) {
      const { error } = await svc.auth.admin.updateUserById(req.params.id, {
        ...(body.email !== undefined ? { email: body.email, email_confirm: true } : {}),
        ...(body.password !== undefined ? { password: body.password } : {}),
      });
      if (error) throw new HttpError(400, error.message, "update_user_failed");
    }

    // full_name lives on the profile row. The service client bypasses RLS; this
    // route is already gated by requireAdmin so an admin can edit any user.
    if (body.full_name !== undefined) {
      const { error } = await svc
        .from("profiles")
        .update({ full_name: body.full_name })
        .eq("id", req.params.id);
      if (error) throw error;
    }

    const { data, error } = await svc
      .from("profiles")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    res.json({ ...data, ...(body.email !== undefined ? { email: body.email } : {}) });
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
