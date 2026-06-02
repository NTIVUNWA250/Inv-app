import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, History } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel, StatusBadge } from "@/components/dashboard/widgets";
import { MovementForm } from "@/components/dashboard/movement-form";
import { DeleteItemButton } from "@/components/dashboard/delete-item-button";
import { ItemQrCard } from "@/components/dashboard/item-qr-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiUser, Profile, Item, Location, Movement, StockLevel } from "@/lib/api/types";

export default async function ItemDetailPage({
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

  let item: Item;
  try {
    item = await api.get<Item>(`/items/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [stock, movements, profiles, locations] = await Promise.all([
    api.get<StockLevel[]>(`/items/${id}/stock`).catch(() => [] as StockLevel[]),
    api.get<Movement[]>(`/movements?item_id=${id}`).catch(() => [] as Movement[]),
    api.get<Profile[]>("/profiles").catch(() => [] as Profile[]),
    api.get<Location[]>("/locations").catch(() => [] as Location[]),
  ]);

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const totalQty = stock.reduce((sum, r) => sum + r.quantity, 0);
  const totalCap = stock.reduce((sum, r) => sum + (r.capacity ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[1.75rem] text-foreground">{item.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.sku ? `SKU ${item.sku}` : "No SKU"}
            {item.description ? ` · ${item.description}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums text-fg">{totalQty}</p>
            <p className="text-xs text-muted-foreground">in stock</p>
          </div>
          <StatusBadge quantity={totalQty} capacity={totalCap} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Where it is">
          {stock.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Not stored anywhere yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {stock.map((row) => (
                <li
                  key={row.location_id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-fg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {row.locations?.name ?? row.location_id}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {row.quantity}
                    {row.capacity ? <span className="text-muted-foreground/60"> / {row.capacity}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Take or return stock">
          <MovementForm itemId={item.id} locations={locations} />
        </Panel>
      </div>

      <Panel title="QR code">
        <ItemQrCard itemId={item.id} sku={item.sku} name={item.name} />
      </Panel>

      <Panel
        title="Activity"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            who took what, when
          </span>
        }
      >
        {movements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Person</TableHead>
                <TableHead className="px-5">Action</TableHead>
                <TableHead className="px-5">Location</TableHead>
                <TableHead className="px-5">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="px-5 text-foreground">{nameById.get(m.user_id) || "Unknown"}</TableCell>
                  <TableCell className="px-5">
                    {m.delta < 0 ? (
                      <span className="font-medium text-warning">Took {Math.abs(m.delta)}</span>
                    ) : (
                      <span className="font-medium text-success">Added {m.delta}</span>
                    )}
                    {m.note ? <span className="text-muted-foreground"> · {m.note}</span> : null}
                  </TableCell>
                  <TableCell className="px-5 text-muted-foreground">{m.locations?.name ?? "—"}</TableCell>
                  <TableCell className="px-5 text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {role === "admin" ? (
        <Panel title="Danger zone">
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              <p className="text-sm font-medium text-fg">Delete this item</p>
              <p className="text-sm text-muted-foreground">Removes it from the catalog and all its stock.</p>
            </div>
            <DeleteItemButton id={item.id} name={item.name} />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
