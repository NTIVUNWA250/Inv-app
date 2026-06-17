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
  const finishable = formData.get("finishable") != null;

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
      finishable,
    });

    await api.post("/movements", {
      item_id: item.id,
      location_id: locationId,
      delta: quantity,
      reason: "initial",
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

/** Block or unblock a user (admin-only). Throws on failure. */
export async function setBlocked(id: string, blocked: boolean): Promise<void> {
  const api = serverApi();
  await api.patch(`/users/${id}/block`, { blocked });
  revalidatePath("/users");
}

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

/**
 * Change the signed-in user's own password. The API verifies the current
 * password before applying the new one.
 */
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const api = serverApi();
  const current_password = String(formData.get("current_password") ?? "");
  const new_password = String(formData.get("new_password") ?? "");
  const confirm_password = String(formData.get("confirm_password") ?? "");

  if (!current_password) return { error: "Enter your current password." };
  if (new_password.length < 6) return { error: "New password must be at least 6 characters." };
  if (new_password !== confirm_password) return { error: "New passwords don't match." };

  try {
    await api.post("/auth/change-password", { current_password, new_password });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not change password." };
  }

  return { ok: true };
}

export interface EditUserState {
  ok?: boolean;
  error?: string;
}

/**
 * Update another user's account as an admin: display name, email, and/or
 * password — for fixing things when the user can't themselves. Only the fields
 * that are filled in are sent. Requires the API's service-role key (otherwise a
 * clear 501 comes back). `id` is bound by the caller.
 */
export async function editUser(
  id: string,
  _prev: EditUserState,
  formData: FormData,
): Promise<EditUserState> {
  const api = serverApi();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const has_payment_permission = formData.get("has_payment_permission") === "on";
  const daily_limit = Number(formData.get("daily_limit") ?? "0");
  const monthly_limit = Number(formData.get("monthly_limit") ?? "0");
  const per_transaction_limit = Number(formData.get("per_transaction_limit") ?? "0");

  const body: Record<string, string> = {};
  if (full_name) body.full_name = full_name;
  if (email) body.email = email;
  if (password) {
    if (password.length < 6) return { error: "Password must be at least 6 characters." };
    body.password = password;
  }

  try {
    if (Object.keys(body).length > 0) {
      await api.patch(`/users/${id}`, body);
    }
    await api.patch(`/payments/profiles/${id}/payment-settings`, {
      has_payment_permission,
      daily_limit,
      monthly_limit,
      per_transaction_limit,
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not update user." };
  }

  revalidatePath("/users");
  return { ok: true };
}

export interface UpdateProfileState {
  ok?: boolean;
  error?: string;
}

/**
 * Update the signed-in user's own display name and/or email. Email changes go
 * through the API's admin path (service-role key required); the name does not.
 */
export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const api = serverApi();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!full_name) return { error: "Name can't be empty." };
  if (!email) return { error: "Email can't be empty." };

  try {
    await api.patch("/profiles/me", { full_name, email });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not update profile." };
  }

  revalidatePath("/settings");
  revalidatePath("/users");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change a user's payment permission status (admin-only). Throws on failure. */
export async function changePaymentPermission(
  id: string,
  has_payment_permission: boolean
): Promise<void> {
  const api = serverApi();
  await api.patch(`/payments/profiles/${id}/payment-settings`, { has_payment_permission });
  revalidatePath("/users");
}
