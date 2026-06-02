"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeItem } from "@/app/(app)/admin/actions";

export function RemoveItemButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Remove "${name}" from the catalog? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await removeItem(id);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not remove item.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Remove ${name}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
