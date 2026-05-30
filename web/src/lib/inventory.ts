import type { StockLevel } from "@/lib/api/types";

/** Items at or below this total quantity are flagged "low stock". */
export const LOW_STOCK_THRESHOLD = 10;

/** Sum quantities per item_id across all locations. */
export function totalsByItem(stock: StockLevel[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of stock) {
    totals.set(row.item_id, (totals.get(row.item_id) ?? 0) + row.quantity);
  }
  return totals;
}

/** Sum quantities per location_id across all items. */
export function totalsByLocation(stock: StockLevel[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of stock) {
    totals.set(row.location_id, (totals.get(row.location_id) ?? 0) + row.quantity);
  }
  return totals;
}

/** Count distinct locations an item has stock in. */
export function locationCountByItem(stock: StockLevel[]): Map<string, number> {
  const counts = new Map<string, Set<string>>();
  for (const row of stock) {
    if (row.quantity <= 0) continue;
    const set = counts.get(row.item_id) ?? new Set<string>();
    set.add(row.location_id);
    counts.set(row.item_id, set);
  }
  return new Map([...counts].map(([id, set]) => [id, set.size]));
}

export type StockStatus = "out" | "low" | "ok";

export function statusFor(quantity: number): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}
