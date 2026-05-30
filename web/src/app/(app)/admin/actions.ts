"use server";

import { revalidatePath } from "next/cache";
import { serverApi, ApiError } from "@/lib/api/server";

export interface AddItemState {
  ok?: boolean;
  error?: string;
}

/**
 * Create a catalog item, and (optionally) seed its initial stock at a location
 * via a stock movement. Admin-only — the API enforces this through RLS, so a
 * non-admin call comes back as 403.
 */
export async function addItem(_prev: AddItemState, formData: FormData): Promise<AddItemState> {
  const api = serverApi();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim();
  const quantity = Number(String(formData.get("quantity") ?? "").trim());

  if (!name) return { error: "Name is required." };

  try {
    const item = await api.post<{ id: string }>("/items", {
      name,
      sku: sku || null,
      description: description || null,
    });

    if (locationId && Number.isFinite(quantity) && quantity > 0) {
      await api.post("/movements", {
        item_id: item.id,
        location_id: locationId,
        delta: quantity,
        note: "Initial stock",
      });
    }
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not add item." };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

/** Delete a catalog item (admin-only via RLS). Throws on failure. */
export async function removeItem(id: string): Promise<void> {
  const api = serverApi();
  await api.del(`/items/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");
}
