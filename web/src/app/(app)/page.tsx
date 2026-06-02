import Link from "next/link";
import { Boxes, Package, Warehouse, AlertTriangle } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { StatCard, StatusBadge, Panel } from "@/components/dashboard/widgets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  totalsByItem,
  totalsByLocation,
  capacityByItem,
  locationCountByItem,
  statusFor,
  LOW_STOCK_RATIO,
} from "@/lib/inventory";
import type { Item, Location, StockLevel } from "@/lib/api/types";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const api = serverApi();
  const query = (await searchParams).q?.trim() ?? "";

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
  const capItem = capacityByItem(stock);
  const locCount = locationCountByItem(stock);

  const rows = items
    .map((item) => ({
      item,
      qty: byItem.get(item.id) ?? 0,
      cap: capItem.get(item.id) ?? 0,
      locs: locCount.get(item.id) ?? 0,
    }))
    .sort((a, b) => a.qty - b.qty);

  const totalUnits = stock.reduce((sum, r) => sum + r.quantity, 0);
  const lowStock = rows.filter((r) => statusFor(r.qty, r.cap) !== "ok").slice(0, 6);

  // The search box filters just the inventory table; stats stay global.
  const q = query.toLowerCase();
  const tableRows = q
    ? rows.filter(
        ({ item }) =>
          item.name.toLowerCase().includes(q) ||
          (item.sku ?? "").toLowerCase().includes(q),
      )
    : rows;

  const locationRows = locations
    .map((loc) => ({ loc, qty: byLocation.get(loc.id) ?? 0 }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif text-[1.75rem] text-foreground">
          Inventory Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
          value={rows.filter((r) => statusFor(r.qty, r.cap) !== "ok").length}
          icon={AlertTriangle}
          hint={`Low at ≤${Math.round(LOW_STOCK_RATIO * 100)}% of capacity`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Low stock items">
          {lowStock.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Everything is well stocked.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map(({ item, qty, cap }) => (
                <li key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.sku ?? "No SKU"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted-foreground">{qty}</span>
                    <StatusBadge quantity={qty} capacity={cap} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Storage locations">
          {locationRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No locations yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {locationRows.map(({ loc, qty }) => (
                <li key={loc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
                      <Warehouse className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-fg">{loc.name}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">{qty} units</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Inventory overview"
        action={
          <span className="text-xs text-muted-foreground">
            {query ? `${tableRows.length} of ${rows.length} · "${query}"` : `${items.length} items`}
          </span>
        }
      >
        {tableRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {query ? `No items match "${query}".` : "No items in the catalog yet."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Item</TableHead>
                <TableHead className="px-5">SKU</TableHead>
                <TableHead className="px-5">Locations</TableHead>
                <TableHead className="px-5 text-right">Quantity</TableHead>
                <TableHead className="px-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map(({ item, qty, cap, locs }) => (
                <TableRow key={item.id}>
                  <TableCell className="px-5 font-medium">
                    <Link href={`/items/${item.id}`} className="text-foreground hover:text-highlight">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-5 text-muted-foreground">{item.sku ?? "—"}</TableCell>
                  <TableCell className="px-5 text-muted-foreground">{locs}</TableCell>
                  <TableCell className="px-5 text-right font-mono tabular-nums text-foreground">{qty}</TableCell>
                  <TableCell className="px-5 text-right">
                    <StatusBadge quantity={qty} capacity={cap} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
