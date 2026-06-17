// Shared types mirroring the inventory-api responses.

export interface ApiUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number; // unix seconds
  expires_in?: number;
  token_type?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: "member" | "admin";
  blocked: boolean;
  created_at: string;
  has_payment_permission?: boolean;
  daily_limit?: number;
  monthly_limit?: number;
  per_transaction_limit?: number;
}

export interface Item {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  /** When true, users can permanently "finish" (consume) this item. */
  finishable: boolean;
  created_at: string;
}

export type MovementReason =
  | "take"
  | "return"
  | "initial"
  | "finish"
  | "destroyed"
  | "adjust"
  | "undo";

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface StockLevel {
  item_id: string;
  location_id: string;
  quantity: number;
  /** The amount this (item, location) was first stocked with — its ceiling. */
  capacity: number;
  updated_at: string;
  items?: { name: string; sku: string | null } | null;
  locations?: { name: string } | null;
}

export interface Movement {
  id: string;
  item_id: string;
  location_id: string;
  user_id: string;
  delta: number;
  /** Change to the ceiling (negative for finish/destroyed, positive for undo). */
  capacity_delta: number;
  reason: MovementReason;
  /** For an undo movement, the id of the movement it reverses. */
  reversal_of: string | null;
  note: string | null;
  created_at: string;
  items?: { name: string; sku: string | null } | null;
  locations?: { name: string } | null;
}
