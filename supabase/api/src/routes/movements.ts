import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../http.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const movementsRouter = Router();

movementsRouter.use(requireAuth);

const SELECT =
  "id, item_id, location_id, user_id, delta, capacity_delta, reason, reversal_of, note, created_at, items(name, sku), locations(name)";

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
  delta: z.number().int(),
  capacity_delta: z.number().int().optional(),
  reason: z.enum(["take", "return", "initial", "finish", "destroyed", "adjust", "undo"]).optional(),
  note: z.string().trim().optional(),
});

/**
 * Record a raw stock movement. Positive delta = checked in, negative =
 * checked out. `capacity_delta` adjusts the ceiling (used by finish/adjust/undo).
 * The Postgres trigger updates item_stock automatically. user_id is always the
 * authenticated user (RLS enforces this too).
 */
movementsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = movementBody.parse(req.body);
    const { data, error } = await insertMovement(req, {
      item_id: body.item_id,
      location_id: body.location_id,
      delta: body.delta,
      capacity_delta: body.capacity_delta,
      reason: body.reason ?? "take",
      note: body.note,
    });
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

/** Insert one movement as the current user and return it with joins. */
function insertMovement(
  req: Request,
  fields: {
    item_id: string;
    location_id: string;
    delta: number;
    capacity_delta?: number;
    reason: string;
    note?: string;
    reversal_of?: string | null;
  },
) {
  return req.supabase
    .from("stock_movements")
    .insert({
      item_id: fields.item_id,
      location_id: fields.location_id,
      user_id: req.user.id,
      delta: fields.delta,
      capacity_delta: fields.capacity_delta ?? 0,
      reason: fields.reason,
      note: fields.note,
      reversal_of: fields.reversal_of ?? null,
    })
    .select(SELECT)
    .single();
}

/** Convenience: check a positive quantity out of a location (delta < 0). */
movementsRouter.post(
  "/check-out",
  asyncHandler(async (req, res) => {
    const b = quantityBody.parse(req.body);
    const { data, error } = await insertMovement(req, {
      item_id: b.item_id,
      location_id: b.location_id,
      delta: -b.quantity,
      reason: "take",
      note: b.note,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/** Convenience: check a positive quantity back in (delta > 0). */
movementsRouter.post(
  "/check-in",
  asyncHandler(async (req, res) => {
    const b = quantityBody.parse(req.body);
    const { data, error } = await insertMovement(req, {
      item_id: b.item_id,
      location_id: b.location_id,
      delta: b.quantity,
      reason: "return",
      note: b.note,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/**
 * Permanently consume stock ("finished using it up"). Reduces BOTH the quantity
 * and the total ceiling, so it can't be returned. Only allowed when the item is
 * marked finishable. Available to members and admins.
 */
movementsRouter.post(
  "/finish",
  asyncHandler(async (req, res) => {
    const b = quantityBody.parse(req.body);

    const { data: item, error: itemErr } = await req.supabase
      .from("items")
      .select("finishable")
      .eq("id", b.item_id)
      .maybeSingle();
    if (itemErr) throw itemErr;
    if (!item) throw new HttpError(404, "Item not found.", "not_found");
    if (!item.finishable) {
      throw new HttpError(422, "This item is not marked finishable.", "item_not_finishable");
    }

    const { data, error } = await insertMovement(req, {
      item_id: b.item_id,
      location_id: b.location_id,
      delta: -b.quantity,
      capacity_delta: -b.quantity,
      reason: "finish",
      note: b.note,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);

/**
 * Record destroyed/damaged stock. Same permanent effect as finish, but always
 * available to every user (members and admins).
 */
movementsRouter.post(
  "/destroy",
  asyncHandler(async (req, res) => {
    const b = quantityBody.parse(req.body);
    const { data, error } = await insertMovement(req, {
      item_id: b.item_id,
      location_id: b.location_id,
      delta: -b.quantity,
      capacity_delta: -b.quantity,
      reason: "destroyed",
      note: b.note,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);

const adjustBody = z
  .object({
    item_id: z.string().uuid(),
    location_id: z.string().uuid(),
    quantity: z.number().int().nonnegative().optional(),
    capacity: z.number().int().nonnegative().optional(),
    note: z.string().trim().optional(),
  })
  .refine((b) => b.quantity !== undefined || b.capacity !== undefined, {
    message: "Provide a new quantity, a new total, or both.",
  });

/**
 * Admin: set the current quantity and/or the total (ceiling) for an item at a
 * location directly. Records the difference as an `adjust` movement so the
 * activity log and the item_stock trigger stay the single source of truth.
 */
movementsRouter.post(
  "/adjust",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = adjustBody.parse(req.body);

    const { data: stock, error: stockErr } = await req.supabase
      .from("item_stock")
      .select("quantity, capacity")
      .eq("item_id", b.item_id)
      .eq("location_id", b.location_id)
      .maybeSingle();
    if (stockErr) throw stockErr;

    const curQty = stock?.quantity ?? 0;
    const curCap = stock?.capacity ?? 0;
    const targetQty = b.quantity ?? curQty;
    const targetCap = b.capacity ?? curCap;

    if (targetQty > targetCap) {
      throw new HttpError(422, "Quantity cannot exceed the total.", "quantity_over_total");
    }

    const delta = targetQty - curQty;
    const capacityDelta = targetCap - curCap;
    if (delta === 0 && capacityDelta === 0) {
      throw new HttpError(422, "Nothing to change.", "no_change");
    }

    const { data, error } = await insertMovement(req, {
      item_id: b.item_id,
      location_id: b.location_id,
      delta,
      capacity_delta: capacityDelta,
      reason: "adjust",
      note: b.note,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);

const undoParams = z.object({ id: z.string().uuid() });

/**
 * Undo a finish/destroyed movement by recording its exact inverse. One undo per
 * movement (guarded by reversal_of). Allowed for the original author or an admin.
 */
movementsRouter.post(
  "/:id/undo",
  asyncHandler(async (req, res) => {
    const { id } = undoParams.parse(req.params);

    const { data: original, error: origErr } = await req.supabase
      .from("stock_movements")
      .select("id, item_id, location_id, user_id, delta, capacity_delta, reason")
      .eq("id", id)
      .maybeSingle();
    if (origErr) throw origErr;
    if (!original) throw new HttpError(404, "Movement not found.", "not_found");

    if (original.reason !== "finish" && original.reason !== "destroyed") {
      throw new HttpError(422, "Only finished or destroyed entries can be undone.", "not_undoable");
    }

    // Authorization: the person who recorded it, or an admin.
    if (original.user_id !== req.user.id) {
      const { data: me, error: meErr } = await req.supabase
        .from("profiles")
        .select("role")
        .eq("id", req.user.id)
        .single();
      if (meErr) throw meErr;
      if (me?.role !== "admin") {
        throw new HttpError(403, "You can only undo your own entries.", "forbidden");
      }
    }

    const { count, error: dupErr } = await req.supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("reversal_of", id);
    if (dupErr) throw dupErr;
    if ((count ?? 0) > 0) {
      throw new HttpError(409, "This entry has already been undone.", "already_undone");
    }

    const { data, error } = await insertMovement(req, {
      item_id: original.item_id,
      location_id: original.location_id,
      delta: -original.delta,
      capacity_delta: -original.capacity_delta,
      reason: "undo",
      reversal_of: id,
    });
    if (error) throw error;
    res.status(201).json(data);
  }),
);
