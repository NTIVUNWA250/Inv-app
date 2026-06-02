"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.ok ? (
        <Alert variant="success">
          <AlertDescription>Item added.</AlertDescription>
        </Alert>
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
          <Select name="location_id" required disabled={noLocations}>
            <SelectTrigger id="location_id" className="w-full">
              <SelectValue placeholder="Select a location…" />
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

      <p className="text-xs text-muted-foreground">
        Every item must be assigned to a location with a starting quantity.
      </p>

      {noLocations ? (
        <Alert variant="warning">
          <AlertDescription>
            No locations exist yet. Create one on the{" "}
            <Link href="/locations" className="font-medium underline">
              Locations
            </Link>{" "}
            page before adding items.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || noLocations}>
        <Plus className="h-4 w-4" />
        {pending ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
