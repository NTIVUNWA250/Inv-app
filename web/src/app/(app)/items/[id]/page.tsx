import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, History } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel, StatusBadge } from "@/components/dashboard/widgets";
import { MovementForm } from "@/components/dashboard/movement-form";
import { StockAdjustForm } from "@/components/dashboard/stock-adjust-form";
import { FinishableToggle } from "@/components/dashboard/finishable-toggle";
import { UndoMovementButton } from "@/components/dashboard/undo-movement-button";
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

/** Human-readable label + tone for an activity-log row. */
function movementLabel(m: Movement): { text: string; tone: string } {
  const n = Math.abs(m.delta);
  switch (m.reason) {
    case "return":
      return { text: `Returned ${n}`, tone: "text-success" };
    case "initial":
      return { text: `Stocked ${n}`, tone: "text-success" };
    case "finish":
      return { text: `Finished ${n}`, tone: "text-warning" };
    case "destroyed":
      return { text: `Destroyed ${n}`, tone: "text-destructive" };
    case "undo":
      return { text: "Undid", tone: "text-muted-foreground" };
    case "adjust": {
      const parts: string[] = [];
      if (m.delta !== 0) parts.push(`qty ${m.delta > 0 ? "+" : ""}${m.delta}`);
      if (m.capacity_delta !== 0) parts.push(`total ${m.capacity_delta > 0 ? "+" : ""}${m.capacity_delta}`);
      return { text: `Adjusted${parts.length ? ` (${parts.join(", ")})` : ""}`, tone: "text-foreground" };
    }
    case "take":
    default:
      return m.delta < 0
        ? { text: `Took ${n}`, tone: "text-warning" }
        : { text: `Added ${n}`, tone: "text-success" };
  }
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = serverApi();

  let role: "member" | "admin" = "member";
  let userId = "";
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    role = me.profile?.role ?? "member";
    userId = me.user.id;
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
  // A finish/destroyed entry can be undone once; track which are already reversed.
  const reversedIds = new Set(movements.map((m) => m.reversal_of).filter(Boolean) as string[]);

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

        <Panel title="Move stock">
          <MovementForm itemId={item.id} locations={locations} finishable={item.finishable} />
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
              {movements.map((m) => {
                const label = movementLabel(m);
                const canUndo =
                  (m.reason === "finish" || m.reason === "destroyed") &&
                  !reversedIds.has(m.id) &&
                  (m.user_id === userId || role === "admin");
                return (
                  <TableRow key={m.id}>
                    <TableCell className="px-5 text-foreground">{nameById.get(m.user_id) || "Unknown"}</TableCell>
                    <TableCell className="px-5">
                      <span className={`font-medium ${label.tone}`}>{label.text}</span>
                      {m.note ? <span className="text-muted-foreground"> · {m.note}</span> : null}
                      {canUndo ? (
                        <span className="ml-2">
                          <UndoMovementButton movementId={m.id} itemId={item.id} />
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-5 text-muted-foreground">{m.locations?.name ?? "—"}</TableCell>
                    <TableCell className="px-5 text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {role === "admin" ? (
        <>
          <Panel title="Item settings">
            <FinishableToggle itemId={item.id} finishable={item.finishable} />
          </Panel>

          <Panel title="Edit stock numbers">
            <StockAdjustForm itemId={item.id} stock={stock} />
          </Panel>

          <Panel title="Danger zone">
            <div className="flex items-center justify-between px-5 py-5">
              <div>
                <p className="text-sm font-medium text-fg">Delete this item</p>
                <p className="text-sm text-muted-foreground">Removes it from the catalog and all its stock.</p>
              </div>
              <DeleteItemButton id={item.id} name={item.name} />
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
