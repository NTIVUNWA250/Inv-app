"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addItem, type AddItemState } from "@/app/(app)/admin/actions";
import type { Location } from "@/lib/api/types";

export function AddItemForm({ locations }: { locations: Location[] }) {
  const [state, formAction, pending] = useActionState<AddItemState, FormData>(addItem, {});
  const formRef = useRef<HTMLFormElement>(null);
  const noLocations = locations.length === 0;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 p-5">
      {state.error ? (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Item added.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Widget A" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" placeholder="WID-001" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optional description" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location_id">Location</Label>
          <select
            id="location_id"
            name="location_id"
            required
            disabled={noLocations}
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50"
          >
            <option value="" disabled>
              Select a location…
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            required
            disabled={noLocations}
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        Every item must be assigned to a location with a starting quantity.
      </p>

      {noLocations ? (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          No locations exist yet. Create one on the{" "}
          <Link href="/locations" className="font-medium underline">
            Locations
          </Link>{" "}
          page before adding items.
        </p>
      ) : null}

      <Button type="submit" disabled={pending || noLocations}>
        <Plus className="h-4 w-4" />
        {pending ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
