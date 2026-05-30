"use server";

import { revalidatePath } from "next/cache";
import { serverApi, ApiError } from "@/lib/api/server";

/**
 * Record a stock movement for an item: check-out (take) or check-in (return).
 * Available to any authenticated user; RLS records it under their own id, which
 * is how the activity log knows "who took what".
 */
export async function recordMovement(
  itemId: string,
  locationId: string,
  quantity: number,
  checkout: boolean,
): Promise<{ error?: string }> {
  const api = serverApi();
  try {
    await api.post(checkout ? "/movements/check-out" : "/movements/check-in", {
      item_id: itemId,
      location_id: locationId,
      quantity,
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not record movement." };
  }
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
  revalidatePath("/locations");
  return {};
}
