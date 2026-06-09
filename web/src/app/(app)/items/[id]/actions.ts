"use server";

import { revalidatePath } from "next/cache";
import { serverApi, ApiError } from "@/lib/api/server";

/** Movements that change stock for an item, from the item detail screen. */
export type StockAction = "take" | "return" | "finish" | "destroy";

const ENDPOINT: Record<StockAction, string> = {
  take: "/movements/check-out",
  return: "/movements/check-in",
  finish: "/movements/finish",
  destroy: "/movements/destroy",
};

function revalidateItem(itemId: string): void {
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
  revalidatePath("/locations");
}

/**
 * Record a stock movement for an item. `take`/`return` move stock the usual way;
 * `finish`/`destroy` permanently consume it (quantity and total both drop).
 * Available to any authenticated user; RLS records it under their own id, which
 * is how the activity log knows "who did what".
 */
export async function recordMovement(
  itemId: string,
  locationId: string,
  quantity: number,
  action: StockAction,
): Promise<{ error?: string }> {
  const api = serverApi();
  try {
    await api.post(ENDPOINT[action], {
      item_id: itemId,
      location_id: locationId,
      quantity,
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not record movement." };
  }
  revalidateItem(itemId);
  return {};
}

/** Admin: set an item's current quantity and/or total at a location directly. */
export async function adjustStock(
  itemId: string,
  locationId: string,
  quantity: number,
  capacity: number,
): Promise<{ error?: string }> {
  const api = serverApi();
  try {
    await api.post("/movements/adjust", {
      item_id: itemId,
      location_id: locationId,
      quantity,
      capacity,
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not update stock." };
  }
  revalidateItem(itemId);
  return {};
}

/** Undo a finish/destroyed movement (own entry, or any as admin). */
export async function undoMovement(
  movementId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const api = serverApi();
  try {
    await api.post(`/movements/${movementId}/undo`);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not undo." };
  }
  revalidateItem(itemId);
  return {};
}

/** Admin: toggle whether an item can be finished. */
export async function setFinishable(
  itemId: string,
  finishable: boolean,
): Promise<{ error?: string }> {
  const api = serverApi();
  try {
    await api.patch(`/items/${itemId}`, { finishable });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not update item." };
  }
  revalidatePath(`/items/${itemId}`);
  return {};
}
