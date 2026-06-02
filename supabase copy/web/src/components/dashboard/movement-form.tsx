"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordMovement } from "@/app/(app)/items/[id]/actions";
import type { Location } from "@/lib/api/types";

export function MovementForm({
  itemId,
  locations,
}: {
  itemId: string;
  locations: Location[];
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locations.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-muted">
        No locations exist yet, so stock can&apos;t be moved.
      </p>
    );
  }

  function submit(checkout: boolean) {
    setError(null);
    if (!locationId) return setError("Choose a location.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return setError("Enter a quantity of at least 1.");
    }
    startTransition(async () => {
      const res = await recordMovement(itemId, locationId, quantity, checkout);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mv-location">Location</Label>
          <select
            id="mv-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mv-quantity">Quantity</Label>
          <Input
            id="mv-quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => submit(true)}>
          <ArrowUpFromLine className="h-4 w-4" />
          {pending ? "Working…" : "Take from stock"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => submit(false)}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Return to stock
        </Button>
      </div>
    </div>
  );
}
