import { redirect } from "next/navigation";
import { serverApi, ApiError } from "@/lib/api/server";
import { Button } from "@/components/ui/button";
import { signOut } from "./(auth)/actions";
import type { ApiUser, Profile, StockLevel, Item } from "@/lib/api/types";

export default async function HomePage() {
  const api = serverApi();

  let user: ApiUser;
  let profile: Profile | null = null;
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    user = me.user;
    profile = me.profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  // Load the dashboard data from the shared API. Tolerate failure (e.g. the
  // schema hasn't been pushed yet) so the page still renders.
  let stock: StockLevel[] = [];
  let items: Item[] = [];
  let loadError: string | null = null;
  try {
    [stock, items] = await Promise.all([
      api.get<StockLevel[]>("/stock"),
      api.get<Item[]>("/items"),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load inventory.";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
            <p className="text-sm text-slate-500">
              Signed in as {profile?.full_name || user.email}
              {profile?.role === "admin" ? " · admin" : ""}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </header>

        {loadError ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Couldn&apos;t load inventory from the API: {loadError}
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-medium text-slate-900">Stock levels</h2>
            <span className="text-sm text-slate-500">
              {items.length} item{items.length === 1 ? "" : "s"} in catalog
            </span>
          </div>

          {stock.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">
              No stock recorded yet. Add items and locations, then record a movement.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 font-medium">Item</th>
                  <th className="px-6 py-3 font-medium">SKU</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr
                    key={`${row.item_id}-${row.location_id}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-6 py-3 text-slate-900">{row.items?.name ?? row.item_id}</td>
                    <td className="px-6 py-3 text-slate-500">{row.items?.sku ?? "—"}</td>
                    <td className="px-6 py-3 text-slate-700">{row.locations?.name ?? row.location_id}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-900">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
