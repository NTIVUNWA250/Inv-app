import { Router } from "express";
import { z } from "zod";
import { service } from "../supabase.js";
import { asyncHandler, HttpError } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const profilesRouter = Router();

profilesRouter.use(requireAuth);

/** List all profiles (used to show display names in the activity log). */
profilesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw error;
    res.json(data);
  }),
);

/** The current user's profile. */
profilesRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  }),
);

/**
 * Update the current user's own account: display name and/or email.
 *
 * full_name lives on the profiles row (RLS only allows updating your own).
 * Email lives on the auth.users record, which can only be changed through the
 * admin API, so it requires the service-role key. The change is applied
 * immediately (email auto-confirmed) — suitable for this internal, admin-managed
 * tool. At least one field must be provided.
 */
const updateMeBody = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((b) => b.full_name !== undefined || b.email !== undefined, {
    message: "Provide a name or an email to update.",
  });

profilesRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const body = updateMeBody.parse(req.body);

    if (body.email !== undefined) {
      if (!service) {
        throw new HttpError(
          501,
          "Changing email is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the API.",
          "service_role_missing",
        );
      }
      const { error: emailErr } = await service.auth.admin.updateUserById(req.user.id, {
        email: body.email,
        email_confirm: true,
      });
      if (emailErr) throw new HttpError(400, emailErr.message, "update_email_failed");
    }

    if (body.full_name !== undefined) {
      const { error } = await req.supabase
        .from("profiles")
        .update({ full_name: body.full_name })
        .eq("id", req.user.id);
      if (error) throw error;
    }

    // Return the fresh profile plus the (possibly updated) email.
    const { data, error } = await req.supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();
    if (error) throw error;
    res.json({ ...data, email: body.email ?? req.user.email });
  }),
);

/**
 * Change another user's role (admin-only). Enforced three ways: this code
 * check, the profiles_update_admin RLS policy, and the role-change trigger.
 */
profilesRouter.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const { role } = z.object({ role: z.enum(["member", "admin"]) }).parse(req.body);

    const { data: me, error: meError } = await req.supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();
    if (meError) throw meError;
    if (me?.role !== "admin") {
      throw new HttpError(403, "Admin privileges required.", "not_admin");
    }

    const { data, error } = await req.supabase
      .from("profiles")
      .update({ role })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }),
);
