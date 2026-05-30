import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const itemsRouter = Router();

itemsRouter.use(requireAuth);

const itemBody = z.object({
  sku: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
});

const listQuery = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/** List items, optionally filtered by a search string over name/sku. */
itemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, limit, offset } = listQuery.parse(req.query);

    let query = req.supabase
      .from("items")
      .select("*")
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  }),
);

/** A single item. */
itemsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("items")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: { message: "Item not found.", code: "not_found" } });
      return;
    }
    res.json(data);
  }),
);

/** Per-location stock for one item, with the location joined in. */
itemsRouter.get(
  "/:id/stock",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("item_stock")
      .select("item_id, location_id, quantity, updated_at, locations(name)")
      .eq("item_id", req.params.id);
    if (error) throw error;
    res.json(data);
  }),
);

/** Create an item (admin-only — enforced by RLS). */
itemsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = itemBody.parse(req.body);
    const { data, error } = await req.supabase.from("items").insert(body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/** Update an item (admin-only). */
itemsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = itemBody.partial().parse(req.body);
    const { data, error } = await req.supabase
      .from("items")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

/** Delete an item (admin-only). */
itemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase.from("items").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  }),
);
