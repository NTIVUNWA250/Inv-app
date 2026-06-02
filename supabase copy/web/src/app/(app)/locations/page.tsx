import Link from "next/link";
import { redirect } from "next/navigation";
import { Warehouse, ChevronRight } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { AddLocationForm } from "@/components/dashboard/add-location-form";
import type { ApiUser, Profile, Location, StockLevel } from "@/lib/api/types";

export default async function LocationsPage() {
  const api = serverApi();

  let role: "member" | "admin" = "member";
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    role = me.profile?.role ?? "member";
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  let locations: Location[] = [];
  let stock: StockLevel[] = [];
  let loadError: string | null = null;
  try {
    [locations, stock] = await Promise.all([
      api.get<Location[]>("/locations"),
      api.get<StockLevel[]>("/stock"),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load locations.";
  }

  // Per-location summary: distinct items + total units.
  const summary = new Map<string, { items: Set<string>; units: number }>();
  for (const row of stock) {
    const s = summary.get(row.location_id) ?? { items: new Set<string>(), units: 0 };
    if (row.quantity > 0) s.items.add(row.item_id);
    s.units += row.quantity;
    summary.set(row.location_id, s);
  }

  const isAdmin = role === "admin";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Locations</h1>
        <p className="mt-1 text-sm text-muted">
          Open a location to see the items stored in it.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {loadError}
        </div>
      ) : null}

      {isAdmin ? (
        <Panel title="Add location">
          <div className="p-5">
            <AddLocationForm />
          </div>
        </Panel>
      ) : null}

      {locations.length === 0 ? (
        <Panel title="Locations">
          <p className="px-5 py-10 text-center text-sm text-muted">No locations yet.</p>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => {
            const s = summary.get(loc.id);
            return (
              <Link
                key={loc.id}
                href={`/locations/${loc.id}`}
                className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-pink-500/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <Warehouse className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{loc.name}</p>
                  <p className="text-xs text-muted">
                    {s?.items.size ?? 0} items · {s?.units ?? 0} units
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
