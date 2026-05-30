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
  created_at: string;
}

export interface Item {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface StockLevel {
  item_id: string;
  location_id: string;
  quantity: number;
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
  note: string | null;
  created_at: string;
  items?: { name: string; sku: string | null } | null;
  locations?: { name: string } | null;
}
