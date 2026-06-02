"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <p className="px-5 py-6 text-sm text-muted-foreground">
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
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger id="mv-location">
              <SelectValue placeholder="Choose a location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
