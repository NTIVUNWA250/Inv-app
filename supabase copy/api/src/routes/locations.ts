import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const locationsRouter = Router();

locationsRouter.use(requireAuth);

const locationBody = z.object({ name: z.string().trim().min(1) });

/** List all locations. Any authenticated user can read. */
locationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("locations")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    res.json(data);
  }),
);

/** Single location. */
locationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("locations")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: { message: "Location not found.", code: "not_found" } });
      return;
    }
    res.json(data);
  }),
);

/** Create a location (admin-only — enforced by RLS). */
locationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = locationBody.parse(req.body);
    const { data, error } = await req.supabase
      .from("locations")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/** Rename a location (admin-only). */
locationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = locationBody.partial().parse(req.body);
    const { data, error } = await req.supabase
      .from("locations")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

/** Delete a location (admin-only). */
locationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase.from("locations").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  }),
);
