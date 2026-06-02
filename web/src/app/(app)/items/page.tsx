import Link from "next/link";
import { redirect } from "next/navigation";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { AddItemForm } from "@/components/dashboard/add-item-form";
import { RemoveItemButton } from "@/components/dashboard/remove-item-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <h1 className="font-serif text-[1.75rem] text-foreground">Items</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add to the catalog and manage existing items.</p>
      </div>

      {loadError ? (
        <Alert variant="warning">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Panel title="Add item">
        <AddItemForm locations={locations} />
      </Panel>

      <Panel
        title="Catalog"
        action={<span className="text-xs text-muted-foreground">{items.length} items</span>}
      >
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <Table className="px-2">
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Item</TableHead>
                <TableHead className="px-5">SKU</TableHead>
                <TableHead className="px-5">Description</TableHead>
                <TableHead className="px-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-5 font-medium">
                    <Link href={`/items/${item.id}`} className="text-foreground hover:text-highlight">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-5 text-muted-foreground">{item.sku ?? "—"}</TableCell>
                  <TableCell className="px-5 text-muted-foreground">
                    <span className="line-clamp-1 max-w-xs">{item.description ?? "—"}</span>
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    <div className="flex justify-end">
                      <RemoveItemButton id={item.id} name={item.name} />
                    </div>
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
