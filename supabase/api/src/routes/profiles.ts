import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http.js";
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

/** Update the current user's profile (RLS only allows updating your own row). */
profilesRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const body = z.object({ full_name: z.string().trim().min(1) }).parse(req.body);

    const { data, error } = await req.supabase
      .from("profiles")
      .update({ full_name: body.full_name })
      .eq("id", req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }),
);
