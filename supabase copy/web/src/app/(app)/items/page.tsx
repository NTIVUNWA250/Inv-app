import Link from "next/link";
import { redirect } from "next/navigation";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { AddItemForm } from "@/components/dashboard/add-item-form";
import { RemoveItemButton } from "@/components/dashboard/remove-item-button";
import type { ApiUser, Profile, Item, Location } from "@/lib/api/types";

export default async function ItemsPage() {
  const api = serverApi();

  // Admins only.
  let profile: Profile | null = null;
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    profile = me.profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  if (profile?.role !== "admin") redirect("/");

  let items: Item[] = [];
  let locations: Location[] = [];
  let loadError: string | null = null;
  try {
    [items, locations] = await Promise.all([
      api.get<Item[]>("/items"),
      api.get<Location[]>("/locations"),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load items.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Items</h1>
        <p className="mt-1 text-sm text-muted">Add to the catalog and manage existing items.</p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {loadError}
        </div>
      ) : null}

      <Panel title="Add item">
        <AddItemForm locations={locations} />
      </Panel>

      <Panel
        title="Catalog"
        action={<span className="text-xs text-muted">{items.length} items</span>}
      >
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-2/40">
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/items/${item.id}`} className="text-fg hover:text-pink-400">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted">{item.sku ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      <span className="line-clamp-1 max-w-xs">{item.description ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end">
                        <RemoveItemButton id={item.id} name={item.name} />
                      </div>
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
