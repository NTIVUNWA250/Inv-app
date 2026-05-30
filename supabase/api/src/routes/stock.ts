import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const stockRouter = Router();

stockRouter.use(requireAuth);

const stockQuery = z.object({
  item_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
});

/**
 * Current stock levels per (item, location), with the item and location
 * details joined in. Optionally filter by item_id and/or location_id.
 */
stockRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { item_id, location_id } = stockQuery.parse(req.query);

    let query = req.supabase
      .from("item_stock")
      .select("item_id, location_id, quantity, updated_at, items(name, sku), locations(name)");

    if (item_id) query = query.eq("item_id", item_id);
    if (location_id) query = query.eq("location_id", location_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  }),
);
