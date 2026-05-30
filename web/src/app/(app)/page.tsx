import { Boxes, Package, Warehouse, AlertTriangle } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { StatCard, StatusBadge, Panel } from "@/components/dashboard/widgets";
import {
  totalsByItem,
  totalsByLocation,
  locationCountByItem,
  statusFor,
  LOW_STOCK_THRESHOLD,
} from "@/lib/inventory";
import type { Item, Location, StockLevel } from "@/lib/api/types";

export default async function OverviewPage() {
  const api = serverApi();

  let items: Item[] = [];
  let stock: StockLevel[] = [];
  let locations: Location[] = [];
  let loadError: string | null = null;

  try {
    [items, stock, locations] = await Promise.all([
      api.get<Item[]>("/items"),
      api.get<StockLevel[]>("/stock"),
      api.get<Location[]>("/locations"),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load inventory.";
  }

  const byItem = totalsByItem(stock);
  const byLocation = totalsByLocation(stock);
  const locCount = locationCountByItem(stock);

  const rows = items
    .map((item) => ({
      item,
      qty: byItem.get(item.id) ?? 0,
      locs: locCount.get(item.id) ?? 0,
    }))
    .sort((a, b) => a.qty - b.qty);

  const totalUnits = stock.reduce((sum, r) => sum + r.quantity, 0);
  const lowStock = rows.filter((r) => statusFor(r.qty) !== "ok").slice(0, 6);

  const locationRows = locations
    .map((loc) => ({ loc, qty: byLocation.get(loc.id) ?? 0 }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Inventory Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track and manage your inventory efficiently.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Couldn&apos;t load inventory from the API: {loadError}
          <span className="mt-1 block text-amber-300/70">
            If the database schema hasn&apos;t been pushed yet, run{" "}
            <code className="rounded bg-amber-500/10 px-1">supabase db push</code>.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Catalog items" value={items.length} icon={Boxes} />
        <StatCard label="Total units" value={totalUnits} icon={Package} />
        <StatCard label="Locations" value={locations.length} icon={Warehouse} />
        <StatCard
          label="Low / out of stock"
          value={rows.filter((r) => statusFor(r.qty) !== "ok").length}
          icon={AlertTriangle}
          hint={`Threshold: ${LOW_STOCK_THRESHOLD} units`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Low stock items">
          {lowStock.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Everything is well stocked.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {lowStock.map(({ item, qty }) => (
                <li key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{item.name}</p>
                    <p className="truncate text-xs text-zinc-500">{item.sku ?? "No SKU"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-zinc-300">{qty}</span>
                    <StatusBadge quantity={qty} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Storage locations">
          {locationRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              No locations yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {locationRows.map(({ loc, qty }) => (
                <li key={loc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                      <Warehouse className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-100">{loc.name}</span>
                  </div>
                  <span className="text-sm tabular-nums text-zinc-400">{qty} units</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Inventory overview"
        action={<span className="text-xs text-zinc-500">{items.length} items</span>}
      >
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">
            No items in the catalog yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Locations</th>
                  <th className="px-5 py-3 text-right font-medium">Quantity</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map(({ item, qty, locs }) => (
                  <tr key={item.id} className="hover:bg-zinc-800/40">
                    <td className="px-5 py-3 font-medium text-zinc-100">{item.name}</td>
                    <td className="px-5 py-3 text-zinc-400">{item.sku ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-400">{locs}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-200">{qty}</td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge quantity={qty} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
