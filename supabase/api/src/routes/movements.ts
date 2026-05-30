import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../http.js";
import { requireAuth } from "../middleware/auth.js";

export const movementsRouter = Router();

movementsRouter.use(requireAuth);

const SELECT = "id, item_id, location_id, user_id, delta, note, created_at, items(name, sku), locations(name)";

const listQuery = z.object({
  item_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  mine: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * The append-only activity log — "who took what, when". Filter by item,
 * location, user, or `mine=true` for the current user's own movements.
 * Note: display names aren't embedded (stock_movements has no direct FK to
 * profiles); resolve them client-side with GET /profiles.
 */
movementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);

    let query = req.supabase
      .from("stock_movements")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .range(q.offset, q.offset + q.limit - 1);

    if (q.item_id) query = query.eq("item_id", q.item_id);
    if (q.location_id) query = query.eq("location_id", q.location_id);
    if (q.user_id) query = query.eq("user_id", q.user_id);
    if (q.mine) query = query.eq("user_id", req.user.id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  }),
);

const movementBody = z.object({
  item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, "delta must be non-zero"),
  note: z.string().trim().optional(),
});

/**
 * Record a raw stock movement. Positive delta = checked in, negative =
 * checked out. The Postgres trigger updates item_stock automatically.
 * user_id is always the authenticated user (RLS enforces this too).
 */
movementsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = movementBody.parse(req.body);
    const { data, error } = await req.supabase
      .from("stock_movements")
      .insert({ ...body, user_id: req.user.id })
      .select(SELECT)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

const quantityBody = z.object({
  item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().trim().optional(),
});

async function record(req: Request, signedDelta: number) {
  const body = quantityBody.parse(req.body);
  return req.supabase
    .from("stock_movements")
    .insert({
      item_id: body.item_id,
      location_id: body.location_id,
      user_id: req.user.id,
      delta: signedDelta * body.quantity,
      note: body.note,
    })
    .select(SELECT)
    .single();
}

/** Convenience: check a positive quantity out of a location (delta < 0). */
movementsRouter.post(
  "/check-out",
  asyncHandler(async (req, res) => {
    const { data, error } = await record(req, -1);
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/** Convenience: check a positive quantity back in (delta > 0). */
movementsRouter.post(
  "/check-in",
  asyncHandler(async (req, res) => {
    const { data, error } = await record(req, 1);
    if (error) throw error;
    res.status(201).json(data);
  }),
);
