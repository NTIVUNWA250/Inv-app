import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel, StatusBadge } from "@/components/dashboard/widgets";
import { RemoveLocationButton } from "@/components/dashboard/remove-location-button";
import type { ApiUser, Profile, Location, StockLevel } from "@/lib/api/types";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = serverApi();

  let role: "member" | "admin" = "member";
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    role = me.profile?.role ?? "member";
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  let location: Location;
  try {
    location = await api.get<Location>(`/locations/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const stock = await api
    .get<StockLevel[]>(`/stock?location_id=${id}`)
    .catch(() => [] as StockLevel[]);

  const rows = stock.sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? ""));
  const totalUnits = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/locations"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        All locations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{location.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} item{rows.length === 1 ? "" : "s"} · {totalUnits} units
          </p>
        </div>
        {role === "admin" ? (
          <RemoveLocationButton id={location.id} name={location.name} redirectTo="/locations" />
        ) : null}
      </div>

      <Panel title="Items here">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No items stored in this location yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.item_id}>
                <Link
                  href={`/items/${row.item_id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-2/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {row.items?.name ?? row.item_id}
                    </p>
                    <p className="truncate text-xs text-muted">{row.items?.sku ?? "No SKU"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted">{row.quantity}</span>
                    <StatusBadge quantity={row.quantity} />
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
