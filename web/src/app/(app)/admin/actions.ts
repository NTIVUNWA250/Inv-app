"use server";

import { revalidatePath } from "next/cache";
import { serverApi, ApiError } from "@/lib/api/server";

export interface AddItemState {
  ok?: boolean;
  error?: string;
}

/**
 * Create a catalog item and seed its initial stock at a location. A location
 * and a positive quantity are required — items can't be added without saying
 * where they live. Admin-only (enforced by RLS).
 */
export async function addItem(_prev: AddItemState, formData: FormData): Promise<AddItemState> {
  const api = serverApi();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim();
  const quantity = Number(String(formData.get("quantity") ?? "").trim());

  if (!name) return { error: "Name is required." };
  if (!locationId) return { error: "Choose a location for this item." };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a starting quantity of at least 1." };
  }

  try {
    const item = await api.post<{ id: string }>("/items", {
      name,
      sku: sku || null,
      description: description || null,
    });

    await api.post("/movements", {
      item_id: item.id,
      location_id: locationId,
      delta: quantity,
      note: "Initial stock",
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not add item." };
  }

  revalidatePath("/items");
  revalidatePath("/locations");
  revalidatePath("/");
  return { ok: true };
}

/** Delete a catalog item (admin-only via RLS). Throws on failure. */
export async function removeItem(id: string): Promise<void> {
  const api = serverApi();
  await api.del(`/items/${id}`);
  revalidatePath("/items");
  revalidatePath("/locations");
  revalidatePath("/");
}

/** Change a user's role (admin-only via RLS + trigger). Throws on failure. */
export async function changeRole(id: string, role: "member" | "admin"): Promise<void> {
  const api = serverApi();
  await api.patch(`/profiles/${id}/role`, { role });
  revalidatePath("/users");
}

export interface AddLocationState {
  ok?: boolean;
  error?: string;
}

/** Create a storage location (admin-only via RLS). */
export async function addLocation(
  _prev: AddLocationState,
  formData: FormData,
): Promise<AddLocationState> {
  const api = serverApi();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  try {
    await api.post("/locations", { name });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not add location." };
  }

  revalidatePath("/locations");
  revalidatePath("/items");
  revalidatePath("/");
  return { ok: true };
}

/** Delete a location (admin-only). Fails if stock still references it. */
export async function removeLocation(id: string): Promise<void> {
  const api = serverApi();
  await api.del(`/locations/${id}`);
  revalidatePath("/locations");
  revalidatePath("/");
}

export interface AddUserState {
  ok?: boolean;
  error?: string;
}

/**
 * Create a new account by email (admin-only). Requires the API's service-role
 * key to be configured; otherwise the API returns a clear 501.
 */
export async function createUser(
  _prev: AddUserState,
  formData: FormData,
): Promise<AddUserState> {
  const api = serverApi();
  const email = String(formData.get("email") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";

  if (!email) return { error: "Email is required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  try {
    await api.post("/users", {
      email,
      password,
      full_name: full_name || undefined,
      role,
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not create user." };
  }

  revalidatePath("/users");
  return { ok: true };
}

/** Delete an account (admin-only, requires service-role key). Throws on failure. */
export async function deleteUser(id: string): Promise<void> {
  const api = serverApi();
  await api.del(`/users/${id}`);
  revalidatePath("/users");
}
