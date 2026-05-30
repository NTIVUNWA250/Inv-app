import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { AddItemForm } from "@/components/dashboard/add-item-form";
import { RemoveItemButton } from "@/components/dashboard/remove-item-button";
import type { ApiUser, Profile, Item, Location } from "@/lib/api/types";

export default async function AdminPage() {
  const api = serverApi();

  // Gate: admins only. Non-admins are bounced to the overview.
  let profile: Profile | null = null;
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    profile = me.profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  if (profile?.role !== "admin") redirect("/");

  let profiles: Profile[] = [];
  let items: Item[] = [];
  let locations: Location[] = [];
  let loadError: string | null = null;
  try {
    [profiles, items, locations] = await Promise.all([
      api.get<Profile[]>("/profiles"),
      api.get<Item[]>("/items"),
      api.get<Location[]>("/locations"),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load admin data.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage the catalog and view your team.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Couldn&apos;t load admin data: {loadError}
        </div>
      ) : null}

      <Panel title="Add item">
        <AddItemForm locations={locations} />
      </Panel>

      <Panel
        title="Catalog"
        action={<span className="text-xs text-zinc-500">{items.length} items</span>}
      >
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/40">
                    <td className="px-5 py-3 font-medium text-zinc-100">{item.name}</td>
                    <td className="px-5 py-3 text-zinc-400">{item.sku ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-400">
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

      <Panel
        title="Team members"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Users className="h-3.5 w-3.5" />
            {profiles.length}
          </span>
        }
      >
        {profiles.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40">
                    <td className="px-5 py-3 font-medium text-zinc-100">
                      {p.full_name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          p.role === "admin"
                            ? "rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-medium text-pink-400"
                            : "rounded-full bg-zinc-700/40 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
                        }
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {new Date(p.created_at).toLocaleDateString()}
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
