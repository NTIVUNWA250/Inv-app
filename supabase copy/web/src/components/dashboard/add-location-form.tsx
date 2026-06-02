"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLocation, type AddLocationState } from "@/app/(app)/admin/actions";

export function AddLocationForm() {
  const [state, formAction, pending] = useActionState<AddLocationState, FormData>(
    addLocation,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex gap-2">
        <Input name="name" required placeholder="New location (e.g. Lab B)" className="flex-1" />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
    </form>
  );
}
